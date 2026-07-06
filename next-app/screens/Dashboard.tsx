import { useOnlineMetrics } from '@/hooks/useOnlineMetrics';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useExpenseMonthlyTotals } from '@/hooks/useExpenses';
import { useAuthMetrics } from "@/hooks/useAuthMetrics";
import { useCollectedMetrics } from '@/hooks/useInvoices';
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  UserCheck, 
  Shield, 
  AlertTriangle, 
  Activity, 
  RefreshCw,
  Bell,
  Settings,
  LineChart,
  Receipt,
  DollarSign,
  Clock,
  User as UserIcon,
  Server,
  ArrowUpRight,
  Gauge,
  Wifi,
} from 'lucide-react';
 
import AnalyticsWidget from '@/components/AnalyticsWidget';
import AlertNotification from '@/components/AlertNotification';
import BandwidthWidget from '@/components/BandwidthWidget';
import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/context/AuthContext';
import { can, canAny } from '@/lib/permissions';
import { fetchResellerMe } from '@/api/resellers';
import { apiClient } from '@/api/client';
import Link from "next/link";
import { QuotaExceededSummaryAlert } from "@/components/ui/Alert";
import useNas from "@/hooks/useNas";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { getDashboardPersona, sortDashboardWidgets } from "@/lib/dashboardPersona";
import { Line as RechartsLine, LineChart as RechartsLineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import FilterPills from "@/components/FilterPills";
import DailyOpsBriefPanel from "@/components/DailyOpsBriefPanel";
import { CountUpNumber } from "@/components/viz";
import { useTranslation } from "react-i18next";

type AuditLogRow = {
  id: number;
  level: string;
  message: string;
  meta: any;
  timestamp: string;
};
type NocHealthSample = {
  key: string;
  time: string;
  dbLatencyMs: number;
  serverProcessingMs: number;
  clientRttMs: number;
};
type WatchlistFilter = "all" | "fup" | "stale";
type DashboardAutoRefreshSeconds = 0 | 30 | 60 | 120;
type WatchlistStaleThresholdSeconds = 30 | 60 | 120;
type DashboardWidgetSurface = "white" | "theme";

const DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY = "dashboard.watchlist.defaultFilter";
const DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY = "dashboard.watchlist.staleAfterSeconds";
const DASHBOARD_AUTO_REFRESH_SECONDS_KEY = "dashboard.autoRefreshSeconds";
const DASHBOARD_WIDGET_SURFACE_KEY = "dashboard.widgetSurface";
const DASHBOARD_QUOTA_ALERT_DISMISS_KEY = "dashboard.quotaAlert.dismissedCounts";

const getStoredWatchlistFilter = (): WatchlistFilter => {
  const raw = localStorage.getItem(DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY);
  return raw === "fup" || raw === "stale" || raw === "all" ? raw : "all";
};
const getStoredStaleThreshold = (): WatchlistStaleThresholdSeconds => {
  const raw = Number(localStorage.getItem(DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY));
  return raw === 30 || raw === 60 || raw === 120 ? raw : 60;
};
const getStoredAutoRefreshSeconds = (): DashboardAutoRefreshSeconds => {
  const raw = Number(localStorage.getItem(DASHBOARD_AUTO_REFRESH_SECONDS_KEY));
  return raw === 0 || raw === 30 || raw === 60 || raw === 120 ? raw : 0;
};
const getStoredWidgetSurface = (): DashboardWidgetSurface => {
  const raw = localStorage.getItem(DASHBOARD_WIDGET_SURFACE_KEY);
  return raw === "theme" || raw === "white" ? raw : "white";
};

function isQuotaAlertDismissed(monthlyCount: number, dailyCount: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(DASHBOARD_QUOTA_ALERT_DISMISS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { monthly?: number; daily?: number };
    return parsed.monthly === monthlyCount && parsed.daily === dailyCount;
  } catch {
    return false;
  }
}

function dismissQuotaAlert(monthlyCount: number, dailyCount: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DASHBOARD_QUOTA_ALERT_DISMISS_KEY,
    JSON.stringify({ monthly: monthlyCount, daily: dailyCount })
  );
}

function healthBarTone(pct: number): string {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

function latencyLoadPct(ms: number, warnAt: number, criticalAt: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  if (ms >= criticalAt) return 100;
  if (ms <= warnAt) return Math.round((ms / warnAt) * 45);
  return Math.round(45 + ((ms - warnAt) / (criticalAt - warnAt)) * 55);
}

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
const isSessionStale = (iso: string | null | undefined, staleAfterSeconds: number = 60) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return true;
  return (Date.now() - t) / 1000 > staleAfterSeconds;
};

function formatAuditTitle(action: string, meta: any): { title: string; detail?: string } {
  const a = String(action || "");
  const m = meta ?? {};

  const pretty =
    a === "users.resetMac"
      ? "Reset MAC"
      : a === "users.resetDailyQuota"
        ? "Reset daily quota"
        : a === "users.resetMonthlyQuota"
          ? "Reset monthly traffic"
          : a === "users.bulk.resetMac"
            ? "Bulk reset MAC"
            : a === "users.bulk.setStatus"
              ? "Bulk set user status"
              : a === "users.update"
                ? "Update user"
                : a === "users.create"
                  ? "Create user"
                  : a === "users.delete"
                    ? "Delete user"
                    : a || "Activity";

  // Optional detail for common actions
  if (a === "users.update") {
    const ch = (m as any)?.changed ?? {};
    const status = ch?.accountStatus;
    if (status?.from && status?.to && status.from !== status.to) {
      return { title: status.to === "suspended" ? "Suspend user" : status.to === "active" ? "Activate user" : pretty, detail: `${status.from} → ${status.to}` };
    }
    const prof = ch?.profileId;
    if (prof?.from && prof?.to && prof.from !== prof.to) {
      return { title: "Change profile", detail: `#${prof.from} → #${prof.to}` };
    }
  }

  if (a === "users.bulk.setStatus") {
    const s = String((m as any)?.accountStatus ?? "");
    if (s) return { title: s === "suspended" ? "Bulk suspend users" : s === "active" ? "Bulk activate users" : pretty, detail: s };
  }

  return { title: pretty };
}

const DashboardMiniWidget = ({
  title,
  value,
  subtitle,
  to,
  icon: Icon,
  accentClass = "text-blue-600 dark:text-blue-400",
  glowClass = "bg-blue-500",
}: {
  title: string;
  value: string;
  subtitle: string;
  to: string;
  icon: React.ElementType;
  accentClass?: string;
  glowClass?: string;
}) => {
  // Animate plain numeric values; keep formatted strings (currency, %, "…") as-is.
  const numericValue = /^[\d,]+$/.test(value.trim()) ? Number(value.replace(/,/g, "")) : null;
  return (
    <Link
      href={to}
      className="group relative block overflow-hidden rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:bg-card/80"
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08] ${glowClass}`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{title}</span>
          <div className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${accentClass}`}>
            {numericValue !== null ? <CountUpNumber value={numericValue} /> : value}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <ArrowUpRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
    </Link>
  );
};

const Dashboard: React.FC = () => {
  const { t } = useTranslation("screens");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [quotaAlertDismissed, setQuotaAlertDismissed] = useState(false);
  const [watchlistDefaultFilter, setWatchlistDefaultFilter] = useState<WatchlistFilter>(() => getStoredWatchlistFilter());
  const [watchlistFilter, setWatchlistFilter] = useState<WatchlistFilter>(() => getStoredWatchlistFilter());
  const [watchlistStaleThresholdSec, setWatchlistStaleThresholdSec] = useState<WatchlistStaleThresholdSeconds>(() => getStoredStaleThreshold());
  const [dashboardAutoRefreshSec, setDashboardAutoRefreshSec] = useState<DashboardAutoRefreshSeconds>(() => getStoredAutoRefreshSeconds());
  const [widgetSurface, setWidgetSurface] = useState<DashboardWidgetSurface>(() => getStoredWidgetSurface());
  const [selectedRejectBucket, setSelectedRejectBucket] = useState<string | null>(null);
  const [rejectTrendWindowHours, setRejectTrendWindowHours] = useState<6 | 12 | 24>(24);
  const [nocHealthTrend, setNocHealthTrend] = useState<NocHealthSample[]>([]);
  const [rejectAlertThreshold, setRejectAlertThreshold] = useState<number>(() => {
    const raw = localStorage.getItem("dashboard.noc.rejectAlertThreshold");
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 15;
    return Math.min(Math.max(Math.round(parsed), 1), 100);
  });
  const [rejectAlertMutedUntil, setRejectAlertMutedUntil] = useState<number>(0);
  const { user } = useAuth();
  const isReseller = user?.role === 'reseller';
  const canSeeOnline = can(user, 'users.online.view');
  const canSeeExpenses = can(user, 'admin.expenses.view');
  const canSeeAlerts = can(user, 'admin.alerts.view');
  const canSeeAnalytics = can(user, 'admin.analytics.view');
  const canSeeTotals = can(user, 'dashboard.widget.totalAmount');
  const canSeeInvoiceCounts = can(user, 'dashboard.widget.invoiceCounts');
  const canSeeCollections = can(user, 'billing.collections.view');
  const canSeeAudit = canAny(user, ['users.view', 'reseller.users.view']);
  const canSeeQuotaExceeded = canAny(user, ['users.view', 'reseller.users.view']);
  
  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const onlineMetrics = useOnlineMetrics();
  const expenseMonthlyTotals = useExpenseMonthlyTotals();
  const authMetrics = useAuthMetrics(86400);
  const collectedMetricsQuery = useCollectedMetrics();
  const nasQuery = useNas(1, 1);
  const onlineWatchlistQuery = useOnlineUsers("", 1, 5, {
    enabled: (!isReseller && canSeeOnline) || isReseller,
    refetchInterval: 15000,
  });
  const nocSnapshotQuery = useQuery({
    queryKey: ["noc-snapshot"],
    queryFn: async () => {
      const resp = await apiClient.get("/noc-snapshot");
      return (resp?.data?.data ?? {
        generatedAt: null,
        authRejectTrend: [],
        topNasBySessions: [],
      }) as {
        generatedAt: string | null;
        authRejectTrend: Array<{ bucket: string; attempts: number; rejected: number; rejectRate: number }>;
        topNasBySessions: Array<{ nasIp: string; nasLabel: string; sessions: number }>;
      };
    },
    enabled: (!isReseller && canSeeOnline) || isReseller,
    refetchInterval: 30000,
  });
  const nocHealthQuery = useQuery({
    queryKey: ["noc-health"],
    queryFn: async () => {
      const started = performance.now();
      const resp = await apiClient.get("/noc-health");
      const clientRttMs = Math.max(0, Math.round(performance.now() - started));
      const payload = (resp?.data?.data ?? {
        generatedAt: null,
        dbLatencyMs: 0,
        serverProcessingMs: 0,
        activeSessions: 0,
      }) as {
        generatedAt: string | null;
        dbLatencyMs: number;
        serverProcessingMs: number;
        activeSessions: number;
      };
      return {
        ...payload,
        clientRttMs,
      };
    },
    enabled: (!isReseller && canSeeOnline) || isReseller,
    refetchInterval: 30000,
  });

  const recentAuditQuery = useQuery({
    queryKey: ["audit", "recent"],
    queryFn: async () => {
      const resp = await apiClient.get("/audit", { params: { limit: 8 } });
      const rows = (resp?.data?.data ?? []) as AuditLogRow[];
      return Array.isArray(rows) ? rows : [];
    },
    enabled: Boolean(canSeeAudit) && !isLoading,
    refetchInterval: 30000,
  });

  const quotaExceededQuery = useQuery({
    queryKey: ["users", "quota-exceeded"],
    queryFn: async () => {
      const resp = await apiClient.get("/radius/users/quota-exceeded");
      return resp?.data?.data as {
        totalUsers: number;
        monthlyCount: number;
        dailyCount: number;
      };
    },
    enabled: Boolean(canSeeQuotaExceeded) && !isLoading,
    refetchInterval: 60000,
  });

  const recentAudit = useMemo(() => {
    const rows = recentAuditQuery.data ?? [];
    return rows.map((e) => {
      const meta = (e as any)?.meta ?? {};
      const actor = meta?.actor?.username ?? "—";
      const targets = Array.isArray(meta?.targets) ? meta.targets : [];
      const primaryTarget = targets[0] ?? null;
      const action = String(e.message ?? "").replace(/^audit\./, "") || "—";
      const ts = e.timestamp ? new Date(e.timestamp) : null;
      const fmt = formatAuditTitle(action, meta);
      return { id: e.id, actor, targets, primaryTarget, action, title: fmt.title, detail: fmt.detail, ts };
    });
  }, [recentAuditQuery.data]);

  const authAttempts = authMetrics.data?.current.attempts ?? 0;
  const authAccepted = authMetrics.data?.current.accepted ?? 0;
  const authRejected = authMetrics.data?.current.rejected ?? 0;
  const authSuccessRate = authAttempts > 0 ? (authAccepted / authAttempts) * 100 : 0;
  const authRejectRate = authAttempts > 0 ? (authRejected / authAttempts) * 100 : 0;
  const authHealthLabel =
    authRejectRate <= 5 ? "Healthy" : authRejectRate <= 15 ? "Warning" : "Critical";
  const authHealthBadgeClass =
    authHealthLabel === "Healthy"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300"
      : authHealthLabel === "Warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/45 dark:text-red-300";
  const isRejectThresholdBreached = authAttempts >= 20 && authRejectRate >= rejectAlertThreshold;
  const isRejectAlertMuted = Date.now() < rejectAlertMutedUntil;
  const showRejectThresholdAlert = isRejectThresholdBreached && !isRejectAlertMuted;
  const totalNas = nasQuery.data?.data?.totalEntries ?? 0;
  const watchlistRows = onlineWatchlistQuery.data?.data ?? [];
  const watchlistCounts = useMemo(() => {
    return watchlistRows.reduce(
      (acc, row) => {
        if (row.is_fallback) acc.fup += 1;
        if (isSessionStale(row.session_last_update, watchlistStaleThresholdSec)) acc.stale += 1;
        return acc;
      },
      { fup: 0, stale: 0 }
    );
  }, [watchlistRows, watchlistStaleThresholdSec]);
  const filteredWatchlistRows = useMemo(() => {
    if (watchlistFilter === "fup") return watchlistRows.filter((row) => Boolean(row.is_fallback));
    if (watchlistFilter === "stale") return watchlistRows.filter((row) => isSessionStale(row.session_last_update, watchlistStaleThresholdSec));
    return watchlistRows;
  }, [watchlistRows, watchlistFilter, watchlistStaleThresholdSec]);
  const rejectTrendData = (nocSnapshotQuery.data?.authRejectTrend ?? []).map((r) => ({
    bucket: r.bucket,
    time: String(r.bucket || "").slice(11, 16),
    attempts: Number(r.attempts ?? 0),
    rejected: Number(r.rejected ?? 0),
    rejectRate: Number(r.rejectRate ?? 0),
  }));
  const rejectTrendDisplayData = useMemo(() => {
    if (!rejectTrendData.length) return [];
    if (rejectTrendWindowHours >= 24) return rejectTrendData;
    const last = rejectTrendData[rejectTrendData.length - 1];
    const lastAt = new Date(String(last.bucket || "").replace(" ", "T"));
    if (!Number.isFinite(lastAt.getTime())) return rejectTrendData;
    const from = new Date(lastAt.getTime() - rejectTrendWindowHours * 60 * 60 * 1000);
    return rejectTrendData.filter((d) => {
      const t = new Date(String(d.bucket || "").replace(" ", "T"));
      return Number.isFinite(t.getTime()) && t >= from;
    });
  }, [rejectTrendData, rejectTrendWindowHours]);
  const rejectWindowStats = useMemo(() => {
    const attempts = rejectTrendDisplayData.reduce((acc, d) => acc + Number(d.attempts || 0), 0);
    const rejected = rejectTrendDisplayData.reduce((acc, d) => acc + Number(d.rejected || 0), 0);
    const avgRate = attempts > 0 ? (rejected / attempts) * 100 : 0;
    return { attempts, rejected, avgRate };
  }, [rejectTrendDisplayData]);
  const topNasBySessions = nocSnapshotQuery.data?.topNasBySessions ?? [];
  const nocHealth = nocHealthQuery.data ?? {
    generatedAt: null,
    dbLatencyMs: 0,
    serverProcessingMs: 0,
    activeSessions: 0,
    clientRttMs: 0,
  };
  const healthState = nocHealthQuery.isError
    ? "Down"
    : nocHealth.dbLatencyMs <= 120 && nocHealth.serverProcessingMs <= 200 && nocHealth.clientRttMs <= 800
      ? "Healthy"
      : nocHealth.dbLatencyMs <= 400 && nocHealth.serverProcessingMs <= 800 && nocHealth.clientRttMs <= 2000
        ? "Warning"
        : "Critical";
  const healthBadgeClass =
    healthState === "Healthy"
      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300"
      : healthState === "Warning"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        : "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/45 dark:text-red-300";
  const degradedHealthSamples = useMemo(() => {
    return nocHealthTrend.filter(
      (s) => s.dbLatencyMs > 400 || s.serverProcessingMs > 800 || s.clientRttMs > 2000
    ).length;
  }, [nocHealthTrend]);
  const selectedRange = useMemo(() => {
    if (!selectedRejectBucket) return null;
    const from = new Date(String(selectedRejectBucket).replace(" ", "T"));
    if (!Number.isFinite(from.getTime())) return null;
    const to = new Date(from.getTime() + 60 * 60 * 1000);
    return { from, to };
  }, [selectedRejectBucket]);
  const authFailuresPageHref = useMemo(() => {
    if (!selectedRange) return "/auth-failures";
    const params = new URLSearchParams({
      from: selectedRange.from.toISOString().slice(0, 16),
      to: selectedRange.to.toISOString().slice(0, 16),
    });
    return `/auth-failures?${params.toString()}`;
  }, [selectedRange]);
  const authFailuresLastHourHref = useMemo(() => {
    const now = new Date();
    const from = new Date(now.getTime() - 60 * 60 * 1000);
    const params = new URLSearchParams({
      from: from.toISOString().slice(0, 16),
      to: now.toISOString().slice(0, 16),
      status: "rejected",
    });
    return `/auth-failures?${params.toString()}`;
  }, []);
  const authFailuresQuery = useQuery({
    queryKey: ["auth-failures", selectedRejectBucket],
    queryFn: async () => {
      if (!selectedRange) return { rows: [] as Array<{ id: number; timestamp: string; username: string | null; nasIp: string | null; macAddress: string | null; status: string | null }> };
      const resp = await apiClient.get("/auth-failures", {
        params: {
          from: selectedRange.from.toISOString(),
          to: selectedRange.to.toISOString(),
          limit: 300,
        },
      });
      return (resp?.data?.data ?? { rows: [] }) as {
        rows: Array<{ id: number; timestamp: string; username: string | null; nasIp: string | null; macAddress: string | null; status: string | null }>;
      };
    },
    enabled: Boolean(selectedRange),
  });

  // Extract data from hooks
  const [resellerBalance, setResellerBalance] = useState<number | null>(null);
  const [resellerUserCount, setResellerUserCount] = useState<number | null>(null);
  const [resellerOnlineCount, setResellerOnlineCount] = useState<number | null>(null);

  const totalOnlineUsers = isReseller ? (resellerOnlineCount ?? 0) : onlineMetrics.totalOnlineUsers;
  const totalActiveUsers = isReseller ? (resellerOnlineCount ?? 0) : onlineMetrics.totalActiveUsers;
  const unresolvedAlertsCount = alerts && Array.isArray(alerts) ? alerts.filter((a) => !a.resolved).length : 0;
  const unacknowledgedAlertsCount = alerts && Array.isArray(alerts) ? alerts.filter((a) => !a.acknowledged && !a.resolved).length : 0;
  const fupUsersCount = (quotaExceededQuery.data?.dailyCount ?? 0) + (quotaExceededQuery.data?.monthlyCount ?? 0);
  const quotaMonthlyCount = quotaExceededQuery.data?.monthlyCount ?? 0;
  const quotaDailyCount = quotaExceededQuery.data?.dailyCount ?? 0;
  const showQuotaExceededBanner =
    canSeeQuotaExceeded &&
    !quotaAlertDismissed &&
    quotaMonthlyCount + quotaDailyCount > 0 &&
    !isQuotaAlertDismissed(quotaMonthlyCount, quotaDailyCount);

  const now = new Date();
  const todayLabel = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
  const mt = expenseMonthlyTotals.data?.data || [];
  const thisMonth = mt.find((m) => m.month === thisMonthKey);
  const prevMonth = mt.find((m) => m.month === prevMonthKey);
  const spendThis = thisMonth?.totalAmount ?? 0;
  const spendPrev = prevMonth?.totalAmount ?? 0;
  const spendCurrency = thisMonth?.currency || mt[0]?.currency || 'USD';
  const spendGrowth = spendPrev > 0 ? ((spendThis - spendPrev) / spendPrev) * 100 : (spendThis > 0 ? 100 : 0);
  const totalCollectedInvoices = collectedMetricsQuery.data?.totalCollectedInvoices ?? 0;
  const totalCollectedCash = collectedMetricsQuery.data?.totalCashCollected ?? 0;

  const dashboardWidgets = useMemo(() => {
    const items: Array<{
      key: string;
      title: string;
      value: string;
      subtitle: string;
      to: string;
      icon: React.ElementType;
      accentClass?: string;
      glowClass?: string;
    }> = [];

    if (isReseller) {
      items.push({
        key: "reseller-balance",
        title: "Balance",
        value: resellerBalance === null ? "…" : `${resellerBalance.toFixed(2)}`,
        subtitle: "Reseller wallet",
        to: "/dashboard/widgets/reseller-balance",
        icon: Receipt,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
      items.push({
        key: "reseller-users",
        title: "My Users",
        value: resellerUserCount === null ? "…" : String(resellerUserCount),
        subtitle: "Owned users",
        to: "/dashboard/widgets/reseller-users",
        icon: Users,
        accentClass: "text-blue-600 dark:text-blue-400",
        glowClass: "bg-blue-500",
      });
    }

    if ((!isReseller && canSeeOnline) || isReseller) {
      items.push({
        key: "live-sessions",
        title: "Live Sessions",
        value: String(totalOnlineUsers),
        subtitle: "Current online users",
        to: "/dashboard/widgets/live-sessions",
        icon: Activity,
        accentClass: "text-sky-600 dark:text-sky-400",
        glowClass: "bg-sky-500",
      });
      items.push({
        key: "active-users",
        title: "Active Users",
        value: String(totalActiveUsers),
        subtitle: "Real-time active accounts",
        to: "/dashboard/widgets/active-users",
        icon: UserCheck,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
    }

    if (canSeeExpenses && canSeeTotals) {
      items.push({
        key: "expenses-month",
        title: "Expenses",
        value: expenseMonthlyTotals.isLoading ? "…" : `${spendThis.toFixed(2)} ${spendCurrency}`,
        subtitle: `${thisMonthKey} (${Math.abs(spendGrowth).toFixed(1)}%)`,
        to: "/dashboard/widgets/expenses-month",
        icon: Receipt,
        accentClass: "text-indigo-600 dark:text-indigo-400",
        glowClass: "bg-indigo-500",
      });
    }

    if (canSeeInvoiceCounts) {
      items.push({
        key: "auth-requests",
        title: "Auth Requests",
        value: authMetrics.isLoading
          ? "…"
          : new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(authAttempts),
        subtitle: "Past 24h attempts",
        to: "/dashboard/widgets/auth-requests",
        icon: Shield,
        accentClass: "text-violet-600 dark:text-violet-400",
        glowClass: "bg-violet-500",
      });
    }

    if (canSeeCollections) {
      items.push({
        key: "total-invoices-collected",
        title: "Invoices Collected",
        value: collectedMetricsQuery.isLoading ? "…" : totalCollectedInvoices.toLocaleString(),
        subtitle: "Per-collector breakdown",
        to: "/collections?view=breakdown",
        icon: Receipt,
        accentClass: "text-blue-600 dark:text-blue-400",
        glowClass: "bg-blue-500",
      });
      items.push({
        key: "total-cash-collected",
        title: "Cash Collected",
        value: collectedMetricsQuery.isLoading ? "…" : totalCollectedCash.toFixed(2),
        subtitle: "Collected invoices list",
        to: "/collections?view=list",
        icon: DollarSign,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
    }

    if (canSeeQuotaExceeded) {
      items.push({
        key: "fup-users",
        title: "Users in FUP",
        value: String(fupUsersCount),
        subtitle: `${quotaExceededQuery.data?.dailyCount ?? 0} daily / ${quotaExceededQuery.data?.monthlyCount ?? 0} monthly`,
        to: "/dashboard/widgets/fup-users",
        icon: AlertTriangle,
        accentClass: "text-amber-600 dark:text-amber-400",
        glowClass: "bg-amber-500",
      });
    }

    if (canSeeAlerts) {
      items.push({
        key: "active-alerts",
        title: "Active Alerts",
        value: alertsLoading ? "…" : String(unresolvedAlertsCount),
        subtitle: `${unacknowledgedAlertsCount} unacknowledged`,
        to: "/dashboard/widgets/active-alerts",
        icon: Bell,
        accentClass: "text-red-600 dark:text-red-400",
        glowClass: "bg-red-500",
      });
    }

    return items;
  }, [
    alertsLoading,
    authAttempts,
    authMetrics.isLoading,
    canSeeAlerts,
    canSeeCollections,
    canSeeExpenses,
    canSeeInvoiceCounts,
    canSeeOnline,
    canSeeQuotaExceeded,
    canSeeTotals,
    collectedMetricsQuery.isLoading,
    expenseMonthlyTotals.isLoading,
    fupUsersCount,
    isReseller,
    quotaExceededQuery.data?.dailyCount,
    quotaExceededQuery.data?.monthlyCount,
    resellerBalance,
    resellerUserCount,
    spendCurrency,
    spendGrowth,
    spendThis,
    thisMonthKey,
    totalCollectedCash,
    totalCollectedInvoices,
    totalActiveUsers,
    totalOnlineUsers,
    unacknowledgedAlertsCount,
    unresolvedAlertsCount,
  ]);

  const dashboardPersona = useMemo(() => getDashboardPersona(user), [user]);
  const orderedDashboardWidgets = useMemo(
    () => sortDashboardWidgets(dashboardWidgets, dashboardPersona),
    [dashboardPersona, dashboardWidgets]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
      setLastUpdatedAt(new Date());
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (quotaMonthlyCount + quotaDailyCount === 0) {
      setQuotaAlertDismissed(false);
      return;
    }
    setQuotaAlertDismissed(isQuotaAlertDismissed(quotaMonthlyCount, quotaDailyCount));
  }, [quotaMonthlyCount, quotaDailyCount]);

  useEffect(() => {
    const value = Math.min(Math.max(Math.round(Number(rejectAlertThreshold) || 15), 1), 100);
    localStorage.setItem("dashboard.noc.rejectAlertThreshold", String(value));
  }, [rejectAlertThreshold]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY, watchlistDefaultFilter);
  }, [watchlistDefaultFilter]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY, String(watchlistStaleThresholdSec));
  }, [watchlistStaleThresholdSec]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_AUTO_REFRESH_SECONDS_KEY, String(dashboardAutoRefreshSec));
  }, [dashboardAutoRefreshSec]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_WIDGET_SURFACE_KEY, widgetSurface);
  }, [widgetSurface]);

  useEffect(() => {
    if (!nocHealth.generatedAt) return;
    const generatedAt = nocHealth.generatedAt;
    const key = `${generatedAt}-${nocHealth.dbLatencyMs}-${nocHealth.serverProcessingMs}-${nocHealth.clientRttMs}`;
    setNocHealthTrend((prev) => {
      if (prev.some((p) => p.key === key)) return prev;
      const t = new Date(generatedAt);
      const time = Number.isFinite(t.getTime()) ? t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
      const next: NocHealthSample = {
        key,
        time,
        dbLatencyMs: Number(nocHealth.dbLatencyMs ?? 0),
        serverProcessingMs: Number(nocHealth.serverProcessingMs ?? 0),
        clientRttMs: Number(nocHealth.clientRttMs ?? 0),
      };
      return [...prev.slice(-23), next];
    });
  }, [nocHealth.generatedAt, nocHealth.dbLatencyMs, nocHealth.serverProcessingMs, nocHealth.clientRttMs]);

  // Reseller dashboard data: balance + scoped counts
  useEffect(() => {
    let cancelled = false;
    if (!isReseller) return;

    (async () => {
      try {
        const me = await fetchResellerMe();
        if (cancelled) return;
        setResellerBalance(Number(me.balance ?? 0));
      } catch {
        // ignore; backend will enforce anyway
      }

      try {
        const resp = await apiClient.get('/radius/users', { params: { page: 1, pageSize: 1 } });
        const total = resp?.data?.data?.totalUsers ?? resp?.data?.data?.total ?? 0;
        if (cancelled) return;
        setResellerUserCount(Number(total) || 0);
      } catch {
        // ignore
      }

      try {
        const resp = await apiClient.get('/online-users-metrics');
        if (cancelled) return;
        const d = resp?.data?.data;
        const n = Number(d?.totalOnlineUsers ?? 0);
        setResellerOnlineCount(Number.isFinite(n) ? n : 0);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReseller]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tasks: Array<Promise<unknown>> = [];
      if ((!isReseller && canSeeOnline) || isReseller) {
        tasks.push(onlineWatchlistQuery.refetch());
        tasks.push(nocSnapshotQuery.refetch());
        tasks.push(nocHealthQuery.refetch());
      }
      if (canSeeExpenses) tasks.push(expenseMonthlyTotals.refetch());
      if (canSeeAudit) tasks.push(recentAuditQuery.refetch());
      if (canSeeQuotaExceeded) tasks.push(quotaExceededQuery.refetch());
      tasks.push(nasQuery.refetch());
      await Promise.allSettled(tasks);
      setLastUpdatedAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [
    isReseller,
    canSeeOnline,
    canSeeExpenses,
    canSeeAudit,
    canSeeQuotaExceeded,
    onlineWatchlistQuery,
    nocSnapshotQuery,
    nocHealthQuery,
    expenseMonthlyTotals,
    recentAuditQuery,
    quotaExceededQuery,
    nasQuery,
  ]);

  useEffect(() => {
    if (dashboardAutoRefreshSec <= 0) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isLoading || isRefreshing) return;
      void handleRefresh();
    }, dashboardAutoRefreshSec * 1000);
    return () => window.clearInterval(timer);
  }, [dashboardAutoRefreshSec, isLoading, isRefreshing, handleRefresh]);

  const LoadingSkeleton = () => (
    <>
      {/* Stats Grid Skeleton */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-4 w-4 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-8 w-[60px] mb-2" />
                  <Skeleton className="h-3 w-[80px]" />
                </div>
                <Skeleton className="h-6 w-[60px]" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Health Skeleton */}
      <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-[120px] mb-2" />
                <Skeleton className="h-4 w-[200px]" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-[100px]" />
                  <Skeleton className="h-4 w-[60px]" />
                </div>
                <Skeleton className="h-2 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity Skeleton */}
        <Card className="md:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <Skeleton className="h-6 w-[120px] mb-2" />
                <Skeleton className="h-4 w-[180px]" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-8 w-[80px]" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 rounded-lg border p-3">
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-3 w-[120px]" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-0 animate-in fade-in-50">
      <PageHeader
        variant="gradient"
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        icon={Activity}
        actions={(
          <div className="flex w-full flex-wrap justify-end gap-2">
            <IconActionButton
              label={isRefreshing ? "Refreshing..." : "Refresh Data"}
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
              icon={<RefreshCw className={`h-4 w-4 ${isLoading || isRefreshing ? "animate-spin" : ""}`} />}
            />
            {canSeeAnalytics ? (
              <IconActionButton
                label="View Analytics"
                to="/analytics"
                className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
                icon={<LineChart className="h-4 w-4" />}
              />
            ) : null}
            <IconActionButton
              label="Dashboard settings"
              onClick={() => setIsSettingsOpen(true)}
              className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
              icon={<Settings className="h-4 w-4" />}
            />
            {canSeeAlerts ? (
              <IconActionButton
                label="Alerts"
                to="/alerts"
                className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
                icon={<Bell className="h-4 w-4" />}
              />
            ) : null}
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-2">
        {((!isReseller && canSeeOnline) || isReseller) ? (
          <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
            <Link href="/online-users">
              <Wifi className="mr-2 h-4 w-4" />
              Live Sessions
            </Link>
          </Button>
        ) : null}
        {canAny(user, ["users.view", "reseller.users.view"]) ? (
          <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
            <Link href="/users/list">
              <Users className="mr-2 h-4 w-4" />
              Users
            </Link>
          </Button>
        ) : null}
        {can(user, "radius.profiles.view") ? (
          <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
            <Link href="/profiles/list">
              <Gauge className="mr-2 h-4 w-4" />
              Profiles
            </Link>
          </Button>
        ) : null}
        <div className="ml-auto hidden items-center gap-2 md:flex">
          {lastUpdatedAt ? (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>
          ) : null}
          {dashboardAutoRefreshSec > 0 ? (
            <Badge variant="outline">
              Auto-refresh every {dashboardAutoRefreshSec}s
            </Badge>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : (
        <>
          {showQuotaExceededBanner ? (
            <QuotaExceededSummaryAlert
              monthLabel={thisMonthKey}
              dayLabel={todayLabel}
              monthlyCount={quotaMonthlyCount}
              dailyCount={quotaDailyCount}
              totalUsers={quotaExceededQuery.data?.totalUsers}
              detailHref="/dashboard/widgets/fup-users"
              onClose={() => {
                dismissQuotaAlert(quotaMonthlyCount, quotaDailyCount);
                setQuotaAlertDismissed(true);
              }}
            />
          ) : null}

          {/* KPI widgets */}
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {orderedDashboardWidgets.map((widget) => (
              <DashboardMiniWidget
                key={widget.key}
                title={widget.title}
                value={widget.value}
                subtitle={widget.subtitle}
                to={widget.to}
                icon={widget.icon}
                accentClass={widget.accentClass}
                glowClass={widget.glowClass}
              />
            ))}
          </div>

          {canAny(user, ["users.view", "users.online.view", "reseller.users.view"]) ? (
            <DailyOpsBriefPanel />
          ) : null}

          {/* NOC Snapshot */}
          {((!isReseller && canSeeOnline) || isReseller) ? (
            <div className="grid gap-4 lg:grid-cols-7">
              <Card className="lg:col-span-4 border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle>NOC Snapshot (24h)</CardTitle>
                      <CardDescription>Core operations indicators for authentication and service quality</CardDescription>
                    </div>
                    <Badge variant="outline" className={authHealthBadgeClass}>
                      {authHealthLabel}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border p-2.5">
                    <div className="text-xs text-muted-foreground">Reject alert threshold</div>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      value={rejectAlertThreshold}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        if (!Number.isFinite(next)) return;
                        setRejectAlertThreshold(Math.min(Math.max(Math.round(next), 1), 100));
                      }}
                      className="h-8 w-24"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    {isRejectThresholdBreached ? (
                      <Badge variant="destructive">Threshold breached</Badge>
                    ) : (
                      <Badge variant="secondary">Within threshold</Badge>
                    )}
                  </div>
                  {showRejectThresholdAlert ? (
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/35">
                      <div className="text-sm text-red-700 dark:text-red-200">
                        Reject rate is <span className="font-semibold">{authRejectRate.toFixed(1)}%</span> (threshold {rejectAlertThreshold}%).
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={authFailuresLastHourHref}>Open failed auths</Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => setRejectAlertMutedUntil(Date.now() + 30 * 60 * 1000)}>
                          Mute 30m
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Auth Success Rate</div>
                      <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{authSuccessRate.toFixed(1)}%</div>
                      <div className="mt-1 text-xs text-muted-foreground">{authAccepted} accepted of {authAttempts} attempts</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Auth Reject Rate</div>
                      <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{authRejectRate.toFixed(1)}%</div>
                      <div className="mt-1 text-xs text-muted-foreground">{authRejected} rejected requests</div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">Users in FUP</div>
                      <div className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">
                        {(quotaExceededQuery.data?.dailyCount ?? 0) + (quotaExceededQuery.data?.monthlyCount ?? 0)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {quotaExceededQuery.data?.dailyCount ?? 0} daily / {quotaExceededQuery.data?.monthlyCount ?? 0} monthly
                      </div>
                    </div>
                    <div className="rounded-lg border p-3">
                      <div className="text-xs text-muted-foreground">NAS Devices</div>
                      <div className="mt-1 text-2xl font-semibold text-blue-600 dark:text-blue-400">{totalNas}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Configured NAS entries</div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">Reject Rate Trend</div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-muted-foreground">
                          {rejectTrendDisplayData.length ? `${rejectTrendDisplayData.length} points` : "No data"}
                        </div>
                        <Select
                          value={String(rejectTrendWindowHours)}
                          onValueChange={(v) => {
                            const n = Number(v);
                            if (n === 6 || n === 12 || n === 24) setRejectTrendWindowHours(n);
                          }}
                        >
                          <SelectTrigger className="h-7 w-[92px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent align="end">
                            <SelectItem value="6">Last 6h</SelectItem>
                            <SelectItem value="12">Last 12h</SelectItem>
                            <SelectItem value="24">Last 24h</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="mb-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded border p-1.5">
                        <div className="text-muted-foreground">Attempts</div>
                        <div className="font-semibold">{rejectWindowStats.attempts}</div>
                      </div>
                      <div className="rounded border p-1.5">
                        <div className="text-muted-foreground">Rejected</div>
                        <div className="font-semibold">{rejectWindowStats.rejected}</div>
                      </div>
                      <div className="rounded border p-1.5">
                        <div className="text-muted-foreground">Avg reject</div>
                        <div className="font-semibold">{rejectWindowStats.avgRate.toFixed(1)}%</div>
                      </div>
                    </div>
                    <div className="h-28 w-full">
                      {rejectTrendDisplayData.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <RechartsLineChart data={rejectTrendDisplayData} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
                            <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={20} />
                            <YAxis tick={{ fontSize: 10 }} width={28} domain={[0, 100]} />
                            <RechartsTooltip
                              formatter={(value: number, _name: string, item: any) => {
                                const attempts = Number(item?.payload?.attempts ?? 0);
                                const rejected = Number(item?.payload?.rejected ?? 0);
                                return [`${Number(value).toFixed(1)}%`, `Reject rate (${rejected}/${attempts})`];
                              }}
                            />
                            <RechartsLine
                              type="monotone"
                              dataKey="rejectRate"
                              stroke="#dc2626"
                              strokeWidth={2}
                              dot={{ r: 2 }}
                              activeDot={{
                                r: 5,
                                onClick: (_event: any, payload: any) => {
                                  const bucket = payload?.payload?.bucket;
                                  if (bucket) setSelectedRejectBucket(String(bucket));
                                },
                                style: { cursor: "pointer" },
                              }}
                            />
                          </RechartsLineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                          Not enough auth history yet
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3 border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Live Session Watchlist</CardTitle>
                      <CardDescription>Latest active sessions for quick triage</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onlineWatchlistQuery.refetch()}
                      disabled={onlineWatchlistQuery.isFetching}
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${onlineWatchlistQuery.isFetching ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {onlineWatchlistQuery.isLoading ? (
                    <div className="space-y-2">
                      {[...Array(5)].map((_, idx) => (
                        <Skeleton key={idx} className="h-10 w-full" />
                      ))}
                    </div>
                  ) : filteredWatchlistRows.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No sessions match the selected watchlist filter.</div>
                  ) : (
                    <div className="space-y-2">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <FilterPills
                          value={watchlistFilter}
                          onChange={(v) => setWatchlistFilter(v as WatchlistFilter)}
                          options={[
                            { value: "all", label: `All (${watchlistRows.length})` },
                            { value: "fup", label: `FUP (${watchlistCounts.fup})` },
                            { value: "stale", label: `Stale (${watchlistCounts.stale})` },
                          ]}
                          name="dashboard-watchlist-filter"
                        />
                      </div>
                      {filteredWatchlistRows.map((row) => (
                        <div key={`${row.session_username}-${row.session_mac_address}`} className="flex items-center justify-between rounded-lg border p-2.5">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{row.session_username}</div>
                            <div className="truncate text-xs text-muted-foreground">
                              {row.profile_profile_name || "No profile"} • Last update {formatAgo(row.session_last_update)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isSessionStale(row.session_last_update, watchlistStaleThresholdSec) ? (
                              <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50">
                                Stale
                              </Badge>
                            ) : null}
                            <Badge variant={row.is_fallback ? "destructive" : "secondary"}>
                              {row.is_fallback ? "FUP" : "Normal"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="my-3 border-t" />
                  <div className="mb-3 rounded-lg border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">API Health</div>
                      <Badge variant="outline" className={healthBadgeClass}>{healthState}</Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">DB latency</div>
                        <div className="font-semibold">{Math.round(Number(nocHealth.dbLatencyMs ?? 0))} ms</div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Server processing</div>
                        <div className="font-semibold">{Math.round(Number(nocHealth.serverProcessingMs ?? 0))} ms</div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Client RTT</div>
                        <div className="font-semibold">{Math.round(Number(nocHealth.clientRttMs ?? 0))} ms</div>
                      </div>
                      <div className="rounded border p-2">
                        <div className="text-muted-foreground">Active sessions</div>
                        <div className="font-semibold">{Number(nocHealth.activeSessions ?? 0)}</div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="inline-flex items-center gap-1">
                        <Server className="h-3.5 w-3.5" />
                        {nocHealthQuery.isFetching ? "Refreshing..." : "Auto-refresh 30s"}
                      </div>
                      <div>
                        {nocHealth.generatedAt ? `Updated ${new Date(nocHealth.generatedAt).toLocaleTimeString()}` : "No sample yet"}
                      </div>
                    </div>
                    <div className="mt-3 rounded border p-2">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Latency trend ({nocHealthTrend.length} samples)</span>
                        <span>{degradedHealthSamples} degraded</span>
                      </div>
                      <div className="h-20 w-full">
                        {nocHealthTrend.length ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={nocHealthTrend} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
                              <XAxis dataKey="time" tick={{ fontSize: 10 }} minTickGap={16} />
                              <YAxis tick={{ fontSize: 10 }} width={26} />
                              <RechartsTooltip />
                              <RechartsLine type="monotone" dataKey="dbLatencyMs" stroke="#8b5cf6" strokeWidth={1.5} dot={false} />
                              <RechartsLine type="monotone" dataKey="serverProcessingMs" stroke="#0284c7" strokeWidth={1.5} dot={false} />
                              <RechartsLine type="monotone" dataKey="clientRttMs" stroke="#dc2626" strokeWidth={1.5} dot={false} />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Collecting samples...</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-medium">Top NAS by Active Sessions</div>
                    <Button variant="ghost" size="sm" onClick={() => nocSnapshotQuery.refetch()} disabled={nocSnapshotQuery.isFetching}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${nocSnapshotQuery.isFetching ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                  {!topNasBySessions.length ? (
                    <div className="text-sm text-muted-foreground">No NAS session data available.</div>
                  ) : (
                    <div className="space-y-2">
                      {topNasBySessions.map((nas) => (
                        <Link
                          key={`${nas.nasIp}-${nas.nasLabel}`}
                          href={`/online-users?search=${encodeURIComponent(nas.nasIp)}`}
                          className="block rounded-lg border border-border p-2.5 transition-colors hover:bg-muted/60"
                          title="Open live sessions filtered by this NAS"
                        >
                          <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{nas.nasLabel || nas.nasIp}</div>
                            <div className="truncate text-xs text-muted-foreground">{nas.nasIp}</div>
                          </div>
                          <Badge variant="secondary">{nas.sessions} sessions</Badge>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Reject-rate drilldown dialog */}
          <Dialog open={Boolean(selectedRejectBucket)} onOpenChange={(open) => (open ? null : setSelectedRejectBucket(null))}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <DialogTitle>
                    Failed Auth Attempts
                    {selectedRange ? ` (${selectedRange.from.toLocaleString()} - ${selectedRange.to.toLocaleTimeString()})` : ""}
                  </DialogTitle>
                  <Button asChild variant="outline" size="sm">
                    <Link href={authFailuresPageHref}>Open full page</Link>
                  </Button>
                </div>
              </DialogHeader>
              {authFailuresQuery.isLoading ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : !authFailuresQuery.data?.rows?.length ? (
                <div className="text-sm text-muted-foreground">No failed auth rows found for this hour.</div>
              ) : (
                <div className="max-h-[420px] overflow-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                      <tr className="text-left">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">NAS</th>
                        <th className="px-3 py-2">MAC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {authFailuresQuery.data.rows.map((r) => (
                        <tr key={String(r.id)} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}</td>
                          <td className="px-3 py-2">{r.username || "-"}</td>
                          <td className="px-3 py-2">
                            <Badge variant="destructive">{r.status || "failed"}</Badge>
                          </td>
                          <td className="px-3 py-2">{r.nasIp || "-"}</td>
                          <td className="px-3 py-2">{r.macAddress || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* System Stats and Activity */}
          <div className="grid w-full min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-7">
            {/* Platform health — real API / auth metrics (replaces static placeholder bars) */}
            {((!isReseller && canSeeOnline) || isReseller) ? (
              <Card className="w-full min-w-0 md:col-span-4 border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Platform Health</CardTitle>
                      <CardDescription>Authentication quality and API latency from live probes</CardDescription>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={authHealthBadgeClass}>
                        Auth {authHealthLabel}
                      </Badge>
                      <Badge variant="outline" className={healthBadgeClass}>
                        API {healthState}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-violet-600" />
                          <span className="font-medium">Auth success rate (24h)</span>
                        </div>
                        <span className="font-semibold tabular-nums">{authSuccessRate.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${healthBarTone(100 - authSuccessRate)}`}
                          style={{ width: `${Math.min(100, Math.max(0, authSuccessRate))}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {authAccepted.toLocaleString()} accepted · {authRejected.toLocaleString()} rejected
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-blue-600" />
                          <span className="font-medium">Database latency</span>
                        </div>
                        <span className="font-semibold tabular-nums">{Math.round(nocHealth.dbLatencyMs)} ms</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${healthBarTone(latencyLoadPct(nocHealth.dbLatencyMs, 120, 400))}`}
                          style={{ width: `${latencyLoadPct(nocHealth.dbLatencyMs, 120, 400)}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-emerald-600" />
                          <span className="font-medium">Client round-trip</span>
                        </div>
                        <span className="font-semibold tabular-nums">{Math.round(nocHealth.clientRttMs)} ms</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all ${healthBarTone(latencyLoadPct(nocHealth.clientRttMs, 800, 2000))}`}
                          style={{ width: `${latencyLoadPct(nocHealth.clientRttMs, 800, 2000)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Active sessions</div>
                      <div className="mt-1 text-xl font-bold tabular-nums">{Number(nocHealth.activeSessions ?? 0)}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">NAS devices</div>
                      <div className="mt-1 text-xl font-bold tabular-nums">{totalNas}</div>
                    </div>
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="text-xs text-muted-foreground">Users in FUP</div>
                      <div className="mt-1 text-xl font-bold tabular-nums text-amber-600">{fupUsersCount}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="w-full min-w-0 md:col-span-4 border-border/70 shadow-sm">
                <CardHeader>
                  <CardTitle>Overview</CardTitle>
                  <CardDescription>Key metrics from your assigned widgets above</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Use the KPI cards above for quick access to sessions, users, billing, and alerts.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            {canSeeAudit ? (
              <Card className="w-full min-w-0 md:col-span-3 border-border/70 shadow-sm">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle>Recent Activity</CardTitle>
                      <CardDescription>Latest admin and reseller actions</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => recentAuditQuery.refetch()}
                      disabled={recentAuditQuery.isFetching}
                      className="w-full justify-center border-border bg-background/90 text-foreground shadow-sm hover:bg-accent dark:bg-card/90 sm:w-auto"
                    >
                      <RefreshCw className={`mr-2 h-4 w-4 ${recentAuditQuery.isFetching ? "animate-spin" : ""}`} />
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {recentAuditQuery.isLoading ? (
                    <div className="space-y-3">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                          <Skeleton className="h-8 w-8 rounded-full" />
                          <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-[220px]" />
                            <Skeleton className="h-3 w-[140px]" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : recentAuditQuery.error ? (
                    <div className="text-sm text-red-600">Failed to load activity.</div>
                  ) : recentAudit.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No recent activity.</div>
                  ) : (
                    <div className="space-y-3">
                      {recentAudit.map((e) => (
                        <div
                          key={String(e.id)}
                          className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
                        >
                          <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                            <UserIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">{e.title}</div>
                            <div className="text-xs text-muted-foreground truncate">
                              Actor: {e.actor}
                              {e.primaryTarget ? (
                                <>
                                  {" • "}
                                  Target:{" "}
                                  <a className="underline" href={`/users/${encodeURIComponent(String(e.primaryTarget))}`}>
                                    {String(e.primaryTarget)}
                                  </a>
                                </>
                              ) : null}
                              {e.detail ? (
                                <>
                                  {" • "}
                                  {e.detail}
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                            <Clock className="h-3.5 w-3.5" />
                            {e.ts ? e.ts.toLocaleTimeString() : "—"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {/* Bandwidth Widget */}
            <div className="col-span-full w-full min-w-0 lg:col-span-3">
              <BandwidthWidget />
            </div>

            {/* Analytics Widget */}
            <div className="col-span-full w-full min-w-0 lg:col-span-2">
              {canSeeAnalytics ? <AnalyticsWidget /> : null}
            </div>

            {/* Alert Notifications */}
            <div className="col-span-full w-full min-w-0 lg:col-span-1">
              {canSeeAlerts ? <AlertNotification maxAlerts={5} /> : null}
            </div>
          </div>
        </>
      )}

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Dashboard settings</DialogTitle>
            <DialogDescription>
              Configure how watchlist triage and refresh behavior works on this dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Watchlist default filter</div>
              <Select
                value={watchlistDefaultFilter}
                onValueChange={(value) => {
                  const next = (value === "fup" || value === "stale" || value === "all")
                    ? (value as WatchlistFilter)
                    : "all";
                  setWatchlistDefaultFilter(next);
                  setWatchlistFilter(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sessions</SelectItem>
                  <SelectItem value="fup">FUP only</SelectItem>
                  <SelectItem value="stale">Stale only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Stale session threshold</div>
              <Select
                value={String(watchlistStaleThresholdSec)}
                onValueChange={(value) => {
                  const next = Number(value);
                  if (next === 30 || next === 60 || next === 120) {
                    setWatchlistStaleThresholdSec(next);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">60 seconds</SelectItem>
                  <SelectItem value="120">120 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Auto refresh dashboard data</div>
              <Select
                value={String(dashboardAutoRefreshSec)}
                onValueChange={(value) => {
                  const next = Number(value);
                  if (next === 0 || next === 30 || next === 60 || next === 120) {
                    setDashboardAutoRefreshSec(next);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Off</SelectItem>
                  <SelectItem value="30">Every 30 seconds</SelectItem>
                  <SelectItem value="60">Every 60 seconds</SelectItem>
                  <SelectItem value="120">Every 2 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Widget background</div>
              <Select
                value={widgetSurface}
                onValueChange={(value) => {
                  if (value === "white" || value === "theme") {
                    setWidgetSurface(value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="white">White</SelectItem>
                  <SelectItem value="theme">Theme default</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWatchlistDefaultFilter("all");
                setWatchlistFilter("all");
                setWatchlistStaleThresholdSec(60);
                setDashboardAutoRefreshSec(0);
                setWidgetSurface("white");
              }}
            >
              Reset defaults
            </Button>
            <Button onClick={() => setIsSettingsOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;