// ExternalInvoicesTable.tsx
import React from "react";
import { useSearchParams } from "@/navigation/urlSearchParams";
import {
    OnChangeFn,
    SortingState,
    RowSelectionState,
} from "@tanstack/react-table";

import { useExternalInvoices } from "@/hooks/useExternalInvoices";

// import { Button } from "@/components/ui/button"; // not used here
import ExternalInvoiceCard from "@/components/ExternalInvoiceCard";
import ExternalInvoiceDetailView from "@/components/ExternalInvoiceDetailView";
import DesktopTable from "@/components/DesktopTable"; // <— the TanStack table you wrote earlier
import type { ExternalInvoice } from "@/types/api";
import type { ReconciliationFlag, WorkflowStage } from "@/lib/externalInvoiceInsights";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "./ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import EmptyState from "@/components/EmptyState";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import TablePager from "@/components/TablePager";
import QueryState from "@/components/QueryState";

const initialPage = 1;

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
}) => {
    const { user } = useAuth();
    const canPay = can(user, 'billing.externalInvoices.pay');
    const canUnpay = can(user, 'billing.externalInvoices.unpay');

    /* ── URL state ─────────────────────────────────────────── */
    const [searchParams, setSearchParams] = useSearchParams();

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
    } = useExternalInvoices({
        initialPage,
        pageSize,
        search,
        from: searchParams.get('from') || undefined,
        to: searchParams.get('to') || undefined,
        status: (searchParams.get('status') === 'overdue' ? 'unpaid' : searchParams.get('status')) || undefined,
        ageBucket,
        graceDays,
        missing: (searchParams.get('missing') === 'all' ? undefined : searchParams.get('missing')) || undefined,
        sortBy: (searchParams.get('sort') || '').split(':')[0] || undefined,
        sortDir: ((searchParams.get('sort') || '').split(':')[1] as 'asc' | 'desc') || undefined,
    });

    /* ── UI state local to this component ──────────────────── */
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [internalRowSelection, setInternalRowSelection] = React.useState<RowSelectionState>({});
    const [selectedInvoice, setSelected] = React.useState<ExternalInvoice | null>(null);
    const [invoiceToDelete, setInvoiceToDelete] = React.useState<number | null>(null);
    const { toast } = useToast();
    

    // Use external row selection if provided, otherwise use internal
    const rowSelection = externalRowSelection ?? internalRowSelection;
    const setRowSelection = externalOnRowSelectionChange ?? setInternalRowSelection;

    /* ── table callbacks in hook‑friendly types ────────────── */
    const onSortingChange: OnChangeFn<SortingState> = (u) => setSorting(u);
    const onRowSelectionChange: OnChangeFn<RowSelectionState> = setRowSelection;

    /* ── mutations ─────────────────────────────────────────── */
    const markPaid = (id: number) => {
        if (!canPay) return;
        const prev = (data?.data.data ?? []).find((x) => x.id === id)?.status || 'pending';
        setInvoiceAsPaidMutation.mutate({ invoiceId: id, silent: true }, {
            onSuccess: () => {
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
    const pages = data?.data.totalPages ?? 1;
    const computedTotalItems = totalItems ?? data?.data.total ?? 0;

    return (
        <QueryState
            isLoading={isLoading}
            error={error}
            isEmpty={visibleRows.length === 0}
            onRetry={() => refetch()}
            loading={
                <div className="rounded-md border min-w-[768px] overflow-hidden">
                    <div className="flex gap-2 p-3 border-b bg-muted/30">
                        <Skeleton className="h-4 w-8" />
                        <Skeleton className="h-4 w-16" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-28" />
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-16" />
                    </div>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                        <div key={i} className="flex gap-2 p-3 border-b last:border-b-0 items-center">
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
                        title={hasActiveFilters ? "No invoices match your filters" : "No invoices found"}
                        description={
                            hasActiveFilters
                                ? "Loosen or clear the active filters to see more results."
                                : "Imported invoices will show up here once available."
                        }
                        icon={FileText}
                        actionLabel={hasActiveFilters && onClearFilters ? "Clear all filters" : undefined}
                        onAction={hasActiveFilters && onClearFilters ? onClearFilters : undefined}
                    />
                </div>
            }
            errorTitle="Failed to load invoices"
        >
            {/* desktop table */}
            <div className="hidden md:block rounded-md border">
                <DesktopTable
                    invoices={visibleRows}
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
                    onSetWorkflowStage={onSetWorkflowStage}
                    reconciliationMode={reconciliationMode}
                    reconciliationFlags={reconciliationFlags}
                    workflowGraceDays={graceDays}
                    search={search}
                    hideBulkActions={hideBulkActions}
                />
            </div>

            {/* mobile list */}
            <div className="md:hidden">
                {visibleRows.map((inv) => (
                    <ExternalInvoiceCard
                        key={inv.id}
                        invoice={inv}
                        onSetPaid={canPay ? () => markPaid(inv.id) : undefined}
                        onViewDetails={() => setSelected(inv)}
                    />
                ))}
            </div>

            <TablePager
                currentPage={currentPage}
                totalPages={pages}
                totalItems={computedTotalItems}
                pageSize={pageSize}
                pageSizeOptions={[10, 20, 50, 100, 200, 500]}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(n) => {
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
        </QueryState>
    );
};

export default React.memo(ExternalInvoicesTable);
