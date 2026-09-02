import React from 'react';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Edit, Trash2, CalendarPlus, Copy, ExternalLink, Clock, ShieldAlert, Cpu } from 'lucide-react';
import Loader from '@/components/ui/loader';
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import type { User } from "@/types/api";
import { getUserHealth } from "@/lib/userHealth";
import MonthlyCycleCell from "@/components/MonthlyCycleCell";
import StatusPill from "@/components/StatusPill";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

interface UserCardProps {
    user: User;
    onEdit: () => void;
    onDelete: () => void;
    onResetMAC?: () => void;
    onResetQuota?: () => void;
    onResetMonthly?: () => void;
    onRenew?: () => void;
    isResettingMAC?: boolean;
    isSelected?: boolean;
    onToggleSelected?: (selected: boolean) => void;
    canManageUsers?: boolean;
    manageUsersReason?: string;
    canResetMac?: boolean;
    canResetDailyQuota?: boolean;
    canResetMonthlyQuota?: boolean;
    recentRejectCount?: number;
}

const getProfileBadge = (profileName?: string) => {
    const name = profileName || "Basic";
    const colorMap: Record<string, string> = {
        Basic: "bg-slate-500/10 border-slate-500/30 text-slate-400",
        Premium: "bg-violet-500/10 border-violet-400/30 text-violet-400",
        Business: "bg-sky-500/10 border-sky-400/30 text-sky-400",
        VIP: "bg-amber-500/10 border-amber-400/30 text-amber-400 font-semibold",
    };
    const color = colorMap[name] || "bg-muted/40 border-border text-muted-foreground";
    return (
        <Badge variant="outline" className={`${color} h-5 rounded-md px-2 text-[10px] font-medium border`}>
            {name}
        </Badge>
    );
};

function CardOnlineBadge({ online }: { online: boolean }) {
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

const UserCard: React.FC<UserCardProps> = ({
    user,
    onEdit,
    onDelete,
    onResetMAC,
    onResetQuota,
    onResetMonthly,
    onRenew,
    isResettingMAC,
    isSelected,
    onToggleSelected,
    canManageUsers = true,
    manageUsersReason = "You don't have permission to manage users.",
    canResetMac = true,
    canResetDailyQuota = true,
    canResetMonthlyQuota = true,
    recentRejectCount,
}) => {
    const router = useRouter();
    const health = getUserHealth(user);
    const initial = (user.userDetails?.fullName || user.username || "?")[0].toUpperCase();

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text).then(
            () => notify.success("Copied", `${label} copied to clipboard`),
            () => notify.error("Copy failed", "Could not copy to clipboard")
        );
    };

    return (
        <Card className={cn(
            "group relative overflow-hidden rounded-2xl bg-card/95 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between border-y border-r border-border/60",
            user.isOnline ? "border-l-4 border-l-emerald-500 hover:border-emerald-400" : "border-l-4 border-l-red-500 hover:border-red-400"
        )}>
            {/* Top Bar / Header */}
            <div>
                <div className="flex items-center justify-between gap-3 border-b border-border/40 bg-gradient-to-r from-violet-500/10 via-indigo-500/5 to-transparent p-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                        <Checkbox
                            checked={Boolean(isSelected)}
                            onCheckedChange={(v) => onToggleSelected?.(Boolean(v))}
                            aria-label="Select user"
                            className="shrink-0"
                        />
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-sm shadow-md ring-2 ring-violet-500/20 group-hover:scale-105 transition-transform">
                            {initial}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    className="truncate text-left text-sm font-bold text-foreground hover:text-primary transition-colors max-w-[140px]"
                                    onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                                    title="View user"
                                >
                                    {user.username}
                                </button>
                                <span className="font-mono text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                                    #{user.id}
                                </span>
                            </div>
                            {user.userDetails?.fullName && (
                                <p className="truncate text-xs text-muted-foreground max-w-[150px]">
                                    {user.userDetails.fullName}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <CardOnlineBadge online={Boolean(user.isOnline)} />
                        <StatusPill
                            label={user.accountStatus}
                            tone={user.accountStatus?.toLowerCase() === "active" ? "success" : user.accountStatus?.toLowerCase() === "suspended" ? "danger" : "warning"}
                            dot
                            className="h-4 rounded-full px-1.5 text-[9px]"
                        />
                    </div>
                </div>

                {/* Card Content Body */}
                <CardContent className="p-3.5 space-y-3">
                    {/* Profile & Health Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            {getProfileBadge(user.profile?.profileName)}
                            <Badge
                                variant="outline"
                                className={`h-5 rounded-md px-1.5 text-[10px] ${
                                    health.level === "healthy"
                                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                                        : health.level === "warning"
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                                        : "border-red-500/30 bg-red-500/10 text-red-500"
                                }`}
                                title={health.reason}
                            >
                                {health.label}
                            </Badge>
                            {recentRejectCount ? (
                                <Badge
                                    variant="outline"
                                    className="h-5 rounded-md border-red-500/30 bg-red-500/10 px-1.5 text-[10px] text-red-500"
                                    title="Auth failures in the last 24 hours"
                                >
                                    <ShieldAlert className="mr-1 h-3 w-3" />
                                    {recentRejectCount}
                                </Badge>
                            ) : null}
                        </div>

                        {/* MAC address with copy */}
                        {user.macAddress?.macAddress && (
                            <button
                                type="button"
                                onClick={() => copyToClipboard(user.macAddress!.macAddress!, "MAC address")}
                                className="inline-flex items-center gap-1 rounded-md border border-border/50 bg-muted/30 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                title="Click to copy MAC address"
                            >
                                <Cpu className="h-3 w-3" />
                                <span className="truncate max-w-[100px]">{user.macAddress.macAddress}</span>
                                <Copy className="h-2.5 w-2.5 opacity-60" />
                            </button>
                        )}
                    </div>

                    {/* Monthly Cycle Progress Box */}
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-2.5 space-y-1">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                            Monthly Cycle & Quota
                        </span>
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
                    </div>

                    {/* Last Active Timestamp */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px]">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground/70" />
                            Last active:
                        </span>
                        <span className="font-medium text-[11px]">
                            {user.lastTimeActive ? new Date(user.lastTimeActive).toLocaleString() : "—"}
                        </span>
                    </div>
                </CardContent>
            </div>

            {/* Footer Quick Actions */}
            <CardFooter className="border-t border-border/40 bg-muted/10 p-2.5 flex flex-wrap gap-1.5 items-center justify-between">
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        onClick={() => router.push(`/users/${encodeURIComponent(user.username)}`)}
                        title="Open User Detail"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-xs gap-1 hover:bg-muted"
                        onClick={onEdit}
                        disabled={!canManageUsers}
                        title={!canManageUsers ? manageUsersReason : "Edit User"}
                    >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-1">
                    {onResetMAC && user.macAddress?.macAddress && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1 border-border/60"
                            onClick={onResetMAC}
                            disabled={Boolean(isResettingMAC) || !canManageUsers || !canResetMac}
                            title="Reset MAC Address"
                        >
                            {isResettingMAC ? <Loader /> : <RefreshCw className="h-3.5 w-3.5" />}
                            MAC
                        </Button>
                    )}
                    {onResetQuota && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1 border-border/60"
                            onClick={onResetQuota}
                            disabled={!canResetDailyQuota}
                            title={!canResetDailyQuota ? "You don't have permission to reset daily quota." : "Reset Daily Quota"}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Quota
                        </Button>
                    )}
                    {onResetMonthly && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1 border-border/60"
                            onClick={onResetMonthly}
                            disabled={!canResetMonthlyQuota}
                            title={!canResetMonthlyQuota ? "You don't have permission to reset monthly quota." : "Reset Monthly Traffic"}
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Monthly
                        </Button>
                    )}
                    {onRenew && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2 text-xs gap-1 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                            onClick={onRenew}
                            disabled={!canManageUsers}
                            title="Renew +1 month"
                        >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            Renew
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onDelete}
                        disabled={!canManageUsers}
                        title={!canManageUsers ? manageUsersReason : "Delete user"}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </CardFooter>
        </Card>
    );
};

export default UserCard;