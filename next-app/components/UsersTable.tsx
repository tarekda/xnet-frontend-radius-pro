import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, Trash2, ArrowUpDown, Copy, User as UserIcon, ExternalLink, CalendarPlus, LayoutGrid, List, X } from 'lucide-react';
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

function UserOnlineBadge({ online }: { online: boolean }) {
    if (online) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                Online
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
            Offline
        </span>
    );
}

const UserRow: React.FC<{
    user: User;
    onAction: (action: string, user: User) => void;
    index?: number;
    isSelected?: boolean;
    onToggleSelected?: (userId: number, selected: boolean) => void;
    canManageUsers?: boolean;
    manageUsersReason?: string;
    canResetDailyQuota?: boolean;
    canResetMonthlyQuota?: boolean;
    recentRejectCounts?: Record<string, number>;
}> = ({ user, onAction, isSelected, onToggleSelected, canManageUsers = true, manageUsersReason = "You don't have permission to manage users.", canResetDailyQuota = true, canResetMonthlyQuota = true, recentRejectCounts }) => {
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

    const initial = (user.userDetails?.fullName || user.username || "?")[0].toUpperCase();

    return (
        <TableRow 
            className="group transition-all duration-200 hover:shadow-lg cursor-pointer"
        >
            {/* First Cell: Select Checkbox */}
            <TableCell className={cn(
                "w-[38px] px-3.5 py-3 rounded-l-2xl border-y group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all",
                user.isOnline ? "border-l-4 border-l-emerald-500 border-y-border/50" : "border-l-4 border-l-red-500 border-y-border/50"
            )}>
                <Checkbox
                    checked={Boolean(isSelected)}
                    onCheckedChange={(v) => onToggleSelected?.(user.id, Boolean(v))}
                    aria-label="Select user"
                />
            </TableCell>

            {/* ID Cell */}
            <TableCell className="px-3 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 font-mono text-xs text-muted-foreground transition-all">
                #{user.id}
            </TableCell>
            
            {/* User Info Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-xs font-bold text-white shadow-md ring-2 ring-violet-500/20 group-hover:scale-105 transition-transform">
                        {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                        <button
                            type="button"
                            className="text-left text-sm font-bold text-foreground hover:text-primary transition-colors block truncate max-w-[180px]"
                            onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                            title="View user"
                        >
                            {user.username}
                        </button>
                        {user.userDetails?.fullName && (
                            <span className="text-xs text-muted-foreground block truncate max-w-[180px]">
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
                                className="border-red-500 text-red-600 dark:text-red-400 text-[10px]"
                                title="Auth failures in the last 24 hours"
                              >
                                Rejects ({recentRejectCounts[user.username]})
                              </Badge>
                            ) : null}
                        </span>
                    </div>
                </div>
            </TableCell>

            {/* Status Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div>
                                <UserOnlineBadge online={Boolean(user.isOnline)} />
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

            {/* Last Active Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <span className="whitespace-nowrap text-xs text-muted-foreground font-medium">
                    {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                </span>
            </TableCell>

            {/* Profile Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger>
                                {getProfileBadge(user.profile?.profileName)}
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Daily Quota: {user.profile?.dailyQuota}</p>
                                <p>Monthly Quota: {user.profile?.monthlyQuota}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </TableCell>

            {/* Monthly Cycle Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
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

            {/* Account Status Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <StatusPill
                    label={user.accountStatus}
                    tone={user.accountStatus.toLowerCase() === "active" ? "success" : user.accountStatus.toLowerCase() === "suspended" ? "danger" : "warning"}
                    dot
                    className="h-5 rounded-full px-2 text-[10px]"
                />
            </TableCell>

            {/* MAC Address Cell */}
            <TableCell className="px-4 py-3 border-y border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 transition-all">
                <span className="font-mono text-xs text-muted-foreground">
                    {user.macAddress?.macAddress || 'N/A'}
                </span>
            </TableCell>

            <TableCell align="right" className="px-3 py-3 rounded-r-2xl border-y border-r border-border/50 group-hover:border-primary/40 bg-card/95 group-hover:bg-muted/30 text-right transition-all">
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

    const [displayMode, setDisplayMode] = useState<'cards' | 'table'>('table');

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
            <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-none">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 bg-muted/20">
                    <TableToolbar label={totalUsers ? `${totalUsers} users` : "No users"} />
                    <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
                        <Button
                            type="button"
                            variant={displayMode === "cards" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-3 text-xs gap-1.5 font-medium rounded-lg"
                            onClick={() => setDisplayMode("cards")}
                        >
                            <LayoutGrid className="h-3.5 w-3.5" />
                            Fancy Cards
                        </Button>
                        <Button
                            type="button"
                            variant={displayMode === "table" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 px-3 text-xs gap-1.5 font-medium rounded-lg"
                            onClick={() => setDisplayMode("table")}
                        >
                            <List className="h-3.5 w-3.5" />
                            Table View
                        </Button>
                    </div>
                </div>

                {displayMode === 'cards' ? (
                    <div className="p-4">
                        {displayUsers.length === 0 ? (
                            <EmptyState
                                title="No users found"
                                description="Try changing filters or search terms."
                            />
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
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
                                        recentRejectCount={recentRejectCounts?.[user.username]}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="min-w-[768px]">
                        <div className="max-h-[70vh] overflow-auto">
                            {displayUsers.length === 0 ? (
                                <div className="p-4">
                                    <EmptyState
                                        title="No users found"
                                        description="Try changing filters or search terms."
                                    />
                                </div>
                            ) : (
                            <Table className="w-full border-separate border-spacing-y-2.5 px-4 pb-4">
                                <TableHeader className="sticky top-0 z-10 bg-card/90 backdrop-blur">
                                    <TableRow className="border-none hover:bg-transparent">
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
                )}
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

            {/* Multi-Select Floating Action Dock */}
            {selectedUserIds && selectedUserIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl border border-violet-500/40 bg-zinc-950/90 backdrop-blur-md px-5 py-3 shadow-2xl text-white animate-in slide-in-from-bottom-5">
                    <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-500 font-bold text-xs">
                            {selectedUserIds.size}
                        </span>
                        <span className="text-xs font-medium">user(s) selected</span>
                    </div>

                    <div className="h-4 w-px bg-white/20" />

                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-3 text-xs gap-1.5 font-medium rounded-xl"
                            onClick={() => {
                                const selected = displayUsers.filter((u) => selectedUserIds.has(u.id));
                                selected.forEach((u) => onAction("renew", u));
                            }}
                        >
                            <CalendarPlus className="h-3.5 w-3.5 text-emerald-400" />
                            Bulk Renew +1m
                        </Button>

                        <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 px-3 text-xs gap-1.5 font-medium rounded-xl"
                            onClick={() => {
                                const selected = displayUsers.filter((u) => selectedUserIds.has(u.id));
                                selected.forEach((u) => onAction("reset-mac", u));
                            }}
                        >
                            <RefreshCw className="h-3.5 w-3.5 text-blue-400" />
                            Reset MAC
                        </Button>

                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 px-2.5 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-xl"
                            onClick={() => {
                                displayUsers.forEach((u) => onToggleSelected?.(u.id, false));
                            }}
                        >
                            <X className="h-3.5 w-3.5" />
                            Deselect All
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsersTable;