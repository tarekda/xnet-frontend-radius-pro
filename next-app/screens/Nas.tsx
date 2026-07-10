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
import { ArrowUpDown, Edit, MoreHorizontal, Plus, RefreshCw, Server } from 'lucide-react';
import PageHeader from "@/components/PageHeader";
import { ariaSortFor } from "@/lib/tableA11y";
import { useTranslation } from "react-i18next";
import IconActionButton from "@/components/IconActionButton";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import TablePager from "@/components/TablePager";
import TableToolbar from "@/components/TableToolbar";
import TableRowActions from "@/components/TableRowActions";
import SearchBar from "@/components/SearchBar";
import QueryState from "@/components/QueryState";
import { cn } from "@/lib/utils";

const statusPillClass = (status: string) =>
    status === "active"
        ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300"
        : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";

const columns: ColumnDef<Nas>[] = [
    {
        accessorKey: "id",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                >
                    ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
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
                >
                    NAS Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
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
                >
                    Status
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", statusPillClass(row.original.status))}>
                {row.original.status}
            </span>
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
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span>{nas.nasname}</span>
                    <span className={cn("px-2 py-1 rounded-full text-xs font-semibold", statusPillClass(nas.status))}>
                        {nas.status}
                    </span>
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
            <CardFooter className="flex justify-end">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            Actions <MoreHorizontal className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => console.log("Edit NAS", nas)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>
                        {/* Add more actions as needed */}
                    </DropdownMenuContent>
                </DropdownMenu>
            </CardFooter>
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

    const handleAddNas = () => {
        // Implement add NAS functionality
        console.log("Add NAS clicked");
    };

    return (
        <div className="w-full py-5 space-y-4 min-h-[50vh] bg-gradient-to-br from-gray-50/50 via-blue-50/20 to-transparent dark:from-background dark:via-muted/15 dark:to-background">
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
                    <div className="flex gap-2">
                        <IconActionButton
                            label="Refresh"
                            onClick={handleRefresh}
                            icon={<RefreshCw className="h-4 w-4" />}
                        />
                        <IconActionButton
                            label="Add NAS"
                            onClick={handleAddNas}
                            variant="default"
                            icon={<Plus className="h-4 w-4" />}
                        />
                    </div>
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
                emptyDescription="Create your first NAS or adjust your search."
            >
                <div className="flex items-center justify-between py-2 md:hidden">
                    <SearchBar
                        currentSearchTerm={globalFilter ?? ""}
                        onSearch={(term) => setGlobalFilter(term)}
                        placeholder="Search NAS..."
                        className="max-w-sm"
                    />
                </div>
                <div className="rounded-md border shadow-sm overflow-hidden hidden md:block">
                    <TableToolbar
                        label={`NAS: ${table.getFilteredRowModel().rows.length.toLocaleString()} • Page ${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()}`}
                    />
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id} className="bg-muted/50 dark:bg-muted/40">
                                    {headerGroup.headers.map((header) => (
                                        <TableHead key={header.id} className="font-bold text-muted-foreground" aria-sort={ariaSortFor(header)}>
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
                                            index % 2 === 0 ? "bg-card" : "bg-muted/40",
                                            "transition-colors duration-200 h-2",
                                            "hover:bg-accent/55 dark:hover:bg-accent/25"
                                        )}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                        <TableCell className="text-right">
                                            <TableRowActions
                                                actions={[
                                                    { label: "Edit", icon: Edit, onClick: () => console.log("Edit NAS", row.original) },
                                                ]}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length + 1} className="h-24 text-center text-muted-foreground">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <div className='md:hidden'>
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
