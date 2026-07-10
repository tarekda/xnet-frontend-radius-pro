import React, { useMemo, useState } from 'react';
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
import useAuthUsers from '../hooks/useAuthUsers';
import { Button } from "@/components/ui/button";
import { AuthUser } from '../types/api';
import { ArrowUpDown, Edit, Plus, RefreshCw, Trash2, Users, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ariaSortFor } from '@/lib/tableA11y';
import { useTranslation } from 'react-i18next';
import AddAuthUserModal from '@/components/AddAuthUserModal';
import { AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AlertDialog } from '@radix-ui/react-alert-dialog';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import IconActionButton from "@/components/IconActionButton";
import { MESSAGES } from "@/constants/messages";
import { notify } from "@/lib/notify";
import TablePager from "@/components/TablePager";
import TableToolbar from "@/components/TableToolbar";
import TableRowActions from "@/components/TableRowActions";
import SearchBar from "@/components/SearchBar";
import QueryState from "@/components/QueryState";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { canAny } from "@/lib/permissions";

const UserCard: React.FC<{ user: AuthUser; onEdit: () => void; onDelete: () => void }> = ({ user, onEdit, onDelete }) => {
    return (
        <Card className="mb-4 hover:shadow-md transition-shadow duration-200">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg font-semibold text-blue-600 dark:text-blue-400">{user.username}</CardTitle>
                        <CardDescription className="mt-1">{user.email}</CardDescription>
                    </div>
                    <Badge
                        variant="outline"
                        className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/45 dark:text-blue-200 dark:border-blue-800"
                    >
                        {user.role}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <span
                            className={cn(
                                "px-2 py-1 rounded-full text-xs font-semibold",
                                user.isActive
                                    ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300"
                                    : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                            )}
                        >
                            {user.isActive ? "Active" : "Inactive"}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">Created:</span>
                        <span className="text-muted-foreground">{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="font-medium">Last Login:</span>
                        <span className="text-muted-foreground">{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex justify-end space-x-2 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={onEdit}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                </Button>
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onDelete} 
                    disabled={user.role.toLowerCase() === 'admin'}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                </Button>
            </CardFooter>
        </Card>
    );
};

const columns: ColumnDef<AuthUser>[] = [
    {
        accessorKey: "id",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-muted/70 dark:hover:bg-muted/45"
                >
                    ID
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.id}</span>,
    },
    {
        accessorKey: "username",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-muted/70 dark:hover:bg-muted/45"
                >
                    Username
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => (
            <span className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200">
                {row.original.username}
            </span>
        ),
    },
    {
        accessorKey: "email",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="hover:bg-muted/70 dark:hover:bg-muted/45"
                >
                    Email
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            )
        },
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
        accessorKey: "role",
        header: "Role",
        cell: ({ row }) => (
            <Badge
                variant="outline"
                className="bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/45 dark:text-blue-200 dark:border-blue-800"
            >
                {row.original.role}
            </Badge>
        ),
    },
    {
        accessorKey: "isActive",
        header: "Status",
        cell: ({ row }) => (
            <span
                className={cn(
                    "px-2 py-1 rounded-full text-xs font-semibold",
                    row.original.isActive
                        ? "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300"
                )}
            >
                {row.original.isActive ? 'Active' : 'Inactive'}
            </span>
        ),
    },
    {
        accessorKey: "createdAt",
        header: "Created At",
        cell: ({ row }) => <span>{new Date(row.original.createdAt).toLocaleString()}</span>,
    },
    {
        accessorKey: "lastLogin",
        header: "Last Login",
        cell: ({ row }) => <span>{row.original.lastLogin ? new Date(row.original.lastLogin).toLocaleString() : 'Never'}</span>,
    },
];

const AuthUsersComponent: React.FC = () => {
    const { t } = useTranslation("screens");
    const { data, error, isLoading, refetch, deleteAuthUserMutation, resetAuthUserPasswordMutation } = useAuthUsers();
    const { user: authUser } = useAuth();
    const canManageAuthUsers = useMemo(() => canAny(authUser, ["admin.authUsers.manage"]), [authUser]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [globalFilter, setGlobalFilter] = useState('');
    const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<AuthUser | undefined>(undefined);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<AuthUser | null>(null);
    const [resetUser, setResetUser] = useState<AuthUser | null>(null);
    const [newPassword, setNewPassword] = useState<string>("");

    const confirmDelete = async () => {
        if (userToDelete) {
            try {
                await deleteAuthUserMutation.mutateAsync(userToDelete.username);
                refetch();
            } catch (error: unknown) {
                notify.error("Delete failed", error instanceof Error ? error.message : MESSAGES.common.deleteFailed);
            }
        }
        setDeleteConfirmOpen(false);
        setUserToDelete(null);
    };

    const handleDeleteUser = (user: AuthUser) => {
        console.log('Deleting user:', user);
        setUserToDelete(user);
        setDeleteConfirmOpen(true);
    };

    const handleAddUser = () => {
        setUserToEdit(undefined);
        setIsAddUserModalOpen(true);
    };

    const handleEditUser = (user: AuthUser) => {
        setUserToEdit(user);
        setIsAddUserModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsAddUserModalOpen(false);
        setUserToEdit(undefined);
    };

    const table = useReactTable({
        data: data?.data?.users ?? [],
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
        <div className="w-full py-6 space-y-6">
            <PageHeader
                title={t("authUsers.title")}
                subtitle={t("authUsers.subtitle")}
                icon={Users}
                actions={(
                    <div className="flex gap-2">
                        <IconActionButton label="Refresh" onClick={handleRefresh} icon={<RefreshCw className="h-4 w-4" />} />
                        <IconActionButton label="Add User" onClick={handleAddUser} variant="default" icon={<Plus className="h-4 w-4" />} />
                    </div>
                )}
            />

            <QueryState
                isLoading={isLoading}
                error={error}
                isEmpty={!data?.data?.users?.length}
                onRetry={() => refetch()}
                loading={
                    <Card>
                        <CardHeader>
                            <Skeleton className="h-6 w-48" />
                            <Skeleton className="h-4 w-64" />
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <Card key={i} className="overflow-hidden">
                                        <div className="p-4 space-y-4">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-4 w-1/2" />
                                            <Skeleton className="h-4 w-2/3" />
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                }
                errorTitle="Error loading users"
                emptyTitle="No users found"
                emptyDescription="Try adjusting your search or create a new user."
            >
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle>User Management</CardTitle>
                            <CardDescription>
                                {data?.data?.total} total users
                            </CardDescription>
                        </div>
                        <div className="w-full sm:w-64">
                            <SearchBar
                                currentSearchTerm={globalFilter ?? ""}
                                onSearch={(term) => setGlobalFilter(term)}
                                placeholder="Search users..."
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto rounded-md border shadow-sm">
                        <div className="min-w-[768px] hidden md:block">
                            <TableToolbar
                                label={`Users: ${table.getFilteredRowModel().rows.length.toLocaleString()} • Page ${table.getState().pagination.pageIndex + 1} / ${table.getPageCount()}`}
                            />
                            <Table>
                                <TableHeader>
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        <TableRow key={headerGroup.id} className="bg-muted/50">
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
                                        table.getRowModel().rows.map((row) => (
                                            <TableRow
                                                key={row.id}
                                                data-state={row.getIsSelected() && "selected"}
                                                className="hover:bg-muted/50 transition-colors"
                                            >
                                                {row.getVisibleCells().map((cell) => (
                                                    <TableCell key={cell.id}>
                                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                    </TableCell>
                                                ))}
                                                <TableCell className="text-right">
                                                    <TableRowActions
                                                        actions={[
                                                            { label: "Edit", icon: Edit, onClick: () => handleEditUser(row.original), disabled: !canManageAuthUsers, disabledReason: "You don't have permission to manage auth users." },
                                                            { label: "Reset Password", icon: RefreshCw, onClick: () => { setResetUser(row.original); setNewPassword(""); }, disabled: !canManageAuthUsers, disabledReason: "You don't have permission to manage auth users." },
                                                            {
                                                                label: "Delete",
                                                                icon: Trash2,
                                                                onClick: () => handleDeleteUser(row.original),
                                                                disabled: !canManageAuthUsers || row.original.role.toLowerCase() === "admin",
                                                                disabledReason: !canManageAuthUsers ? "You don't have permission to manage auth users." : "Admin users cannot be deleted.",
                                                                tone: "destructive",
                                                            },
                                                        ]}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Search className="h-8 w-8 text-muted-foreground" />
                                                    <p className="text-lg font-medium">No users found</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {globalFilter ? 'Try adjusting your search' : 'Add your first user'}
                                                    </p>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="md:hidden space-y-4 p-4">
                            {table.getRowModel().rows.map((row) => (
                                <UserCard
                                    key={row.id}
                                    user={row.original}
                                    onEdit={() => handleEditUser(row.original)}
                                    onDelete={() => handleDeleteUser(row.original)}
                                />
                            ))}
                        </div>
                    </div>
                </CardContent>
                <CardFooter>
                    <TablePager
                        currentPage={table.getState().pagination.pageIndex + 1}
                        totalPages={table.getPageCount()}
                        totalItems={table.getFilteredRowModel().rows.length}
                        pageSize={table.getState().pagination.pageSize}
                        pageSizeOptions={[10, 20, 50, 100, 200]}
                        onPageChange={(p) => table.setPageIndex(p - 1)}
                        onPageSizeChange={(n) => table.setPageSize(n)}
                        isDisabled={isLoading}
                        noun="users"
                    />
                </CardFooter>
            </Card>
            </QueryState>

            <AddAuthUserModal
                isOpen={isAddUserModalOpen}
                onClose={handleCloseModal}
                userToEdit={userToEdit}
            />

            <Dialog open={Boolean(resetUser)} onOpenChange={(open) => (!open ? setResetUser(null) : null)}>
                <DialogContent className="sm:max-w-[520px]">
                    <DialogHeader>
                        <DialogTitle>Reset password</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                            Set a new password for <span className="font-medium text-foreground">{resetUser?.username}</span>. The user will be required to change it at next login.
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="newPassword">New password</Label>
                            <Input
                                id="newPassword"
                                type="password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                placeholder="At least 8 characters"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setResetUser(null)}
                            disabled={resetAuthUserPasswordMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                if (!resetUser) return;
                                if (newPassword.trim().length < 8) {
                                    notify.error("Invalid password", "Password must be at least 8 characters.");
                                    return;
                                }
                                await resetAuthUserPasswordMutation.mutateAsync({
                                    id: resetUser.id,
                                    newPassword: newPassword.trim(),
                                    mustChangePassword: true,
                                });
                                setResetUser(null);
                                setNewPassword("");
                            }}
                            disabled={resetAuthUserPasswordMutation.isPending}
                        >
                            Reset password
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user
                            account and remove their data from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default AuthUsersComponent;
