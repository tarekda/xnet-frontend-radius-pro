import React, { useEffect, useMemo, useState } from 'react';
import PageHeader from "@/components/PageHeader";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    SortingState,
    getSortedRowModel,
} from "@tanstack/react-table";
import { useInvoices } from '@/hooks/useInvoices';
import { FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ariaSortFor } from '@/lib/tableA11y';
import { DateRange } from 'react-day-picker';
import { notify } from '@/lib/notify';
import { MESSAGES } from '@/constants/messages';
import TablePager from '@/components/TablePager';
import TableToolbar from "@/components/TableToolbar";
import QueryState from "@/components/QueryState";
import EmptyState from "@/components/EmptyState";
import SavedViews from "@/components/SavedViews";
import type { Invoice } from './types';
import InvoiceSummaryCards from './InvoiceSummaryCards';
import InvoiceCard from './InvoiceCard';
import InvoiceDetailDialog from './InvoiceDetailDialog';
import InvoicesFiltersBar from './InvoicesFiltersBar';
import { buildInvoiceColumns } from './invoiceColumns';
import { useTranslation } from 'react-i18next';

const NoInvoicesMessage: React.FC<{ onGenerateInvoice: () => void; isGenerating: boolean }> = ({
    onGenerateInvoice,
    isGenerating
}) => (
    <EmptyState
        icon={FileText}
        title="No invoices available"
        description="There are currently no invoices to display."
        actionLabel={isGenerating ? "Generating..." : "Generate invoices"}
        onAction={onGenerateInvoice}
    />
);

const InvoicesComponent: React.FC = () => {
    const { t } = useTranslation("screens");
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pageSize, setPageSize] = useState(50);
    const { data, error, isLoading, refetch, setCurrentPage, currentPage, setSearchQuery, searchQuery, setInvoiceAsPaidMutation, generateInvoicesMutation } =
        useInvoices(1, pageSize);
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
    const [rowSelection, setRowSelection] = useState({});

    const handleSetPaid = (invoiceId: number) => {
        setInvoiceAsPaidMutation.mutate({ invoiceId });
        refetch();
    };

    const columns = useMemo(
        () => buildInvoiceColumns({
            onViewInvoice: setSelectedInvoice,
            onSetPaid: handleSetPaid,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    const table = useReactTable({
        data: data?.data.data ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        pageCount: data?.data.totalPages ?? -1,
        state: {
            rowSelection,
            sorting,
            globalFilter,
            pagination: {
                pageIndex: currentPage - 1,
                pageSize: pageSize,
            },
        },
        onSortingChange: setSorting,
        manualPagination: true,
        enableRowSelection: true,
        onRowSelectionChange: setRowSelection,
    });

    const handleBulkSetPaid = () => {
        const selectedRows = table.getSelectedRowModel().rows;
        selectedRows.forEach((row) => setInvoiceAsPaidMutation.mutate({ invoiceId: row.original.id, silent: true }));
        table.resetRowSelection();
        notify.success("Success", `Marked ${selectedRows.length} invoice(s) as paid.`);
        refetch();
    };

    const savedViewsKeys = ["q", "from", "to", "ps", "sort"];
    const buildViewState = () => {
        const state: Record<string, string> = {
            q: globalFilter || "",
            ps: String(pageSize),
            from: dateRange?.from ? dateRange.from.toISOString().split("T")[0] : "",
            to: dateRange?.to ? dateRange.to.toISOString().split("T")[0] : "",
        };
        if (sorting?.[0]?.id) {
            state.sort = `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`;
        } else {
            state.sort = "";
        }
        return state;
    };

    const applyViewState = (state: Record<string, string>) => {
        const q = state.q ?? "";
        setGlobalFilter(q);

        const psNum = parseInt(state.ps ?? "", 10);
        if (!Number.isNaN(psNum) && psNum > 0) setPageSize(psNum);

        const from = state.from || "";
        const to = state.to || "";
        if (from && to) {
            setDateRange({ from: new Date(from), to: new Date(to) });
        } else {
            setDateRange(undefined);
        }

        const sort = state.sort || "";
        if (sort.includes(":")) {
            const [id, dir] = sort.split(":");
            if (id) setSorting([{ id, desc: dir === "desc" }]);
        } else {
            setSorting([]);
        }

        // Sync query used by the hook
        const sp = new URLSearchParams();
        if (q) sp.set("search", q);
        if (from && to) {
            sp.set("dateFrom", from);
            sp.set("dateTo", to);
        }
        setSearchQuery(sp.toString());
        setCurrentPage(1);
        refetch();
    };

    const handleClearSearch = () => {
        setGlobalFilter('');
        setSearchQuery('');
        setDateRange(undefined);
        setCurrentPage(1);
    };

    const handleClearDates = () => {
        setDateRange(undefined);
        const searchParams = new URLSearchParams(searchQuery);
        searchParams.delete('dateFrom');
        searchParams.delete('dateTo');
        setSearchQuery(searchParams.toString());
        setCurrentPage(1);
    };

    const handleDateRangeChange = (range: DateRange | undefined) => {
        setDateRange(range);
        if (range?.from && range?.to) {
            const searchParams = new URLSearchParams(searchQuery);
            searchParams.set('dateFrom', range.from.toISOString().split('T')[0] ?? '');
            searchParams.set('dateTo', range.to.toISOString().split('T')[0] ?? '');
            setSearchQuery(searchParams.toString());
            setCurrentPage(1);
        }
    };

    const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const searchParams = new URLSearchParams();

        if (globalFilter) {
            searchParams.append('search', globalFilter);
        }

        if (dateRange?.from && dateRange?.to) {
            searchParams.append('dateFrom', dateRange.from.toISOString().split('T')[0] ?? '');
            searchParams.append('dateTo', dateRange.to.toISOString().split('T')[0] ?? '');
        }

        setSearchQuery(searchParams.toString());
        setCurrentPage(1);
    };

    const handleGenerateInvoice = async () => {
        generateInvoicesMutation.mutate();
        await refetch();
    };

    const handleGenerateInvoices = async () => {
        try {
            await generateInvoicesMutation.mutateAsync();
            refetch();
        } catch (error: unknown) {
            notify.error("Action failed", error instanceof Error ? error.message : MESSAGES.common.actionFailed);
        }
    };

    const handleExportInvoices = async () => {
        if (data?.data.data) {
            const xlsx = await import("xlsx");
            const ws = xlsx.utils.json_to_sheet(data.data.data);
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "Invoices");
            xlsx.writeFile(wb, "invoices.xlsx");
        }
    };

    useEffect(() => {
        if (generateInvoicesMutation.isSuccess) {
            refetch();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateInvoicesMutation.isSuccess]);

    const totalSum = data?.data?.data.reduce((sum, invoice) => sum + invoice.amount, 0) ?? 0;

    return (
        <div className="w-full space-y-5">
            <PageHeader
                title={t("generatedInvoices.title")}
                subtitle={t("generatedInvoices.subtitle")}
                icon={FileText}
            />
            <QueryState
                isLoading={isLoading}
                error={error}
                isEmpty={!data?.data?.data?.length}
                onRetry={() => refetch()}
                empty={
                    <NoInvoicesMessage
                        onGenerateInvoice={handleGenerateInvoice}
                        isGenerating={isLoading}
                    />
                }
                errorTitle="Failed to load invoices"
            >
                {data?.data && data.data.data.length > 0 ? (
                    <InvoiceSummaryCards invoices={data.data.data} totalSum={totalSum} />
                ) : null}

                <div>
                    <InvoicesFiltersBar
                        globalFilter={globalFilter}
                        onGlobalFilterChange={setGlobalFilter}
                        onSearchSubmit={handleSearch}
                        dateRange={dateRange}
                        onDateRangeChange={handleDateRangeChange}
                        onClearDates={handleClearDates}
                        onClearSearch={handleClearSearch}
                        onBulkSetPaid={handleBulkSetPaid}
                        bulkDisabled={Object.keys(rowSelection).length === 0}
                        onRefresh={() => refetch()}
                        onGenerateInvoices={handleGenerateInvoices}
                        isLoading={isLoading}
                        onExportInvoices={handleExportInvoices}
                        exportDisabled={!data?.data.data.length}
                    />
                </div>

                {selectedInvoice ? (
                    <InvoiceDetailDialog
                        invoice={selectedInvoice}
                        onClose={() => setSelectedInvoice(null)}
                    />
                ) : null}

                <div className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--shop-shadow)]">
                    <TableToolbar
                        label={`Invoices: ${(data?.data?.total ?? 0).toLocaleString()} • Page ${currentPage} / ${(data?.data?.totalPages ?? 1)}`}
                        right={
                            <div className="hidden items-center gap-2 md:flex">
                                <SavedViews
                                    storageKey="invoices.views"
                                    keys={savedViewsKeys}
                                    getState={buildViewState}
                                    applyState={applyViewState}
                                    onSaved={(name) => notify.success("View saved", `Saved “${name}”.`)}
                                    onDeleted={(name) => notify.success("View deleted", `Deleted “${name}”.`)}
                                />
                            </div>
                        }
                    />
                    <div className="hidden min-w-[768px] md:block">
                        <Table className="w-full">
                            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/95">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id}>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} aria-sort={ariaSortFor(header)}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows?.length ? (
                                    table.getRowModel().rows.map((row, index) => (
                                        <TableRow
                                            key={row.id}
                                            data-state={row.getIsSelected() && "selected"}
                                            className={cn(
                                                "transition-colors",
                                                index % 2 === 0 ? "bg-card" : "bg-muted/35",
                                                "hover:bg-accent/45 dark:hover:bg-accent/30",
                                                row.getIsSelected() && "bg-primary/15"
                                            )}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id}>
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                                            No results.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="space-y-3 p-3 md:hidden">
                        {data?.data.data.map((invoice) => (
                            <InvoiceCard
                                key={invoice.id}
                                invoice={invoice}
                                onSetPaid={() => handleSetPaid(invoice.id)}
                            />
                        ))}
                    </div>
                </div>

                <TablePager
                    currentPage={currentPage}
                    totalPages={data?.data?.totalPages ?? 1}
                    totalItems={data?.data?.total ?? 0}
                    pageSize={pageSize}
                    pageSizeOptions={[10, 20, 50, 100, 200, 500]}
                    onPageChange={(p) => setCurrentPage(p)}
                    onPageSizeChange={(n) => {
                        setPageSize(n);
                        setCurrentPage(1);
                    }}
                    isDisabled={isLoading}
                    noun="invoices"
                />
            </QueryState>
        </div>
    );
};

export default InvoicesComponent;
