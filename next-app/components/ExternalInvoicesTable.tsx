// ExternalInvoicesTable.tsx
import React from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "@/navigation/urlSearchParams";
import {
    OnChangeFn,
    SortingState,
    RowSelectionState,
} from "@tanstack/react-table";

import { useExternalInvoices, type InvoiceMetrics } from "@/hooks/useExternalInvoices";

// import { Button } from "@/components/ui/button"; // not used here
import ExternalInvoiceCard from "@/components/ExternalInvoiceCard";
import DesktopTable, { EXTERNAL_INVOICE_PAGE_SIZE_OPTIONS } from "@/components/DesktopTable"; // <— the TanStack table you wrote earlier
import type { ExternalInvoice } from "@/types/api";
import { groupExternalInvoices, mergePinnedRows, type ExternalInvoiceGroup, type PinnedInvoiceRow } from "@/lib/externalInvoiceGrouping";
import type { ReconciliationFlag, WorkflowStage } from "@/lib/externalInvoiceInsights";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import EmptyState from "@/components/EmptyState";
import { FileText, TrendingUp, DollarSign, Receipt, AlertCircle, Trash2, Calendar, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import TablePager from "@/components/TablePager";
import QueryState from "@/components/QueryState";
import { useExternalInvoiceRealtimeSync } from "@/hooks/useExternalInvoiceRealtimeSync";
import { getCurrentMonthDateRange } from "@/lib/externalInvoiceDateUtils";

// The detail view pulls in a heavy dialog/tabs/calendar tree. Load it on demand so
// opening the invoices list stays cheap.
const ExternalInvoiceDetailView = dynamic(
    () => import("@/components/ExternalInvoiceDetailView"),
    { ssr: false }
);

const initialPage = 1;

export type ExternalInvoicesTableData = {
    rows: ExternalInvoice[];
    total: number;
    totalPages: number;
    metrics: InvoiceMetrics | undefined;
    isLoading: boolean;
};

type Props = { 
    search: string;
    ageBucket?: string;
    graceDays?: number;
    reconciliationMode?: boolean;
    reconciliationFlags?: Map<number, ReconciliationFlag[]>;
    onSetWorkflowStage?: (id: number, stage: WorkflowStage) => void;
    onSendReminderRequest?: (invoice: ExternalInvoice) => void;
    rowPredicate?: (inv: ExternalInvoice) => boolean;
    key?: number;
    rowSelection?: RowSelectionState;
    onRowSelectionChange?: OnChangeFn<RowSelectionState>;
    hideBulkActions?: boolean;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    onFirstPage?: () => void;
    onLastPage?: () => void;
    totalItems?: number;
    /** When provided, the empty state offers a "Clear filters" action. */
    onClearFilters?: () => void;
    hasActiveFilters?: boolean;
    /** When true, suppress this component's built-in KPI cards (the parent renders its own). */
    hideMetrics?: boolean;
    /**
     * Notifies the parent whenever the selected invoices change. Lets containers offer
     * bulk actions without controlling the selection (which would re-render the page
     * on every checkbox tick).
     */
    onSelectionChange?: (invoices: ExternalInvoice[]) => void;
    /** Increment to clear the current selection (used once a bulk action completes). */
    selectionResetKey?: number;
    /**
     * Notifies the parent whenever the table's data changes, so containers can
     * derive metrics/selection info without mounting a duplicate query.
     */
    onDataLoaded?: (payload: ExternalInvoicesTableData) => void;
};

const ExternalInvoicesTable: React.FC<Props> = ({ 
    search, 
    ageBucket,
    graceDays,
    reconciliationMode = false,
    reconciliationFlags,
    onSetWorkflowStage,
    onSendReminderRequest,
    rowPredicate,
    rowSelection: externalRowSelection,
    onRowSelectionChange: externalOnRowSelectionChange,
    hideBulkActions = false,
    pageSize = 20,
    onPageSizeChange,
    onFirstPage,
    onLastPage,
    totalItems,
    onClearFilters,
    hasActiveFilters = false,
    hideMetrics = false,
    onSelectionChange,
    selectionResetKey = 0,
    onDataLoaded,
}) => {
    const { user } = useAuth();
    const canPay = can(user, 'billing.externalInvoices.pay');
    const canUnpay = can(user, 'billing.externalInvoices.unpay');

    /* ── URL state ─────────────────────────────────────────── */
    const [searchParams, setSearchParams] = useSearchParams();

    const currentMonthRange = React.useMemo(() => getCurrentMonthDateRange(), []);
    const isAllTimeExplicit = searchParams.get('all') === 'true' || searchParams.get('from') === 'all';
    const fromParam = isAllTimeExplicit ? undefined : (searchParams.get('from') || currentMonthRange.from);
    const toParam = isAllTimeExplicit ? undefined : (searchParams.get('to') || currentMonthRange.to);
    const statusParam = (searchParams.get('status') === 'overdue' ? 'unpaid' : searchParams.get('status')) || undefined;
    const missingParam = (searchParams.get('missing') === 'all' ? undefined : searchParams.get('missing')) || undefined;
    const payDueParam = (searchParams.get('payDue') === 'all' ? undefined : searchParams.get('payDue')) || undefined;

    // Kept as a hook call to preserve hook ordering; the callback is currently unused.
    React.useCallback((from: string, to: string) => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.set("from", from);
            next.set("to", to);
            next.delete("all");
            return next;
        }, { replace: true } as any);
    }, [setSearchParams]);

    const handleSelectAllTime = React.useCallback(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            next.delete("from");
            next.delete("to");
            next.set("all", "true");
            return next;
        }, { replace: true } as any);
    }, [setSearchParams]);

    /* ── fetch everything through the hook ─────────────────── */
    const {
        data,
        error,
        isLoading,
        refetch,
        currentPage,
        setCurrentPage,
        setInvoiceAsPaidMutation,
        unpayInvoiceMutation,
        updateInvoiceMutation,
        deleteInvoiceMutation,
        sendReminderMutation,
        sharePaidInvoiceMutation,
        bulkDeleteInvoicesMutation,
        bulkUpdateInvoicesMutation,
    } = useExternalInvoices({
        initialPage,
        pageSize,
        search,
        from: fromParam,
        to: toParam,
        status: statusParam,
        ageBucket,
        graceDays,
        missing: missingParam,
        payDue: payDueParam,
        sortBy: (searchParams.get('sort') || '').split(':')[0] || undefined,
        sortDir: ((searchParams.get('sort') || '').split(':')[1] as 'asc' | 'desc') || undefined,
    });

    useExternalInvoiceRealtimeSync(refetch);

    // Jump back to page 1 whenever the search or any filter changes. Staying on a
    // later page would request a page that may not exist in the narrower result
    // set (e.g. searching from page 2 for an invoice that lives on page 1).
    const filterKey = [search, fromParam, toParam, statusParam, ageBucket, missingParam, payDueParam].join('|');
    const prevFilterKeyRef = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (prevFilterKeyRef.current !== null && prevFilterKeyRef.current !== filterKey) {
            setCurrentPage(1);
        }
        prevFilterKeyRef.current = filterKey;
    }, [filterKey, setCurrentPage]);

    /* ── just-paid rows held in place ───────────────────────── */
    // A row that gets settled stops matching an active status filter, so the
    // post-pay refetch would drop it and shift every row below it up. Hold such
    // rows at their previous position (rendered as paid) until the filters
    // change, the operator pages away, or the page is refreshed — the parent
    // remounts this component on Refresh, which clears the pins.
    const [pinnedPaid, setPinnedPaid] = React.useState<PinnedInvoiceRow[]>([]);
    const pinViewKey = [search, filterKey, searchParams.get('sort') ?? ''].join('|');
    const prevPinViewKeyRef = React.useRef(pinViewKey);
    React.useEffect(() => {
        if (prevPinViewKeyRef.current === pinViewKey) return;
        prevPinViewKeyRef.current = pinViewKey;
        setPinnedPaid([]);
    }, [pinViewKey]);

    // The latest rendered grouping, readable from mutation callbacks that were
    // created earlier in this render pass than the grouping itself.
    const groupedRowsRef = React.useRef<{
        rows: ExternalInvoice[];
        groups?: Map<number, ExternalInvoiceGroup>;
    }>({ rows: [] });

    const onDataLoadedRef = React.useRef(onDataLoaded);
    onDataLoadedRef.current = onDataLoaded;
    React.useEffect(() => {
        onDataLoadedRef.current?.({
            rows: data?.data?.data ?? [],
            total: data?.data?.total ?? 0,
            totalPages: data?.data?.totalPages ?? 1,
            metrics: data?.data?.metrics,
            isLoading,
        });
    }, [data, isLoading]);

    // Safety net: if the loaded result set has fewer pages than the current page
    // (e.g. rows were deleted), snap to the last available page.
    const loadedTotalPages = data?.data?.totalPages;
    React.useEffect(() => {
        if (typeof loadedTotalPages === 'number' && currentPage > Math.max(1, loadedTotalPages)) {
            setCurrentPage(Math.max(1, loadedTotalPages));
        }
    }, [loadedTotalPages, currentPage, setCurrentPage]);

    /* ── UI state local to this component ──────────────────── */
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});
    const [selectedInvoice, setSelected] = React.useState<ExternalInvoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = React.useState<number | null>(null);
    // Kept as a hook call to preserve hook ordering; state is currently unused.
    React.useState<string | null>(null);
    const { toast } = useToast();
    

    // Use external row selection if provided, otherwise use internal
    const rowSelection = externalRowSelection ?? internalRowSelection;
    const setRowSelection = externalOnRowSelectionChange ?? setInternalRowSelection;

    // Clear the selection when the parent bumps selectionResetKey (e.g. after a bulk action).
    const isInitialResetRef = React.useRef(true);
    React.useEffect(() => {
        if (isInitialResetRef.current) {
            isInitialResetRef.current = false;
            return;
        }
        setRowSelection({});
    }, [selectionResetKey, setRowSelection]);

    // Report the selected invoices upward so containers can offer bulk actions without
    // owning (and thus re-rendering on) the selection state.
    const selectedIds = React.useMemo(
        () =>
            Object.keys(rowSelection)
                .map((k) => parseInt(k, 10))
                .filter((n) => Number.isFinite(n) && n > 0),
        [rowSelection]
    );
    const onSelectionChangeRef = React.useRef(onSelectionChange);
    onSelectionChangeRef.current = onSelectionChange;
    React.useEffect(() => {
        if (!onSelectionChangeRef.current) return;
        const idSet = new Set(selectedIds);
        onSelectionChangeRef.current((data?.data.data ?? []).filter((inv) => idSet.has(inv.id)));
    }, [selectedIds, data]);

    /* ── table callbacks in hook‑friendly types ────────────── */
    const onSortingChange: OnChangeFn<SortingState> = (u) => setSorting(u);
    const onRowSelectionChange: OnChangeFn<RowSelectionState> = setRowSelection;

    /* ── mutations ─────────────────────────────────────────── */
    const markPaid = (id: number) => {
        if (!canPay) return;
        const prev = (data?.data.data ?? []).find((x) => x.id === id)?.status || 'pending';
        setInvoiceAsPaidMutation.mutate({ invoiceId: id, silent: true }, {
            onSuccess: (result) => {
                // Pin the affected row before the refetch drops it from a filtered list.
                const { rows: displayed, groups } = groupedRowsRef.current;
                const index = displayed.findIndex(
                    (row) =>
                        row.id === id ||
                        (groups?.get(row.id)?.lines ?? []).some((line) => line.invoice.id === id)
                );
                const shown = index >= 0 ? displayed[index] : undefined;
                if (shown) {
                    const settled = result?.data;
                    setPinnedPaid((pins) => [
                        ...pins.filter((pin) => pin.row.id !== shown.id),
                        {
                            page: currentPage,
                            index,
                            row: {
                                ...shown,
                                ...(settled && settled.id === shown.id ? settled : null),
                                status: 'paid',
                                remainingDue: 0,
                            },
                        },
                    ]);
                }
                refetch();
                toast({
                    title: `Invoice #${id} marked as paid`,
                    action: (
                        <ToastAction
                          altText="Undo"
                          onClick={() => {
                            if (canUnpay) {
                              unpayInvoiceMutation.mutate({ invoiceId: id, silent: true }, { onSuccess: () => refetch() });
                            } else {
                              updateInvoiceMutation.mutate({ invoiceId: id, invoiceData: { status: prev } }, { onSuccess: () => refetch() });
                            }
                          }}
                        >
                            Undo
                        </ToastAction>
                    ),
                });
            }
        });
    };

    const unpay = (id: number) => {
        unpayInvoiceMutation.mutate({ invoiceId: id }, { onSuccess: () => refetch() });
    };

    const handleDelete = (id: number) => {
        setInvoiceToDelete(id);
    };

    const remind = (id: number) => {
        const invoice = (data?.data.data ?? []).find((x) => x.id === id);
        if (!invoice) return;
        if (onSendReminderRequest) {
            onSendReminderRequest(invoice);
            return;
        }
        sendReminderMutation.mutate(id);
    };

    const sharePaid = (id: number) => {
        sharePaidInvoiceMutation.mutate(id);
    };

    const confirmDelete = () => {
        if (invoiceToDelete) {
            deleteInvoiceMutation.mutate(invoiceToDelete, {
                onSuccess: () => {
                    refetch();
                    setInvoiceToDelete(null);
                },
            });
        }
    };

    const saveInvoice = (inv: ExternalInvoice) => {
        updateInvoiceMutation.mutate({ invoiceId: inv.id, invoiceData: inv });
        setSelected(null);
    };

    const handleInlineUpdate = (id: number, field: keyof ExternalInvoice, value: any) => {
        updateInvoiceMutation.mutate({ invoiceId: id, invoiceData: { [field]: value } as Partial<ExternalInvoice> });
    };

    const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
    const [bulkDeleteIds, setBulkDeleteIds] = React.useState<number[]>([]);
    const handleBulkDelete = () => {
        const ids = Object.keys(rowSelection).map(Number);
        if (ids.length === 0) return;
        setBulkDeleteIds(ids);
        setBulkDeleteOpen(true);
    };

    const handleBulkUpdatePayDueDate = () => {
        const ids = Object.keys(rowSelection).map(Number);
        if (ids.length === 0) return;
        const date = prompt("Enter new Pay Due Date (YYYY-MM-DD):");
        if (date) {
            bulkUpdateInvoicesMutation.mutate({ invoiceIds: ids, payDueDate: date }, {
                onSuccess: () => setRowSelection({})
            });
        }
    };

    // Restore currentPage and sorting from URL on mount
    React.useEffect(() => {
        const p = Number(searchParams.get('p') || '');
        if (!Number.isNaN(p) && p > 0) {
            setCurrentPage(p);
        }
        const sortParam = searchParams.get('sort');
        if (sortParam) {
            const [col, dir] = sortParam.split(":");
            if (col) {
                setSorting([{ id: col, desc: dir === 'desc' }]);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Persist currentPage and sorting to URL
    React.useEffect(() => {
        const next = new URLSearchParams(searchParams);
        if (currentPage) next.set('p', String(currentPage)); else next.delete('p');
        if (sorting && sorting[0]) {
            const s = `${sorting[0].id}:${sorting[0].desc ? 'desc' : 'asc'}`;
            next.set('sort', s);
        } else {
            next.delete('sort');
        }
        setSearchParams(next, { replace: true } as any);
    }, [currentPage, sorting]);

    const rows = data?.data.data ?? [];
    const activeStatus = searchParams.get('status');
    const statusForFilter = activeStatus === 'overdue' ? 'unpaid' : activeStatus;
    const filteredRows = statusForFilter && statusForFilter !== 'all'
        ? rows.filter((r) => r.status === statusForFilter)
        : rows;
    const visibleRows = rowPredicate ? filteredRows.filter((r) => rowPredicate(r)) : filteredRows;

    // Re-insert just-paid rows the refetch removed, at their previous position, so
    // settling one invoice doesn't reshuffle the page under the operator. Only the
    // page on screen is considered, so paging away hides (and later drops) the pin.
    const rowsWithPinned = React.useMemo(
        () => mergePinnedRows(visibleRows, pinnedPaid, currentPage),
        [visibleRows, pinnedPaid, currentPage]
    );

    const pages = data?.data.totalPages ?? 1;
    const computedTotalItems = totalItems ?? data?.data.total ?? 0;

    // Merge same-customer invoices (same username + full name) into one record with
    // nested payment lines. Reconciliation mode needs one row per invoice, so skip it there.
    const groupingEnabled = !reconciliationMode;
    const { groupedRows, groupsById } = React.useMemo(() => {
        if (!groupingEnabled) {
            return { groupedRows: rowsWithPinned, groupsById: undefined as Map<number, ExternalInvoiceGroup> | undefined };
        }
        const groups = groupExternalInvoices(rowsWithPinned);
        const map = new Map<number, ExternalInvoiceGroup>();
        const rows: ExternalInvoice[] = [];
        for (const g of groups) {
            map.set(g.primary.id, g);
            rows.push(g.primary);
        }
        return { groupedRows: rows, groupsById: map };
    }, [groupingEnabled, rowsWithPinned]);

    groupedRowsRef.current = { rows: groupedRows, groups: groupsById };

    return (
        <QueryState
            isLoading={isLoading}
            error={error}
            isEmpty={rowsWithPinned.length === 0}
            onRetry={() => refetch()}
            loading={
                <div className="min-w-[768px] overflow-hidden rounded-lg border border-border/60 bg-card">
                    <div className="flex gap-2 border-b border-border/60 bg-muted/40 p-3">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex items-center gap-2 border-b border-border/40 p-3 last:border-b-0">
                            <Skeleton className="h-4 w-6" />
                            <Skeleton className="h-4 w-20" />
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-4 w-16" />
                            <Skeleton className="h-4 w-28" />
                            <Skeleton className="h-4 w-14" />
                            <Skeleton className="h-4 w-12" />
                        </div>
                    ))}
                    <div className="p-3 border-t bg-muted/20">
                        <Skeleton className="h-8 w-64" />
                    </div>
                </div>
            }
            empty={
                <div className="p-4">
                    <EmptyState
                        title={
                            hasActiveFilters || fromParam || toParam
                                ? "No invoices match your selected month/filters"
                                : "No invoices found"
                        }
                        description={
                            hasActiveFilters || fromParam || toParam
                                ? "Try viewing All Time invoices or switching your billing month filter."
                                : "Imported invoices will show up here once available."
                        }
                        icon={FileText}
                        actionLabel={
                            fromParam || toParam
                                ? "View All Time Invoices"
                                : hasActiveFilters && onClearFilters
                                ? "Clear all filters"
                                : undefined
                        }
                        onAction={
                            fromParam || toParam
                                ? handleSelectAllTime
                                : hasActiveFilters && onClearFilters
                                ? onClearFilters
                                : undefined
                        }
                    />
                </div>
            }
            errorTitle="Failed to load invoices"
        >
            {/* Metrics Overview */}
            {!hideMetrics && data?.data?.metrics && (
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
                >
                    <Card className="border-none bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium flex items-center justify-between">
                                Total Invoices
                                <Receipt className="h-4 w-4 text-indigo-500" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{data.data.metrics.totalInvoices.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-emerald-600 flex items-center justify-between">
                                Total Paid
                                <DollarSign className="h-4 w-4 text-emerald-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-emerald-600">${Number(data.data.metrics.totalPaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-rose-600 flex items-center justify-between">
                                Total Unpaid
                                <AlertCircle className="h-4 w-4 text-rose-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-rose-600">${Number(data.data.metrics.totalUnpaid || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                        </CardContent>
                    </Card>
                    <Card className="border-none bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-blue-600 flex items-center justify-between">
                                Collection Rate
                                <TrendingUp className="h-4 w-4 text-blue-600" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-blue-600">
                                {data.data.metrics.totalAmount > 0 
                                    ? Math.round((data.data.metrics.totalPaid / data.data.metrics.totalAmount) * 100) 
                                    : 0}%
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* desktop table */}
            <div className="hidden overflow-hidden rounded-lg border border-border/60 bg-card shadow-none md:block">
                <DesktopTable
                    invoices={groupedRows}
                    groupsById={groupsById}
                    currentPage={currentPage}
                    totalPages={pages}
                    pageSize={pageSize}
                    hidePager={true}
                    onNextPage={() => currentPage < pages && setCurrentPage((p) => p + 1)}
                    onPrevPage={() => currentPage > 1 && setCurrentPage((p) => p - 1)}
                    onPageSizeChange={onPageSizeChange || (() => {})}
                    onFirstPage={onFirstPage || (() => setCurrentPage(1))}
                    onLastPage={onLastPage || (() => setCurrentPage(pages))}
                    totalItems={computedTotalItems}
                    sorting={sorting}
                    onSortingChange={onSortingChange}
                    rowSelection={rowSelection}
                    onRowSelectionChange={onRowSelectionChange}
                    onSetPaid={canPay ? markPaid : undefined}
                    onUnpay={canUnpay ? unpay : undefined}
                    onViewInvoice={setSelected}
                    onDeleteInvoice={handleDelete}
                    onSendReminder={remind}
                    onSharePaid={sharePaid}
                    onSetWorkflowStage={onSetWorkflowStage}
                    onInlineUpdate={handleInlineUpdate}
                    reconciliationMode={reconciliationMode}
                    reconciliationFlags={reconciliationFlags}
                    workflowGraceDays={graceDays}
                    search={search}
                    hideBulkActions={hideBulkActions}
                />
            </div>

            {/* mobile list */}
            <div className="space-y-3 md:hidden">
                {groupedRows.map((inv) => {
                    const group = groupsById?.get(inv.id);
                    const payTargetId = group ? group.currentMonthPayable?.id ?? null : inv.id;
                    return (
                        <ExternalInvoiceCard
                            key={inv.id}
                            invoice={inv}
                            onSetPaid={canPay && payTargetId !== null ? () => markPaid(payTargetId) : undefined}
                            onViewDetails={() => setSelected(inv)}
                        />
                    );
                })}
            </div>

            <TablePager
                currentPage={currentPage}
                totalPages={pages}
                totalItems={computedTotalItems}
                pageSize={pageSize}
                pageSizeOptions={EXTERNAL_INVOICE_PAGE_SIZE_OPTIONS}
                onPageChange={(p: number) => setCurrentPage(p)}
                onPageSizeChange={(n: number) => {
                    onPageSizeChange?.(n);
                    setCurrentPage(1);
                }}
                isDisabled={isLoading}
                noun="invoices"
            />

            {selectedInvoice && (
                <ExternalInvoiceDetailView
                    invoice={selectedInvoice}
                    onClose={() => setSelected(null)}
                    onSave={saveInvoice}
                />
            )}

            <AlertDialog open={invoiceToDelete !== null} onOpenChange={() => setInvoiceToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the invoice.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm action</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete {bulkDeleteIds.length} invoices?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                                bulkDeleteInvoicesMutation.mutate(bulkDeleteIds, {
                                    onSuccess: () => setRowSelection({})
                                });
                                setBulkDeleteOpen(false);
                            }}
                        >
                            Continue
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Bulk Actions Floating Bar */}
            {Object.keys(rowSelection).length > 0 && !hideBulkActions && (
                <motion.div 
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-gray-900 dark:bg-gray-800 text-white px-6 py-3 rounded-full shadow-2xl"
                >
                    <span className="font-semibold text-sm bg-gray-800 dark:bg-gray-900 px-3 py-1 rounded-full">
                        {Object.keys(rowSelection).length} selected
                    </span>
                    <div className="flex items-center gap-2 border-l border-gray-700 pl-4">
                        <button 
                            onClick={handleBulkUpdatePayDueDate}
                            className="flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-700 px-3 py-1.5 rounded-md text-sm transition-colors"
                        >
                            <Calendar className="w-4 h-4" />
                            Set Due Date
                        </button>
                        <button 
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 text-red-400 hover:bg-red-500/20 px-3 py-1.5 rounded-md text-sm transition-colors"
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </button>
                    </div>
                    <button 
                        onClick={() => setRowSelection({})}
                        className="ml-2 p-1.5 hover:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </motion.div>
            )}
        </QueryState>
    );
};

export default React.memo(ExternalInvoicesTable);
