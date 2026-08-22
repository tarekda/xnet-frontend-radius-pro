import React, { useState } from 'react';
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
    ColumnDef,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
} from "@tanstack/react-table";
import useNas from '../hooks/useNas';
import { Button } from "@/components/ui/button";
import { Nas } from '../types/api'; // Make sure to define this type
import { ArrowUpDown, RefreshCw, Server } from 'lucide-react';
import PageHeader from "@/components/PageHeader";
import { ariaSortFor } from "@/lib/tableA11y";
import { useTranslation } from "react-i18next";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import TablePager from "@/components/TablePager";
import TableToolbar from "@/components/TableToolbar";
import SearchBar from "@/components/SearchBar";
import QueryState from "@/components/QueryState";
import { cn } from "@/lib/utils";
import StatusPill from "@/components/StatusPill";

const statusTone = (status: string) => (status === "active" ? "success" : "danger");

const columns: ColumnDef<Nas>[] = [
    {
        accessorKey: "id",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-8 -ml-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                    ID
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
            )
        },
    },
    {
        accessorKey: "nasname",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-8 -ml-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                    NAS Name
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
            )
        },
    },
    {
        accessorKey: "shortname",
        header: "Short Name",
    },
    {
        accessorKey: "type",
        header: "Type",
    },
    {
        accessorKey: "ports",
        header: "Ports",
    },
    {
        accessorKey: "secret",
        header: "Secret",
        cell: () => <span>********</span>, // Hide the actual secret
    },
    {
        accessorKey: "status",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="h-8 -ml-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                    Status
                    <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <StatusPill label={row.original.status} tone={statusTone(row.original.status)} dot className="capitalize" />
        ),
    },
    {
        accessorKey: "server",
        header: "Server",
    },
    {
        accessorKey: "community",
        header: "Community",
    },
    {
        accessorKey: "description",
        header: "Description",
    },
];

const NasCard: React.FC<{ nas: Nas }> = ({ nas }) => {
    return (
        <Card className="overflow-hidden border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 bg-muted/15 p-4 pb-3">
                <CardTitle className="flex items-center justify-between gap-2">
                    <span className="text-base font-semibold">{nas.nasname}</span>
                    <StatusPill label={nas.status} tone={statusTone(nas.status)} dot className="capitalize" />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm text-foreground">
                    <div><span className="font-semibold text-muted-foreground">ID:</span> {nas.id}</div>
                    <div><span className="font-semibold text-muted-foreground">Short Name:</span> {nas.shortname}</div>
                    <div><span className="font-semibold text-muted-foreground">Type:</span> {nas.type}</div>
                    <div><span className="font-semibold text-muted-foreground">Ports:</span> {nas.ports}</div>
                    <div><span className="font-semibold text-muted-foreground">Server:</span> {nas.server}</div>
                    <div><span className="font-semibold text-muted-foreground">Community:</span> {nas.community}</div>
                    <div className="col-span-2"><span className="font-semibold text-muted-foreground">Description:</span> {nas.description}</div>
                </div>
            </CardContent>
        </Card>
    );
};

const NasComponent: React.FC = () => {
    const { t } = useTranslation("screens");
    const { data, error, isLoading, refetch } = useNas();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');

    const table = useReactTable({
        data: data?.data?.nasEntries ?? [],
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onSortingChange: setSorting,
        onGlobalFilterChange: setGlobalFilter,
        state: {
            sorting,
            globalFilter,
        },
    });

    const handleRefresh = () => {
        refetch();
    };

    return (
        <div className="w-full min-h-[50vh] space-y-5">
            <PageHeader
                title={t("nas.title")}
                subtitle={t("nas.subtitle")}
                icon={Server}
                rightContent={(
                    <div className="hidden md:block">
                        <SearchBar
                            currentSearchTerm={globalFilter ?? ""}
                            onSearch={(term) => setGlobalFilter(term)}
                            placeholder="Search NAS..."
                            className="max-w-sm"
                        />
                    </div>
                )}
                actions={(
                    <IconActionButton
                        label="Refresh"
                        onClick={handleRefresh}
                        icon={<RefreshCw className="h-4 w-4" />}
                    />
                )}
            />

            <QueryState
                isLoading={isLoading}
                error={error}
                isEmpty={(data?.data?.nasEntries ?? []).length === 0}
                onRetry={() => refetch()}
                loading={<div className="flex justify-center items-center h-[40vh]">Loading…</div>}
                errorTitle="Failed to load NAS"
                emptyTitle="No NAS entries"
                emptyDescription="No NAS clients are configured yet. NAS records are managed on the RADIUS server."
            >
                <div className="flex items-center justify-between py-2 md:hidden">
                    <SearchBar
                        currentSearchTerm={globalFilter ?? ""}
                        onSearch={(term) => setGlobalFilter(term)}
                        placeholder="Search NAS..."
                        className="max-w-sm"
                    />
                </div>
                <div className="hidden overflow-hidden rounded-xl border border-border/80 bg-card shadow-[var(--shop-shadow)] md:block">
                    <TableToolbar
                        label={`NAS: ${table.getFilteredRowModel().rows.length.toLocaleString()} • Page ${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()}`}
                    />
                    <Table>
                        <TableHeader>
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
                                            index % 2 === 0 ? "bg-card" : "bg-muted/35",
                                            "transition-colors hover:bg-accent/45 dark:hover:bg-accent/30"
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
                <div className="space-y-3 md:hidden">
                    {table.getRowModel().rows.map((row) => (
                        <NasCard key={row.id} nas={row.original} />
                    ))}
                </div>
                <TablePager
                    currentPage={table.getState().pagination.pageIndex + 1}
                    totalPages={table.getPageCount()}
                    totalItems={table.getFilteredRowModel().rows.length}
                    pageSize={table.getState().pagination.pageSize}
                    pageSizeOptions={[10, 20, 50, 100, 200]}
                    onPageChange={(p) => table.setPageIndex(p - 1)}
                    onPageSizeChange={(n) => table.setPageSize(n)}
                    isDisabled={isLoading}
                    noun="items"
                />
            </QueryState>
        </div>
    );
};

export default NasComponent;
