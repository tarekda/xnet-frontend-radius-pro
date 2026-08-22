import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, Trash2, ArrowUpDown, ChevronDown, ChevronUp, Mail, Phone, MapPin, Copy, User as UserIcon, ExternalLink, CalendarPlus } from 'lucide-react';
import { User } from '../types/api';

/** Same rules as user detail Renew +1 month. */
export function canRenewUserSubscription(user: User): boolean {
    const st = String(user.accountStatus ?? "").trim().toLowerCase();
    if (st === "suspended" || st === "terminated") return false;
    if (st === "expired") return true;
    if (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) return true;
    return false;
}
import { UseMutationResult } from '@tanstack/react-query';
import UserCard from './UserCard';
import { ColumnDef, flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, SortingState, useReactTable } from '@tanstack/react-table';
import { ariaSortFor } from '@/lib/tableA11y';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import EmptyState from "@/components/EmptyState";
import TableSkeleton from "@/components/ui/TableSkeleton";
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
    "h-7 -ml-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/70 hover:text-foreground";

const getProfileBadge = (profileName: string) => {
    const colorMap: { [key: string]: string } = {
        Basic:
            "bg-muted text-foreground hover:bg-muted/80 dark:bg-muted/50 dark:hover:bg-muted/70",
        Premium:
            "border-primary/20 bg-primary/8 text-primary hover:bg-primary/12",
        Business:
            "border-primary/20 bg-primary/8 text-primary hover:bg-primary/12",
        VIP:
            "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-200 dark:hover:bg-yellow-950/55",
        default:
            "bg-muted text-foreground hover:bg-muted/80 dark:bg-muted/50 dark:hover:bg-muted/70",
    };

    const color = colorMap[profileName] || colorMap.default;
    return <Badge variant="outline" className={`${color} h-5 rounded px-1.5 text-[10px] font-medium transition-colors`}>{profileName}</Badge>;
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
                    "border-border/50 transition-colors",
                    index % 2 === 0 ? "bg-card" : "bg-muted/15",
                    "hover:bg-primary/[0.04]",
                    // Expanded state
                    isExpanded && "bg-primary/[0.06]",
                    user.isOnline && "border-l-2 border-l-primary/60",
                    !user.isOnline && "border-l-2 border-l-border"
                )}
            >
                <TableCell className="w-[38px] px-2 py-2">
                    <Checkbox
                        checked={Boolean(isSelected)}
                        onCheckedChange={(v) => onToggleSelected?.(user.id, Boolean(v))}
                        aria-label="Select user"
                    />
                </TableCell>
                <TableCell className="px-2 py-2">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-7 w-7 p-0",
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
                        <span className="font-mono text-xs text-muted-foreground">{user.id}</span>
                    </div>
                </TableCell>
                
                <TableCell className="px-2 py-2">
                    <div className="flex flex-col">
                        <button
                            type="button"
                            className="text-left text-sm font-semibold text-foreground hover:text-primary"
                            onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                            title="View user"
                        >
                            {user.username}
                        </button>
                        {user.userDetails?.fullName && (
                            <span className="text-xs text-muted-foreground">
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

                <TableCell className="px-2 py-2">
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

                <TableCell className="px-2 py-2">
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                    </span>
                </TableCell>

                <TableCell className="px-2 py-2">
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

                <TableCell className="px-2 py-2">
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

                <TableCell className="px-2 py-2">
                    <StatusPill
                        label={user.accountStatus}
                        tone={user.accountStatus.toLowerCase() === "active" ? "success" : user.accountStatus.toLowerCase() === "suspended" ? "danger" : "warning"}
                        dot
                        className="h-5 rounded px-1.5 text-[10px]"
                    />
                </TableCell>

                <TableCell className="px-2 py-2">
                    <span className="font-mono text-xs text-muted-foreground">
                        {user.macAddress?.macAddress || 'N/A'}
                    </span>
                </TableCell>

                <TableCell align="right" className="px-2 py-2 text-right">
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
                            ...(canRenewUserSubscription(user)
                                ? [{
                                    label: "Renew +1 month",
                                    icon: CalendarPlus,
                                    onClick: () => onAction("renew", user),
                                    disabled: !canManageUsers,
                                    disabledReason: !canManageUsers ? manageUsersReason : undefined,
                                }]
                                : []),
                            { label: "Edit", icon: Edit, onClick: () => onAction("edit", user), disabled: !canManageUsers, disabledReason: manageUsersReason },
                            { label: "Delete", icon: Trash2, onClick: () => onAction("delete", user), tone: "destructive", disabled: !canManageUsers, disabledReason: manageUsersReason },
                        ]}
                    />
                </TableCell>
            </TableRow>

            {isExpanded && (
                <TableRow className="border-y border-border/60 bg-muted/20">
                    <TableCell colSpan={10}>
                        <div className="space-y-3 p-3">
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                <div className="space-y-2 rounded-md border border-border/60 bg-card p-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Profile Details</h4>
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

                                <div className="space-y-2 rounded-md border border-border/60 bg-card p-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">Contact Information</h4>
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

                                <div className="space-y-2 rounded-md border border-border/60 bg-card p-3">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-primary">System Details</h4>
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

    const displayUsers = table.getSortedRowModel().rows.map((r) => r.original);

    if (isLoading) {
        return <TableSkeleton columns={6} rows={8} showToolbar={true} />;
    }

    return (
        <div>
            <div className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-none">
                <TableToolbar label={totalUsers ? `${totalUsers} users` : "No users"} />

                <div className="min-w-[768px] hidden md:block">
                    <div className="max-h-[70vh] overflow-auto">
                        {displayUsers.length === 0 ? (
                            <div className="p-4">
                                <EmptyState
                                    title="No users found"
                                    description="Try changing filters or search terms."
                                />
                            </div>
                        ) : (
                        <Table>
                            <TableHeader className="sticky top-0 z-10 border-b border-border/60 bg-muted/90 backdrop-blur">
                                <TableRow className="border-b border-border/35 hover:bg-transparent dark:border-border/50">
                                    {table.getHeaderGroups().map((headerGroup) => (
                                        headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="h-9 px-2 py-1.5 text-left align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                                                aria-sort={ariaSortFor(header)}
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
                                    <TableHead className="h-9 px-2 py-1.5 text-right align-middle text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
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

            <div className="mt-3 space-y-3 md:hidden">
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
                        onRenew={canRenewUserSubscription(user) ? () => onAction('renew', user) : undefined}
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