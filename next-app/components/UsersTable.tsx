import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, Trash2, ArrowUpDown, ChevronDown, ChevronUp, Mail, Phone, MapPin, Copy, User as UserIcon, ExternalLink } from 'lucide-react';
import { User } from '../types/api';
import { UseMutationResult } from '@tanstack/react-query';
import UserCard from './UserCard';
import { ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmptyState from "@/components/EmptyState";
import StatusPill from "@/components/StatusPill";
import TableToolbar from "@/components/TableToolbar";
import TablePager from "@/components/TablePager";
import TableRowActions from "@/components/TableRowActions";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { notify } from "@/lib/notify";
import { getUserHealth } from "@/lib/userHealth";
import MonthlyCycleCell from "@/components/MonthlyCycleCell";

interface UsersTableProps {
    users: User[];
    currentPage: number;
    totalPages: number;
    totalUsers: number;
    onPageChange: (page: number) => void;
    onAction: (action: string, user: User) => void;
    isLoading: boolean;
    deleteUserMutation: UseMutationResult<any, unknown, string, unknown>;
    resetMacAddressMutation: UseMutationResult<any, unknown, string, unknown>;
    selectedUserIds?: Set<number>;
    onToggleSelected?: (userId: number, selected: boolean) => void;
    onToggleSelectAll?: (selected: boolean) => void;
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    canManageUsers?: boolean;
    manageUsersReason?: string;
    canResetDailyQuota?: boolean;
    canResetMonthlyQuota?: boolean;
    recentRejectCounts?: Record<string, number>;
}
const sortHeaderButtonClass =
    "h-9 -ml-1 font-semibold text-foreground/90 hover:bg-muted/70 dark:text-foreground/95 dark:hover:bg-muted/45";

const getProfileBadge = (profileName: string) => {
    const colorMap: { [key: string]: string } = {
        Basic:
            "bg-muted text-foreground hover:bg-muted/80 dark:bg-muted/50 dark:hover:bg-muted/70",
        Premium:
            "bg-purple-100 text-purple-800 hover:bg-purple-200 dark:bg-purple-950/45 dark:text-purple-200 dark:hover:bg-purple-950/60",
        Business:
            "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-950/45 dark:text-blue-200 dark:hover:bg-blue-950/60",
        VIP:
            "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:hover:bg-yellow-950/55",
        default:
            "bg-muted text-foreground hover:bg-muted/80 dark:bg-muted/50 dark:hover:bg-muted/70",
    };

    const color = colorMap[profileName] || colorMap.default;
    return <Badge className={`${color} transition-colors duration-200`}>{profileName}</Badge>;
};

const UserRow: React.FC<{
    user: User;
    onAction: (action: string, user: User) => void;
    index: number;
    isSelected?: boolean;
    onToggleSelected?: (userId: number, selected: boolean) => void;
    canManageUsers?: boolean;
    manageUsersReason?: string;
    canResetDailyQuota?: boolean;
    canResetMonthlyQuota?: boolean;
    recentRejectCounts?: Record<string, number>;
}> = ({ user, onAction, index, isSelected, onToggleSelected, canManageUsers = true, manageUsersReason = "You don't have permission to manage users.", canResetDailyQuota = true, canResetMonthlyQuota = true, recentRejectCounts }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const router = useRouter();
    const health = getUserHealth(user);
    const healthBadgeClass = cn(
        "transition-colors duration-200 text-xs",
        health.level === "healthy" &&
          "border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40",
        health.level === "warning" &&
          "border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/35",
        health.level === "risk" && "border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/35"
    );

    return (
        <>
            <TableRow 
                className={cn(
                    "transition-colors duration-200",
                    // Base color alternating rows
                    index % 2 === 0 ? "bg-card" : "bg-muted/35",
                    // Hover state
                    "hover:bg-muted/60 dark:hover:bg-muted/45",
                    // Expanded state
                    isExpanded && "border-l-2 border-l-primary bg-muted/55 dark:bg-muted/40",
                    // Status-based highlighting
                    user.accountStatus.toLowerCase() === "suspended" &&
                      "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/45",
                    user.accountStatus.toLowerCase() === "inactive" &&
                      "bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/25 dark:hover:bg-yellow-950/40",
                    // Online status subtle highlight
                    user.isOnline && "border-l-2 border-l-blue-500",
                    !user.isOnline && "border-l-2 border-l-red-600"
                )}
            >
                <TableCell className="w-[44px]">
                    <Checkbox
                        checked={Boolean(isSelected)}
                        onCheckedChange={(v) => onToggleSelected?.(user.id, Boolean(v))}
                        aria-label="Select user"
                    />
                </TableCell>
                <TableCell>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 w-8 p-0",
                                isExpanded && "bg-primary/10 hover:bg-primary/20",
                                !isExpanded && "hover:bg-muted dark:hover:bg-muted/50"
                            )}
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                        <span className="font-mono text-sm">{user.id}</span>
                    </div>
                </TableCell>
                
                <TableCell>
                    <div className="flex flex-col">
                        <button
                            type="button"
                            className="text-left font-semibold text-primary hover:text-primary/80"
                            onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                            title="View user"
                        >
                            {user.username}
                        </button>
                        {user.userDetails?.fullName && (
                            <span className="text-sm text-muted-foreground">
                                {user.userDetails.fullName}
                            </span>
                        )}
                        <span className="mt-1 flex flex-wrap gap-1">
                            <Badge variant="outline" className={healthBadgeClass} title={health.reason}>
                                {health.label}
                            </Badge>
                            {recentRejectCounts?.[user.username] ? (
                              <Badge
                                variant="outline"
                                className="border-red-500 text-red-600 dark:text-red-400"
                                title="Auth failures in the last 24 hours"
                              >
                                Recent rejects ({recentRejectCounts[user.username]})
                              </Badge>
                            ) : null}
                        </span>
                    </div>
                </TableCell>

                <TableCell>
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div>
                                    <StatusPill
                                        label={user.isOnline ? "Online" : "Offline"}
                                        tone={user.isOnline ? "info" : "default"}
                                        dot
                                        pulseDot={Boolean(user.isOnline)}
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{user.isOnline ? 'User is currently connected' : 'User is not connected'}</p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Last active: {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </TableCell>

                <TableCell>
                    <span className="text-sm text-muted-foreground">
                        {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                    </span>
                </TableCell>

                <TableCell>
                    <div className="flex items-center gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger>
                                    {getProfileBadge(user.profile.profileName)}
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Daily Quota: {user.profile.dailyQuota}</p>
                                    <p>Monthly Quota: {user.profile.monthlyQuota}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </TableCell>

                <TableCell>
                    <MonthlyCycleCell
                        monthlyUsage={user.monthlyUsage}
                        monthlyQuota={user.profile?.monthlyQuota}
                        monthlyCycleStart={user.monthlyCycleStart}
                        monthlyCycleResetAt={user.monthlyCycleResetAt}
                        quotaResetDay={user.quotaResetDay}
                        quotaCycleStartDate={user.quotaCycleStartDate}
                        isMonthlyExceeded={user.isMonthlyExceeded}
                        isMonthlyExceededComputed={user.isMonthlyExceededComputed}
                        monthlyUsagePct={user.monthlyUsagePct}
                    />
                </TableCell>

                <TableCell>
                    <Badge variant="outline" className={cn(
                        "transition-colors duration-200",
                        user.accountStatus.toLowerCase() === 'active' && "border-green-500 text-green-500 hover:bg-green-50",
                        user.accountStatus.toLowerCase() === 'suspended' && "border-red-500 text-red-500 hover:bg-red-50",
                        user.accountStatus.toLowerCase() === 'inactive' && "border-yellow-500 text-yellow-500 hover:bg-yellow-50"
                    )}>
                        {user.accountStatus}
                    </Badge>
                </TableCell>

                <TableCell>
                    <span className="font-mono text-sm">
                        {user.macAddress?.macAddress || 'N/A'}
                    </span>
                </TableCell>

                <TableCell align="right" className="text-right">
                    <TableRowActions
                        actions={[
                            {
                                label: "Open user",
                                icon: ExternalLink,
                                onClick: () => router.push(`/users/${encodeURIComponent(user.username)}`),
                            },
                            {
                                label: "Copy Username",
                                icon: UserIcon,
                                onClick: () => {
                                    navigator.clipboard.writeText(user.username).then(
                                        () => notify.success("Copied", "Username copied to clipboard"),
                                        () => notify.error("Copy failed", "Could not copy to clipboard")
                                    );
                                },
                            },
                            {
                                label: "Copy MAC",
                                icon: Copy,
                                onClick: () => {
                                    const mac = user.macAddress?.macAddress || "";
                                    if (mac) {
                                        navigator.clipboard.writeText(mac).then(
                                            () => notify.success("Copied", "MAC address copied to clipboard"),
                                            () => notify.error("Copy failed", "Could not copy to clipboard")
                                        );
                                    }
                                },
                                disabled: !user.macAddress?.macAddress,
                                disabledReason: "No MAC bound for this user",
                            },
                            {
                                label: "Reset MAC",
                                icon: RefreshCw,
                                onClick: () => onAction("reset-mac", user),
                                disabled: !canManageUsers || !user.macAddress?.macAddress,
                                disabledReason: !canManageUsers ? manageUsersReason : "No MAC is currently bound for this user.",
                            },
                            { label: "Reset Quota", icon: RefreshCw, onClick: () => onAction("reset-quota", user), disabled: !canResetDailyQuota, disabledReason: !canResetDailyQuota ? "You don't have permission to reset daily quota." : undefined },
                            { label: "Reset Monthly", icon: RefreshCw, onClick: () => onAction("reset-monthly", user), disabled: !canResetMonthlyQuota, disabledReason: !canResetMonthlyQuota ? "You don't have permission to reset monthly quota." : undefined },
                            { label: "Edit", icon: Edit, onClick: () => onAction("edit", user), disabled: !canManageUsers, disabledReason: manageUsersReason },
                            { label: "Delete", icon: Trash2, onClick: () => onAction("delete", user), tone: "destructive", disabled: !canManageUsers, disabledReason: manageUsersReason },
                        ]}
                    />
                </TableCell>
            </TableRow>

            {isExpanded && (
                <TableRow className="border-y border-border bg-muted/40 dark:bg-muted/30">
                    <TableCell colSpan={10}>
                        <div className="space-y-4 p-4">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                                    <h4 className="font-semibold text-primary">Profile Details</h4>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            Daily Quota: {user.profile.dailyQuota}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Monthly Quota: {user.profile.monthlyQuota}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Quota Reset Day: {user.quotaResetDay}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Monthly usage: {user.monthlyUsage && user.profile?.monthlyQuota
                                                ? `${user.monthlyUsage} / ${user.profile.monthlyQuota}`
                                                : "—"}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Resets: {user.monthlyCycleResetAt ?? "—"}
                                        </p>
                                        {user.quotaCycleStartDate ? (
                                            <p className="text-sm text-muted-foreground">
                                                Manual cycle start: {user.quotaCycleStartDate}
                                            </p>
                                        ) : null}
                                    </div>
                                </div>

                                <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                                    <h4 className="font-semibold text-primary">Contact Information</h4>
                                    <div className="space-y-1">
                                        {user.userDetails?.email && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Mail className="h-4 w-4" />
                                                <span>{user.userDetails.email}</span>
                                            </div>
                                        )}
                                        {user.userDetails?.phoneNumber && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Phone className="h-4 w-4" />
                                                <span>{user.userDetails.phoneNumber}</span>
                                            </div>
                                        )}
                                        {user.userDetails?.address && (
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <MapPin className="h-4 w-4" />
                                                <span>{user.userDetails.address}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
                                    <h4 className="font-semibold text-primary">System Details</h4>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">
                                            Profile ID: {user.profileId}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Fallback: {user.isFallback ? 'Yes' : 'No'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Last Active: {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
};

const UsersTable: React.FC<UsersTableProps> = ({
    users,
    currentPage,
    totalPages,
    totalUsers,
    onPageChange,
    onAction,
    isLoading,
    resetMacAddressMutation,
    selectedUserIds,
    onToggleSelected,
    onToggleSelectAll,
    pageSize = 100,
    onPageSizeChange,
    canManageUsers = true,
    manageUsersReason = "You don't have permission to manage users.",
    canResetDailyQuota = true,
    canResetMonthlyQuota = true,
    recentRejectCounts,
}) => {
    const [sorting, setSorting] = useState<SortingState>([]);
    const pageSizes = [10, 20, 50, 100,200,500];

    const allSelected = Boolean(users.length) && Boolean(selectedUserIds) && selectedUserIds!.size === users.length;
    const someSelected = Boolean(selectedUserIds) && selectedUserIds!.size > 0 && !allSelected;

    const columns: ColumnDef<User>[] = [
        {
            id: "select",
            header: () => (
                <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    onCheckedChange={(v) => onToggleSelectAll?.(Boolean(v))}
                    aria-label="Select all users"
                />
            ),
            cell: () => null,
            enableSorting: false,
        },
        {
            accessorKey: "id",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className={sortHeaderButtonClass}
                    >
                        ID
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                )
            },
        },
        {
            accessorKey: "username",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className={sortHeaderButtonClass}
                    >
                        User
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                )
            },
        },
        {
            accessorKey: "isOnline",
            header: "Status",
        },
        {
            accessorKey: "lastTimeActive",
            header: "Last Active",
        },
        {
            accessorKey: "profile.profileName",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className={sortHeaderButtonClass}
                    >
                        Profile
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                )
            },
        },
        {
            id: "monthlyCycle",
            accessorFn: (row) => row.monthlyUsagePct ?? 0,
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className={sortHeaderButtonClass}
                >
                    Monthly Cycle
                    <ArrowUpDown className="ml-2 h-4 w-4 opacity-70" />
                </Button>
            ),
        },
        {
            accessorKey: "accountStatus",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className={sortHeaderButtonClass}
                    >
                        Account
                        <ArrowUpDown className="ml-2 h-4 w-4 opacity-70" />
                    </Button>
                )
            },
        },
        {
            accessorKey: "macAddress.macAddress",
            header: "MAC Address",
        },
    ];

    const table = useReactTable({
        data: users,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        state: {
            sorting,
        },
        initialState: {
            pagination: {
                pageSize: pageSize,
            },
        },
    });

    // IMPORTANT:
    // The headers were toggling TanStack sorting state, but the table body was rendering `users` directly.
    // Use the sorted row model as the source of truth for the displayed rows.
    const displayUsers = table.getSortedRowModel().rows.map((r) => r.original);

    return (
        <div>
            <div className="overflow-hidden rounded-md border border-border/60 bg-card/30 shadow-sm dark:border-border/60 dark:bg-card/40">
                <TableToolbar label={displayUsers.length ? `${displayUsers.length} users` : "No users"} />

                <div className="min-w-[768px] hidden md:block">
                    <div className="max-h-[70vh] overflow-x-auto">
                        {displayUsers.length === 0 ? (
                            <div className="p-4">
                                <EmptyState
                                    title="No users found"
                                    description="Try changing filters or search terms."
                                />
                            </div>
                        ) : (
                        <Table>
                            <TableHeader className="sticky top-0 z-10 border-b border-border bg-card/95 shadow-sm backdrop-blur-sm dark:border-border/55 dark:bg-muted/40 dark:backdrop-blur-md">
                                <TableRow className="border-b border-border/35 hover:bg-transparent dark:border-border/50">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="px-3 py-3 text-left align-middle font-semibold text-foreground/90 dark:text-foreground/95"
                                            >
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        ))
                                    ))}
                                    <TableHead className="px-3 py-3 text-right align-middle font-semibold text-foreground/90 dark:text-foreground/95">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayUsers.map((user, index) => (
                                    <UserRow 
                                        key={user.id} 
                                        user={user} 
                                        onAction={onAction}
                                        index={index}
                                        isSelected={selectedUserIds?.has(user.id)}
                                        onToggleSelected={onToggleSelected}
                                        canManageUsers={canManageUsers}
                                        manageUsersReason={manageUsersReason}
                                        canResetDailyQuota={canResetDailyQuota}
                                        canResetMonthlyQuota={canResetMonthlyQuota}
                                        recentRejectCounts={recentRejectCounts}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                        )}
                    </div>
                </div>
            </div>

            <div className="mt-4 space-y-4 md:hidden">
                {displayUsers.length === 0 ? (
                    <EmptyState
                        title="No users found"
                        description="Try changing filters or search terms."
                    />
                ) : null}
                {displayUsers.map((user) => (
                    <UserCard
                        key={user.id}
                        user={user}
                        onEdit={() => onAction('edit', user)}
                        onDelete={() => onAction('delete', user)}
                        onResetMAC={() => onAction('reset-mac', user)}
                        onResetQuota={() => onAction('reset-quota', user)}
                        onResetMonthly={() => onAction('reset-monthly', user)}
                        isResettingMAC={resetMacAddressMutation.variables === user.username}
                        isSelected={selectedUserIds?.has(user.id)}
                        onToggleSelected={(checked) => onToggleSelected?.(user.id, checked)}
                        canManageUsers={canManageUsers}
                        manageUsersReason={manageUsersReason}
                        canResetMac={Boolean(user.macAddress?.macAddress)}
                        canResetDailyQuota={canResetDailyQuota}
                        canResetMonthlyQuota={canResetMonthlyQuota}
                    />
                ))}
            </div>

            <TablePager
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalUsers}
                pageSize={pageSize}
                pageSizeOptions={pageSizes}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                isDisabled={isLoading}
                noun="results"
            />
        </div>
    );
};

export default UsersTable;