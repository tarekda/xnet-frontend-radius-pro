// OnlineUsersTable.tsx
import React, {
    useCallback,
    useMemo,
    useEffect,
    useState,
    useRef,
} from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
    OnlineUser,
    useOnlineUsers,
} from "../hooks/useOnlineUsers";

/* ui + icons (paths may differ in your project) */
import {
    Card,
    CardHeader,
    CardContent,
    CardFooter,
    CardTitle,
    CardDescription,
} from "@/components/ui/card";
import {
    Table,
    TableHead,
    TableHeader,
    TableBody,
    TableRow,
    TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Tooltip,
    TooltipProvider,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Loader from "@/components/ui/loader";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/EmptyState";
import StatusPill from "@/components/StatusPill";
import TableToolbar from "@/components/TableToolbar";
import TablePager from "@/components/TablePager";
import TableRowActions from "@/components/TableRowActions";
import QueryState from "@/components/QueryState";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import FilterPills from "@/components/FilterPills";

import {
    Clock,
    Power,
    RefreshCw,
    RotateCw,
    Settings,
    User,
    Wifi,
    HardDrive,
    Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { canAny } from "@/lib/permissions";
import MonthlyCycleCell from "@/components/MonthlyCycleCell";
import { isMonthlyQuotaExceededFromFields, monthlyCycleFieldsFromOnlineUser } from "@/lib/quotaCycle";

const EMPTY_ONLINE_ROWS: OnlineUser[] = [];

export type OnlineSessionStats = { fup: number; monthlyExceeded: number; total: number };

// Disconnect is handled server-side (MikroTik API / radclient fallback).

/* ───────── helpers (same logic you used before) */
const formatBytes = (b: string) => {
    const n = parseInt(b, 10);
    if (!n) return "0 Bytes";
    const k = 1024,
        units = ["Bytes", "KB", "MB", "GB", "TB"],
        i = Math.floor(Math.log(n) / Math.log(k));
    return `${(n / k ** i).toFixed(2)} ${units[i]}`;
};
const pct = (u: string, t: string) => {
    const used = parseInt(u, 10);
    const total = parseInt(t, 10);
    if (!Number.isFinite(total) || total <= 0) return 0;
    if (!Number.isFinite(used) || used <= 0) return 0;
    return Math.min((used / total) * 100, 100);
};
const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400),
        h = Math.floor((s % 86400) / 3600),
        m = Math.floor((s % 3600) / 60),
        sec = s % 60;
    return [d && `${d}d`, h && `${h}h`, m && `${m}m`, sec && `${sec}s`]
        .filter(Boolean)
        .join(" ");
};
const formatAgo = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return "—";
    const sec = Math.max(Math.floor((Date.now() - t) / 1000), 0);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const d = Math.floor(hr / 24);
    return `${d}d ago`;
};
const STALE_AFTER_SECONDS = 60;
const isSessionStale = (iso: string | null | undefined) => {
    const t = iso ? Date.parse(iso) : NaN;
    if (!Number.isFinite(t)) return true;
    return (Date.now() - t) / 1000 > STALE_AFTER_SECONDS;
};
const formatStatus = (s: string) =>
({ active: "Online", idle: "Idle", disconnected: "Disconnected" }[
    s.toLowerCase()
] || s);
const profileClass = (p: string) =>
    p.toLowerCase().includes("premium")
        ? "font-bold text-blue-600 dark:text-blue-400"
        : p.toLowerCase().includes("basic")
            ? "text-violet-600 dark:text-violet-400"
            : "text-foreground/90";
const profileBadge = (p: string, compact = false) => {
    const sizeClass = compact ? "px-1.5 py-0 text-[10px]" : "";
    const l = String(p || "").toLowerCase();
    if (!l || l === "—")
        return (
            <Badge variant="outline" className={cn("border-border bg-muted text-foreground", sizeClass)}>
                —
            </Badge>
        );
    if (l === "fallback" || l.includes("fallback"))
        return (
            <Badge
                variant="outline"
                className={cn(
                    "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/45 dark:text-red-200",
                    sizeClass
                )}
            >
                Fallback
            </Badge>
        );
    if (l === "premium")
        return (
            <Badge
                variant="outline"
                className={cn(
                    "border-yellow-300 bg-yellow-100 text-yellow-900 dark:border-yellow-700 dark:bg-yellow-950/45 dark:text-yellow-100",
                    sizeClass
                )}
            >
                Premium
            </Badge>
        );
    if (l === "basic")
        return (
            <Badge variant="outline" className={cn("border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-200", sizeClass)}>
                Basic
            </Badge>
        );
    if (l === "basicfn")
        return (
            <Badge
              variant="outline"
              className={cn(
                "border-purple-300 bg-purple-100 text-purple-800 dark:border-purple-600 dark:bg-purple-950/45 dark:text-purple-200",
                sizeClass
              )}
            >
                BasicFN
            </Badge>
        );
    return (
            <Badge variant="outline" className={cn("border-border bg-muted text-foreground max-w-[5rem] truncate", sizeClass)} title={p}>
            {p}
        </Badge>
    );
};

const toInt = (value: unknown) => {
    const n = typeof value === "number" ? value : parseInt(String(value ?? "0"), 10);
    return Number.isFinite(n) ? n : 0;
};

const isTruthyFallback = (value: unknown) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    const s = String(value ?? "").trim().toLowerCase();
    return s === "1" || s === "true" || s === "yes";
};

// In some cases fallback profile/quota state appears before is_fallback is consistently reflected.
// Derive FUP status from multiple signals so UI matches effective behavior.
const isFupUser = (u: OnlineUser) => {
    const byFlag = isTruthyFallback((u as any).is_fallback);
    const byProfile = String(u.profile_profile_name ?? "").toLowerCase().includes("fallback");
    const dailyQuota = toInt(u.profile_daily_quota);
    const monthlyQuota = toInt(u.profile_monthly_quota);
    const dailyExceeded = dailyQuota > 0 && toInt(u.real_time_data_usage) >= dailyQuota;
    const monthlyExceeded = monthlyQuota > 0 && toInt(u.monthly_usage) >= monthlyQuota;
    return byFlag || byProfile || dailyExceeded || monthlyExceeded;
};

/** Profile column: when FUP, show original plan (not only Fallback). */
const ProfileCell: React.FC<{ user: OnlineUser; compact?: boolean }> = ({ user, compact }) => {
    const fup = isFupUser(user);
    const current = String(user.profile_profile_name || "").trim();
    const original = String(user.original_profile_name || current).trim();
    const originalIsDifferent =
        fup &&
        original &&
        original.toLowerCase() !== current.toLowerCase() &&
        !original.toLowerCase().includes("fallback");

    if (!fup) return profileBadge(current || "—", compact);

    return (
        <div className={cn("flex flex-col gap-0.5", compact ? "min-w-0" : "gap-1")}>
            {originalIsDifferent ? profileBadge(original, compact) : profileBadge(current || "—", compact)}
            <span
                className={cn(
                    "font-medium text-red-600 dark:text-red-400",
                    compact ? "text-[9px] leading-none" : "text-[11px]"
                )}
                title={`Throttled (current RADIUS profile: ${current || "Fallback"})`}
            >
                FUP{originalIsDifferent ? ` · ${current || "Fallback"}` : ""}
            </span>
        </div>
    );
};

function computeSessionStats(rows: OnlineUser[]): OnlineSessionStats {
    const fup = rows.filter((u) => isFupUser(u)).length;
    const monthlyExceeded = rows.filter((u) =>
        isMonthlyQuotaExceededFromFields(monthlyCycleFieldsFromOnlineUser(u))
    ).length;
    return { fup, monthlyExceeded, total: rows.length };
}

function sessionStatsEqual(a: OnlineSessionStats, b: OnlineSessionStats): boolean {
    return a.fup === b.fup && a.monthlyExceeded === b.monthlyExceeded && a.total === b.total;
}

type UsageTone = "normal" | "warning" | "high" | "critical";

const getUserInitials = (username: string) => {
    const base = String(username || "").trim();
    if (!base) return "U";
    return base.slice(0, 2).toUpperCase();
};

type SessionBorderTone = "green" | "orange" | "red" | "amber" | "slate" | "default";

const QUOTA_WARN_PCT = 70;

const getDailyQuotaPct = (u: OnlineUser) => pct(u.real_time_data_usage, u.profile_daily_quota);

const getMonthlyQuotaPct = (u: OnlineUser) => {
    if (u.monthly_usage_pct != null && Number.isFinite(Number(u.monthly_usage_pct))) {
        return Math.min(Number(u.monthly_usage_pct), 100);
    }
    return pct(u.monthly_usage, u.profile_monthly_quota);
};

const getSessionBorderTone = (u: OnlineUser): SessionBorderTone => {
    const fup = isFupUser(u);
    const stale = isSessionStale(u.session_last_update);
    const status = String(u.session_status || "").toLowerCase();
    const dailyPct = getDailyQuotaPct(u);
    const monthlyPct = getMonthlyQuotaPct(u);
    const monthlyExceeded = isMonthlyQuotaExceededFromFields(monthlyCycleFieldsFromOnlineUser(u));

    if (fup || monthlyExceeded || dailyPct >= 100 || monthlyPct >= 100) return "red";
    if (dailyPct >= QUOTA_WARN_PCT || monthlyPct >= QUOTA_WARN_PCT) return "orange";
    if (stale) return "amber";
    if (status === "active") return "green";
    if (status === "idle") return "slate";
    return "default";
};

const borderToneClasses: Record<SessionBorderTone, { stripe: string; accent: string }> = {
    green: {
        stripe: "bg-emerald-500",
        accent: "text-emerald-600 dark:text-emerald-400",
    },
    orange: {
        stripe: "bg-orange-500",
        accent: "text-orange-600 dark:text-orange-400",
    },
    red: {
        stripe: "bg-red-500",
        accent: "text-red-600 dark:text-red-400",
    },
    amber: {
        stripe: "bg-amber-500",
        accent: "text-amber-600 dark:text-amber-400",
    },
    slate: {
        stripe: "bg-slate-400 dark:bg-slate-500",
        accent: "text-slate-500 dark:text-slate-400",
    },
    default: {
        stripe: "bg-border",
        accent: "text-primary",
    },
};

const sessionRowShell = "bg-card border-border/60";

const SessionStatusStripe = ({ user }: { user: OnlineUser }) => (
    <div
        className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-[3px]",
            borderToneClasses[getSessionBorderTone(user)].stripe
        )}
        aria-hidden
    />
);

const getSessionRowClasses = () =>
    cn(sessionRowShell, "relative overflow-hidden border shadow-none hover:bg-primary/[0.03]");

const getSessionFirstCellClasses = () =>
    cn(sessionRowShell, "relative rounded-l-lg border-y border-l border-r-0");

const getSessionMiddleCellClasses = () =>
    cn(sessionRowShell, "border-y border-x-0");

const getSessionLastCellClasses = () =>
    cn(sessionRowShell, "rounded-r-md border-y border-l-0 border-r");

const getSessionAccentClass = (u: OnlineUser) => borderToneClasses[getSessionBorderTone(u)].accent;

const getUsageTone = (value: number, isFup: boolean): UsageTone => {
    if (isFup || value >= 100) return "critical";
    if (value >= 90) return "high";
    if (value >= 75) return "warning";
    return "normal";
};

/* small reusable bar */
const UsageBar: React.FC<{ used: string; total: string; type: 'daily' | 'monthly'; isFup?: boolean }> = ({
    used,
    total,
    type,
    isFup = false,
}) => {
    const value = pct(used, total);
    const tone = getUsageTone(value, isFup);
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div
                        className={cn(
                            "space-y-1 rounded border px-2 py-1.5",
                            tone === "critical" &&
                                "border-red-200/80 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/40",
                            tone === "high" &&
                                "border-orange-200/80 bg-orange-50/70 dark:border-orange-900/55 dark:bg-orange-950/35",
                            tone === "warning" &&
                                "border-amber-200/80 bg-amber-50/70 dark:border-amber-900/55 dark:bg-amber-950/35",
                            tone === "normal" &&
                                "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/30"
                        )}
                    >
                        <div className="flex items-center justify-between text-[10px]">
                            <span className="uppercase tracking-wide text-muted-foreground">
                                {type === 'daily' ? 'Daily' : 'Monthly'}
                            </span>
                            <span className="font-medium tabular-nums">
                                {formatBytes(used)} / {formatBytes(total)}
                            </span>
                        </div>
                        <Progress
                            value={value}
                            className={cn(
                                "h-1.5",
                                tone === "critical" && "bg-red-100 dark:bg-red-950/60",
                                tone === "high" && "bg-orange-100 dark:bg-orange-950/50",
                                tone === "warning" && "bg-amber-100 dark:bg-amber-950/50",
                                tone === "normal" && "bg-emerald-100 dark:bg-emerald-950/50"
                            )}
                            indicatorClassName={cn(
                                tone === "critical" && "bg-red-600 dark:bg-red-500",
                                tone === "high" && "bg-orange-500 dark:bg-orange-400",
                                tone === "warning" && "bg-amber-500 dark:bg-amber-400",
                                tone === "normal" && "bg-emerald-500 dark:bg-emerald-400"
                            )}
                        />
                        <div
                            className={cn(
                                "text-[10px] text-right",
                                tone === "critical" && "text-red-700 dark:text-red-300",
                                tone === "high" && "text-orange-700 dark:text-orange-300",
                                tone === "warning" && "text-amber-700 dark:text-amber-300",
                                tone === "normal" && "text-emerald-700 dark:text-emerald-300"
                            )}
                        >
                            {value.toFixed(1)}% used
                        </div>
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <div className="space-y-1">
                        <div className="font-medium">{type === 'daily' ? 'Daily' : 'Monthly'} Usage</div>
                        <div>{formatBytes(used)} / {formatBytes(total)}</div>
                        <div className="text-sm text-muted-foreground">{value.toFixed(1)}% used</div>
                    </div>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

const StatusBadge: React.FC<{ status: string; compact?: boolean }> = ({ status, compact }) => {
    const s = status.toLowerCase();
    const tone =
        s === "active" ? "info" :
        s === "idle" ? "warning" :
        s === "disconnected" ? "danger" :
        "default";

    return (
        <StatusPill
            label={formatStatus(status)}
            tone={tone as any}
            dot
            pulseDot={s === "active"}
            className={compact ? "gap-1 px-1.5 py-0 text-[10px] [&_span:first-child]:h-1.5 [&_span:first-child]:w-1.5" : undefined}
        />
    );
};

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ MOBILE CARD ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const MobileCard: React.FC<{
    user: OnlineUser;
    onAction: (a: string, u: string) => void;
    canManageRadiusUsers: boolean;
    canResetDailyQuota: boolean;
    canResetMonthlyQuota: boolean;
    canDisconnect: boolean;
    manageReason: string;
    disconnectReason: string;
}> = React.memo(({ user, onAction, canManageRadiusUsers, canResetDailyQuota, canResetMonthlyQuota, canDisconnect, manageReason, disconnectReason }) => {
    const fup = isFupUser(user);
    return (
    <Card
        className={cn(
            "overflow-hidden transition-shadow duration-200",
            getSessionRowClasses()
        )}
    >
        <SessionStatusStripe user={user} />
        <CardHeader className="border-b border-border/50 bg-muted/15 pb-2 pl-4 pt-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                    <div className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold",
                        getSessionAccentClass(user)
                    )}>
                        {getUserInitials(user.session_username)}
                    </div>
                    <div className="min-w-0 space-y-1">
                        <CardTitle className={cn("text-base leading-tight", profileClass(user.profile_profile_name))}>
                            <Link className="hover:underline" href={`/users/${encodeURIComponent(user.session_username)}`}>
                                {user.session_username}
                            </Link>
                        </CardTitle>
                        <CardDescription className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{user.userDetails_full_name || "—"}</span>
                        </CardDescription>
                    </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <ProfileCell user={user} compact />
                    <StatusBadge status={user.session_status} compact />
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">MAC address</div>
                    <div className="flex items-center text-sm">
                        <Wifi className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        {user.session_mac_address}
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Last update</div>
                    <div className="flex items-center text-sm">
                        <Clock className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                        <span title={user.session_last_update || ""}>{formatAgo(user.session_last_update)}</span>
                    </div>
                </div>
            </div>
            <UsageBar
                used={user.real_time_data_usage}
                total={user.profile_daily_quota}
                type="daily"
                isFup={fup}
            />
            <MonthlyCycleCell {...monthlyCycleFieldsFromOnlineUser(user)} />
        </CardContent>
        <CardFooter className="border-t border-border/50 bg-muted/10 p-3">
            <div className="flex w-full justify-end">
                <TableRowActions
                    actions={[
                        { label: "Session Details", icon: HardDrive, onClick: () => onAction("details", user.session_username) },
                        { label: "View Traffic", icon: Activity, onClick: () => onAction("view-traffic", user.session_username) },
                        { label: "Disconnect", icon: Power, onClick: () => onAction("disconnect", user.session_username), tone: "destructive" as const, disabled: !canDisconnect, disabledReason: disconnectReason },
                        { label: "Reset MAC", icon: RefreshCw, onClick: () => onAction("reset-mac", user.session_username), disabled: !canManageRadiusUsers, disabledReason: manageReason },
                        { label: "Reset Quota", icon: RotateCw, onClick: () => onAction("reset-quota", user.session_username), disabled: !canResetDailyQuota, disabledReason: !canResetDailyQuota ? "You don't have permission to reset daily quota." : undefined },
                        { label: "Reset Monthly", icon: RotateCw, onClick: () => onAction("reset-monthly", user.session_username), disabled: !canResetMonthlyQuota, disabledReason: !canResetMonthlyQuota ? "You don't have permission to reset monthly quota." : undefined },
                        { label: "Change Profile", icon: Settings, onClick: () => onAction("change-profile", user.session_username), disabled: !canManageRadiusUsers, disabledReason: manageReason },
                    ]}
                />
            </div>
        </CardFooter>
    </Card>
    );
});

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ DESKTOP TABLE ROWS ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const TableRows = function TableRows({
    users,
    onAction,
    canManageRadiusUsers,
    canResetDailyQuota,
    canResetMonthlyQuota,
    canDisconnect,
    manageReason,
    disconnectReason,
}: {
    users: OnlineUser[];
    onAction: (a: string, u: string) => void;
    canManageRadiusUsers: boolean;
    canResetDailyQuota: boolean;
    canResetMonthlyQuota: boolean;
    canDisconnect: boolean;
    manageReason: string;
    disconnectReason: string;
}) {
    return (
        <>
            {users.map((u) => {
                const fup = isFupUser(u);
                return (
                <TableRow 
                    key={u.session_username} 
                    className="group border-0 hover:bg-transparent"
                >
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionFirstCellClasses())}>
                        <SessionStatusStripe user={u} />
                        <div className="relative flex items-center gap-2 min-w-0 pl-1">
                            <div className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold",
                                getSessionAccentClass(u)
                            )}>
                                {getUserInitials(u.session_username)}
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-medium leading-tight">
                                    <Link
                                        className={cn("hover:underline", profileClass(u.profile_profile_name))}
                                        href={`/users/${encodeURIComponent(u.session_username)}`}
                                    >
                                        {u.session_username}
                                    </Link>
                                </div>
                                <div className="truncate text-[11px] text-muted-foreground">{u.userDetails_full_name || "—"}</div>
                            </div>
                        </div>
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <span className="block max-w-[6.5rem] truncate font-mono text-[10px] text-foreground/85" title={u.session_mac_address}>
                            {u.session_mac_address}
                        </span>
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <ProfileCell user={u} compact />
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <StatusBadge status={u.session_status} compact />
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <Badge 
                            variant="outline" 
                            className={cn(
                                "px-1.5 py-0 text-[10px] font-medium",
                                fup
                                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/45 dark:text-red-200"
                                  : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/45 dark:text-emerald-200"
                            )}
                        >
                            {fup ? "FUP" : "OK"}
                        </Badge>
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <span className="whitespace-nowrap text-[11px] font-medium tabular-nums">
                            {formatUptime(u.session_session_time)}
                        </span>
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <div className="space-y-0.5" title={u.session_last_update || ""}>
                            <div className="whitespace-nowrap text-[11px] font-medium">{formatAgo(u.session_last_update)}</div>
                            {isSessionStale(u.session_last_update) ? (
                                <Badge
                                  variant="outline"
                                  className="px-1 py-0 text-[9px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/35 dark:text-amber-200"
                                >
                                    Stale
                                </Badge>
                            ) : null}
                        </div>
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <UsageBar
                            used={u.real_time_data_usage}
                            total={u.profile_daily_quota}
                            type="daily"
                            isFup={fup}
                        />
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 align-middle", getSessionMiddleCellClasses())}>
                        <MonthlyCycleCell {...monthlyCycleFieldsFromOnlineUser(u)} />
                    </TableCell>
                    <TableCell className={cn("px-2 py-2 text-center align-middle", getSessionLastCellClasses())}>
                        <TableRowActions
                            actions={[
                                { label: "Session Details", icon: HardDrive, onClick: () => onAction("details", u.session_username) },
                                { label: "View Traffic", icon: Activity, onClick: () => onAction("view-traffic", u.session_username) },
                                { label: "Disconnect", icon: Power, onClick: () => onAction("disconnect", u.session_username), tone: "destructive" as const, disabled: !canDisconnect, disabledReason: disconnectReason },
                                { label: "Reset MAC", icon: RefreshCw, onClick: () => onAction("reset-mac", u.session_username), disabled: !canManageRadiusUsers, disabledReason: manageReason },
                                { label: "Reset Quota", icon: RotateCw, onClick: () => onAction("reset-quota", u.session_username), disabled: !canResetDailyQuota, disabledReason: !canResetDailyQuota ? "You don't have permission to reset daily quota." : undefined },
                                { label: "Reset Monthly", icon: RotateCw, onClick: () => onAction("reset-monthly", u.session_username), disabled: !canResetMonthlyQuota, disabledReason: !canResetMonthlyQuota ? "You don't have permission to reset monthly quota." : undefined },
                                { label: "Change Profile", icon: Settings, onClick: () => onAction("change-profile", u.session_username), disabled: !canManageRadiusUsers, disabledReason: manageReason },
                            ]}
                        />
                    </TableCell>
                </TableRow>
            )})}
        </>
    );
}
/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ DESKTOP TABLE WRAPPER ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
const DesktopTable: React.FC<{
    users: OnlineUser[];
    onAction: (a: string, u: string) => void;
    canManageRadiusUsers: boolean;
    canResetDailyQuota: boolean;
    canResetMonthlyQuota: boolean;
    canDisconnect: boolean;
    manageReason: string;
    disconnectReason: string;
}> = React.memo(({ users, onAction, canManageRadiusUsers, canResetDailyQuota, canResetMonthlyQuota, canDisconnect, manageReason, disconnectReason }) => (
    <Card className="overflow-hidden border border-border/60 bg-card p-1 shadow-none">
        <div className="max-h-[70vh] overflow-auto rounded-md">
        <Table className="border-separate border-spacing-x-0 border-spacing-y-1 text-xs">
            <TableHeader className="sticky top-0 z-10">
                <TableRow className="border-none bg-muted/70 shadow-none hover:bg-muted/70">
                    <TableHead className="rounded-l-md bg-transparent px-2 py-2 text-[10px] font-semibold uppercase tracking-wide min-w-[140px]">User</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[6.5rem]">MAC</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[4.5rem]">Profile</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[4.5rem]">Status</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[3rem]">FUP</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[4.5rem]">Uptime</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold w-[4.5rem]">Updated</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold min-w-[120px]">Daily</TableHead>
                    <TableHead className="bg-transparent px-2 py-2 text-[11px] font-semibold min-w-[120px]">Monthly</TableHead>
                    <TableHead className="rounded-r-md bg-transparent px-2 py-2 text-[11px] font-semibold text-center w-[3.5rem]">···</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                <TableRows
                    users={users}
                    onAction={onAction}
                    canManageRadiusUsers={canManageRadiusUsers}
                    canResetDailyQuota={canResetDailyQuota}
                    canResetMonthlyQuota={canResetMonthlyQuota}
                    canDisconnect={canDisconnect}
                    manageReason={manageReason}
                    disconnectReason={disconnectReason}
                />
            </TableBody>
        </Table>
        </div>
    </Card>
));

/* ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ MAIN TABLE COMPONENT ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
interface Props {
    search: string;
    onCountChange?: (count: number) => void;
    onStatsChange?: (stats: OnlineSessionStats) => void;
    isRefreshing?: boolean;
    refreshToken?: number;
    onChangeProfile?: (username: string, currentProfileName?: string) => void;
    onViewTraffic?: (username: string) => void;
}

const OnlineUsersTable: React.FC<Props> = ({ 
    search, 
    onCountChange,
    onStatsChange,
    isRefreshing,
    refreshToken,
    onChangeProfile,
    onViewTraffic,
}) => {
    const { user: authUser } = useAuth();
    const canManageRadiusUsers = useMemo(() => canAny(authUser, ["users.view", "reseller.users.manage"]), [authUser]);
    const canResetDailyQuota = useMemo(() => canAny(authUser, ["users.resetDailyQuota", "reseller.users.manage"]), [authUser]);
    const canResetMonthlyQuota = useMemo(() => canAny(authUser, ["users.resetMonthlyQuota", "reseller.users.manage"]), [authUser]);
    const canDisconnect = useMemo(() => canAny(authUser, ["users.online.view", "reseller.users.manage"]), [authUser]);
    const manageReason = "You don't have permission to manage users.";
    const disconnectReason = "You don't have permission to disconnect sessions.";
    /* local pagination to keep table self-contained */
    //const [page, setPage] = useState(1);

    const {
        data,
        error,
        isLoading,
        refetch,
        limit,
        setLimit,
        page,
        setPage,
        resetDailyUserQuotaMutation,
        resetMonthlyUserQuotaMutation,
        resetMacAddressMutation,
        disconnectUserSessionMutation,
    } = useOnlineUsers(search, 1, 100);
    //search,

    const [confirm, setConfirm] = useState<
        null | { action: "reset-quota" | "reset-monthly" | "reset-mac" | "disconnect"; username: string }
    >(null);
    const [detailUsername, setDetailUsername] = useState<string | null>(null);

    const sessionDetailQuery = useQuery({
        queryKey: ["sessions", "live", detailUsername],
        queryFn: async () => {
            const resp = await apiClient.get(`/sessions/live/${encodeURIComponent(String(detailUsername))}`);
            return resp?.data?.data;
        },
        enabled: Boolean(detailUsername),
        staleTime: 5000,
    });

    const sessionRejectsQuery = useQuery({
        queryKey: ["sessions", "rejects", detailUsername],
        queryFn: async () => {
            const resp = await apiClient.get(`/sessions/rejects/${encodeURIComponent(String(detailUsername))}`, { params: { limit: 25 } });
            return resp?.data?.data ?? [];
        },
        enabled: Boolean(detailUsername),
        staleTime: 5000,
    });

    const onAction = useCallback(
        (action: string, username: string) => {
            const currentProfileName =
                (data?.data ?? []).find((u) => u.session_username === username)?.profile_profile_name;

            if (action === "reset-quota") {
                setConfirm({ action: "reset-quota", username });
                return;
            }

            if (action === "reset-monthly") {
                setConfirm({ action: "reset-monthly", username });
                return;
            }

            if (action === "reset-mac") {
                setConfirm({ action: "reset-mac", username });
                return;
            }

            if (action === "disconnect") {
                setConfirm({ action: "disconnect", username });
                return;
            }

            if (action === "change-profile") {
                onChangeProfile?.(username, currentProfileName);
                return;
            }

            if (action === "view-traffic") {
                onViewTraffic?.(username);
                return;
            }

            if (action === "details") {
                setDetailUsername(username);
                return;
            }
        },
        [resetDailyUserQuotaMutation, resetMonthlyUserQuotaMutation, resetMacAddressMutation, disconnectUserSessionMutation, refetch, onChangeProfile, onViewTraffic]
    );

    // Allow parent to trigger a refetch (e.g., top Refresh button)
    useEffect(() => {
        if (!refreshToken) return;
        // Avoid unhandled promise rejections crashing the page
        refetch().catch(() => null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshToken]);

    /* page-size select options */
    const pageSizes = useMemo(() => [10, 25, 50, 100], []);

    type StatusFilter = "all" | "active" | "idle" | "disconnected" | "stale";
    type SortKey =
        | "lastUpdateDesc"
        | "usernameAsc"
        | "usernameDesc"
        | "uptimeDesc"
        | "dailyPctDesc"
        | "monthlyPctDesc";

    // View state persistence disabled (no localStorage)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
    const [fupOnly, setFupOnly] = useState<boolean>(false);
    const [sortKey, setSortKey] = useState<SortKey>("lastUpdateDesc");

    const clearFilters = useCallback(() => {
        setStatusFilter("all");
        setFupOnly(false);
        // keep sortKey as-is; sorting doesn’t hide rows
    }, [setStatusFilter, setFupOnly]);

    // Update count when users change (stable — avoid redundant parent re-renders)
    useEffect(() => {
        const total = data?.totalUsers ?? 0;
        onCountChange?.(total);
    }, [data?.totalUsers, onCountChange]);

    const rows = useMemo(() => data?.data ?? EMPTY_ONLINE_ROWS, [data?.data]);

    const sessionStats = useMemo(() => computeSessionStats(rows), [rows]);
    const lastReportedStatsRef = useRef<OnlineSessionStats | null>(null);

    useEffect(() => {
        if (!onStatsChange) return;
        const prev = lastReportedStatsRef.current;
        if (prev && sessionStatsEqual(prev, sessionStats)) return;
        lastReportedStatsRef.current = sessionStats;
        onStatsChange(sessionStats);
    }, [sessionStats, onStatsChange]);
    const statusCounts = useMemo(() => {
        return rows.reduce(
            (acc, u) => {
                const status = String(u.session_status || "").toLowerCase();
                if (status === "active") acc.active += 1;
                else if (status === "idle") acc.idle += 1;
                else if (status === "disconnected") acc.disconnected += 1;
                if (isSessionStale(u.session_last_update)) acc.stale += 1;
                return acc;
            },
            { active: 0, idle: 0, disconnected: 0, stale: 0 }
        );
    }, [rows]);

    const displayRows = useMemo(() => {
        let out = rows;
        if (statusFilter !== "all") {
            if (statusFilter === "stale") {
                out = out.filter((u) => isSessionStale(u.session_last_update));
            } else {
                out = out.filter((u) => String(u.session_status || "").toLowerCase() === statusFilter);
            }
        }
        if (fupOnly) {
            out = out.filter((u) => isFupUser(u));
        }

        const num = (s: any) => {
            const n = typeof s === "number" ? s : parseInt(String(s ?? "0"), 10);
            return Number.isFinite(n) ? n : 0;
        };
        const pctOf = (used: any, total: any) => {
            const t = num(total);
            if (t <= 0) return 0;
            return (num(used) / t) * 100;
        };
        const lastUpdateMs = (u: OnlineUser) => {
            const t = u.session_last_update ? Date.parse(u.session_last_update) : NaN;
            return Number.isFinite(t) ? t : 0;
        };

        const sorted = [...out].sort((a, b) => {
            if (sortKey === "usernameAsc") return String(a.session_username).localeCompare(String(b.session_username));
            if (sortKey === "usernameDesc") return String(b.session_username).localeCompare(String(a.session_username));
            if (sortKey === "uptimeDesc") return num(b.session_session_time) - num(a.session_session_time);
            if (sortKey === "dailyPctDesc") return pctOf(b.real_time_data_usage, b.profile_daily_quota) - pctOf(a.real_time_data_usage, a.profile_daily_quota);
            if (sortKey === "monthlyPctDesc") return pctOf(b.monthly_usage, b.profile_monthly_quota) - pctOf(a.monthly_usage, a.profile_monthly_quota);
            // lastUpdateDesc default
            return lastUpdateMs(b) - lastUpdateMs(a);
        });

        return sorted;
    }, [rows, statusFilter, fupOnly, sortKey]);

    const hasClientFilters = fupOnly || statusFilter !== "all" || Boolean(String(search ?? "").trim());
    const isTrulyEmpty = rows.length === 0 && !hasClientFilters;
    const isNoMatches = rows.length > 0 && displayRows.length === 0;

    return (
        <>
            {isRefreshing ? (
                <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </div>
            ) : null}

            <Sheet open={Boolean(detailUsername)} onOpenChange={(open) => (!open ? setDetailUsername(null) : null)}>
                <SheetContent className="sm:max-w-[520px]">
                    <SheetHeader>
                        <SheetTitle>Session Details</SheetTitle>
                        <SheetDescription>
                            {detailUsername ? (
                                <span>
                                    User:{" "}
                                    <Link className="underline" href={`/users/${encodeURIComponent(detailUsername)}`}>
                                        {detailUsername}
                                    </Link>
                                </span>
                            ) : null}
                        </SheetDescription>
                    </SheetHeader>

                    <div className="px-4 pb-4 space-y-4 overflow-auto">
                        {sessionDetailQuery.isLoading ? (
                            <div className="text-sm text-muted-foreground">Loading session detail…</div>
                        ) : sessionDetailQuery.error ? (
                            <div className="text-sm text-red-600">Failed to load session detail.</div>
                        ) : !sessionDetailQuery.data ? (
                            <div className="text-sm text-muted-foreground">No live session found.</div>
                        ) : (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Status</span><span className="font-medium">{sessionDetailQuery.data.status ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Profile</span><span className="font-medium">{sessionDetailQuery.data.profileName ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">NAS IP</span><span className="font-mono text-xs">{sessionDetailQuery.data.nasIpAddress ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Framed IP</span><span className="font-mono text-xs">{sessionDetailQuery.data.framedIpAddress ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Calling Station</span><span className="font-mono text-xs">{sessionDetailQuery.data.callingStationId ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Acct Session Id</span><span className="font-mono text-xs">{sessionDetailQuery.data.sessionId ?? "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Start</span><span className="font-mono text-xs">{sessionDetailQuery.data.acctStartTime ? new Date(sessionDetailQuery.data.acctStartTime).toLocaleString() : "—"}</span></div>
                                <div className="flex justify-between gap-2"><span className="text-muted-foreground">Last Update</span><span className="font-mono text-xs">{sessionDetailQuery.data.acctUpdateTime ? new Date(sessionDetailQuery.data.acctUpdateTime).toLocaleString() : "—"}</span></div>
                            </div>
                        )}

                        <div className="border rounded-md">
                            <div className="px-3 py-2 border-b text-sm font-medium">Recent rejects</div>
                            <div className="p-3">
                                {sessionRejectsQuery.isLoading ? (
                                    <div className="text-sm text-muted-foreground">Loading rejects…</div>
                                ) : sessionRejectsQuery.error ? (
                                    <div className="text-sm text-red-600">Failed to load rejects.</div>
                                ) : (Array.isArray(sessionRejectsQuery.data) ? sessionRejectsQuery.data.length : 0) === 0 ? (
                                    <div className="text-sm text-muted-foreground">No recent rejects recorded.</div>
                                ) : (
                                    <div className="space-y-2">
                                        {(sessionRejectsQuery.data as any[]).slice(0, 8).map((r, idx) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 text-xs">
                                                <span className="font-mono">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "—"}</span>
                                                <span className="text-muted-foreground">{r.status ?? "rejected"}</span>
                                                <span className="font-mono">{r.nasIp ?? "—"}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            <ActionConfirmDialog
                open={Boolean(confirm)}
                onOpenChange={(open) => {
                    if (!open) setConfirm(null);
                }}
                title={
                    confirm?.action === "disconnect"
                        ? "Disconnect session?"
                        : confirm?.action === "reset-mac"
                          ? "Reset MAC address?"
                          : confirm?.action === "reset-monthly"
                            ? "Reset monthly traffic?"
                            : "Reset daily quota?"
                }
                description={
                    confirm?.action === "disconnect"
                        ? `This will send a CoA disconnect for ${confirm?.username}.`
                        : confirm?.action === "reset-mac"
                          ? `This will clear the stored MAC binding for ${confirm?.username}.`
                          : confirm?.action === "reset-monthly"
                            ? `This will reset the monthly traffic counters for ${confirm?.username}.`
                            : `This will reset the daily quota counters for ${confirm?.username}.`
                }
                confirmText={confirm?.action === "disconnect" ? "Disconnect" : "Confirm"}
                confirmTone={confirm?.action === "disconnect" ? "destructive" : "default"}
                onConfirm={async () => {
                    if (!confirm) return;
                    const username = confirm.username;

                    try {
                        if (confirm.action === "reset-quota") {
                            await resetDailyUserQuotaMutation.mutateAsync({ username });
                            await refetch();
                            return;
                        }

                        if (confirm.action === "reset-monthly") {
                            await resetMonthlyUserQuotaMutation.mutateAsync({ username });
                            await refetch();
                            return;
                        }

                        if (confirm.action === "reset-mac") {
                            await resetMacAddressMutation.mutateAsync({ username });
                            await refetch();
                            return;
                        }

                        if (confirm.action === "disconnect") {
                            await disconnectUserSessionMutation.mutateAsync({ username });
                            await refetch();
                        }
                    } finally {
                        // Ensure the dialog closes even if refetch/mutations hang or throw.
                        setConfirm(null);
                    }
                }}
            />

        <QueryState
            isLoading={isLoading}
            error={error}
            // IMPORTANT: don't treat "filtered to 0" as a hard empty state,
            // otherwise the toolbar (and FUP toggle) disappears and user can't undo.
            isEmpty={isTrulyEmpty}
            onRetry={() => refetch()}
            loading={
                <div className="flex justify-center py-20">
                    <Loader />
                </div>
            }
            empty={
                <EmptyState
                    title="No live sessions"
                    description="Try adjusting your search or filters."
                />
            }
            errorTitle="Failed to load live sessions"
        >
            <TableToolbar
                label={`${displayRows.length} of ${data?.totalUsers ?? 0} sessions`}
                className="mb-2 rounded-lg border border-border/60 bg-card"
                right={
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <FilterPills
                                value={statusFilter}
                                onChange={(v) => setStatusFilter(v as StatusFilter)}
                                options={[
                                    { value: "all", label: `All (${rows.length})` },
                                    { value: "active", label: `Active (${statusCounts.active})` },
                                    { value: "idle", label: `Idle (${statusCounts.idle})` },
                                    { value: "disconnected", label: `Disconnected (${statusCounts.disconnected})` },
                                    { value: "stale", label: `Stale (${statusCounts.stale})` },
                                ]}
                                name="online-users-status-filter"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground">Sort</Label>
                            <Select value={sortKey} onValueChange={(v) => setSortKey(v as any)}>
                                <SelectTrigger className="h-8 w-[180px]">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lastUpdateDesc">Last update (newest)</SelectItem>
                                    <SelectItem value="uptimeDesc">Uptime (highest)</SelectItem>
                                    <SelectItem value="dailyPctDesc">Daily usage % (highest)</SelectItem>
                                    <SelectItem value="monthlyPctDesc">Monthly usage % (highest)</SelectItem>
                                    <SelectItem value="usernameAsc">Username (A→Z)</SelectItem>
                                    <SelectItem value="usernameDesc">Username (Z→A)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="flex items-center gap-2">
                                            <Label className="text-xs text-muted-foreground">FUP only</Label>
                                            <Switch checked={fupOnly} onCheckedChange={setFupOnly} />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent>Show only users currently in fallback/FUP.</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </div>
                }
            />

            {isNoMatches ? (
                <EmptyState
                    title="No matches"
                    description="No sessions match the current filters (e.g. FUP only)."
                    actionLabel="Clear filters"
                    onAction={clearFilters}
                    className="mb-4"
                />
            ) : null}

            {/* Desktop */}
            <div className="hidden md:block">
                <DesktopTable
                    users={displayRows}
                    onAction={onAction}
                    canManageRadiusUsers={canManageRadiusUsers}
                    canResetDailyQuota={canResetDailyQuota}
                    canResetMonthlyQuota={canResetMonthlyQuota}
                    canDisconnect={canDisconnect}
                    manageReason={manageReason}
                    disconnectReason={disconnectReason}
                />
            </div>

            {/* Mobile */}
            <div className="space-y-3 md:hidden">
                {displayRows.map((u) => (
                    <MobileCard
                        key={u.session_username}
                        user={u}
                        onAction={onAction}
                        canManageRadiusUsers={canManageRadiusUsers}
                        canResetDailyQuota={canResetDailyQuota}
                        canResetMonthlyQuota={canResetMonthlyQuota}
                        canDisconnect={canDisconnect}
                        manageReason={manageReason}
                        disconnectReason={disconnectReason}
                    />
                ))}
            </div>

            <TablePager
                currentPage={page}
                totalPages={data?.totalPages ?? 1}
                totalItems={data?.totalUsers ?? 0}
                pageSize={limit}
                pageSizeOptions={pageSizes}
                onPageChange={setPage}
                onPageSizeChange={setLimit}
                isDisabled={Boolean(isLoading)}
                noun="users"
            />
        </QueryState>
        </>
    );
};

export default OnlineUsersTable;
