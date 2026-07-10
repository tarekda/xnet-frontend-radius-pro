import React from 'react';
import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, CalendarIcon, Check, CheckCircle, DollarSign, Eye, UserCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import TableRowActions from '@/components/TableRowActions';
import type { Invoice } from './types';

type ColumnHandlers = {
    onViewInvoice: (invoice: Invoice) => void;
    onSetPaid: (invoiceId: number) => void;
};

const SortableHeader = ({ column, label }: { column: any; label: string }) => (
    <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        className="hover:bg-muted/70 dark:hover:bg-muted/45"
    >
        {label}
        <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
);

export function buildInvoiceColumns({ onViewInvoice, onSetPaid }: ColumnHandlers): ColumnDef<Invoice>[] {
    return [
        {
            accessorKey: "id",
            header: ({ column }) => <SortableHeader column={column} label="ID" />,
            cell: ({ row }) => <span className="font-mono text-sm font-semibold">#{row.original.id}</span>,
        },
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "userProfile.username",
            header: ({ column }) => <SortableHeader column={column} label="Username" />,
            cell: ({ row }) => (
                <div className="flex items-center">
                    <span className="font-medium text-blue-600 dark:text-blue-400">{row.original.userProfile.username}</span>
                </div>
            ),
        },
        {
            accessorKey: "userDetails.fullName",
            header: ({ column }) => <SortableHeader column={column} label="FullName" />,
            cell: ({ row }) => (
                <div className="flex items-center">
                    <UserCircle className="h-5 w-5 text-blue-500 dark:text-blue-400 mr-2" />
                    <span className="font-medium text-blue-600 dark:text-blue-400">{row.original.userDetails?.fullName ?? "-"}</span>
                </div>
            ),
        },
        {
            accessorKey: "userProfile.profile.profileName",
            header: "Profile",
            cell: ({ row }) => (
                <Badge variant="outline" className="font-semibold text-xs px-2 py-1">
                    {row.original.userProfile.profile.profileName}
                </Badge>
            ),
        },
        {
            accessorKey: "billingMonth",
            header: ({ column }) => <SortableHeader column={column} label="Billing Month" />,
            cell: ({ row }) => (
                <div className="flex items-center">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground mr-2" />
                    <span>{new Date(row.original.billingMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                </div>
            ),
        },
        {
            accessorKey: "amount",
            header: ({ column }) => <SortableHeader column={column} label="Amount" />,
            cell: ({ row }) => (
                <div className="flex items-center font-semibold">
                    <DollarSign className="h-4 w-4 text-green-500 mr-1" />
                    {row.original.amount.toFixed(2)}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <div className="flex items-center">
                    {row.original.status === 'paid' ? (
                        <Badge variant="success" className="font-semibold">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Paid
                        </Badge>
                    ) : (
                        <Badge variant="destructive" className="font-semibold text-white">
                            <XCircle className="h-3 w-3 mr-1" />
                            Unpaid
                        </Badge>
                    )}
                </div>
            ),
        },
        {
            id: 'actions',
            header: () => <div className="text-right pr-2">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-end pr-2">
                    <TableRowActions
                        actions={[
                            { label: "View details", icon: Eye, onClick: () => onViewInvoice(row.original) },
                            {
                                label: "Set as Paid",
                                icon: Check,
                                onClick: () => onSetPaid(row.original.id),
                                disabled: row.original.status === "paid",
                            },
                        ]}
                    />
                </div>
            ),
        },
    ];
}
