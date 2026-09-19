import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  Activity,
  RefreshCw,
  Bell,
  Settings,
  LineChart,
  Gauge,
  Wifi,
} from 'lucide-react';
import { useTranslation } from "react-i18next";

import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QuotaExceededSummaryAlert } from "@/components/ui/Alert";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

import { useAlerts } from '@/hooks/useAlerts';
import { useAuth } from '@/context/AuthContext';
import { can, canAny, COMPANY_WALLET_VIEW_PERMS } from '@/lib/permissions';
import { apiClient } from '@/api/client';
import { fetchCompanyWalletBalance } from '@/api/companyWallet';
import { useOnlineMetrics } from '@/hooks/useOnlineMetrics';
import { useExpenseMonthlyTotals } from '@/hooks/useExpenses';
import { useAuthMetrics } from "@/hooks/useAuthMetrics";
import { useCollectedMetrics } from '@/hooks/useInvoices';
import useNas from "@/hooks/useNas";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";

import {
  DASHBOARD_AUTO_REFRESH_SECONDS_KEY,
  DASHBOARD_REJECT_ALERT_THRESHOLD_KEY,
  DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY,
  DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY,
  DASHBOARD_WIDGET_SURFACE_KEY,
  dismissQuotaAlert,
  getStoredAutoRefreshSeconds,
  getStoredRejectAlertThreshold,
  getStoredStaleThreshold,
  getStoredWatchlistFilter,
  getStoredWidgetSurface,
  healthBadgeClassFor,
  isQuotaAlertDismissed,
  isSessionStale,
  type DashboardAutoRefreshSeconds,
  type DashboardWidgetSurface,
  type NocHealthSample,
  type WatchlistFilter,
  type WatchlistStaleThresholdSeconds,
} from "./dashboardShared";
import DashboardMiniWidget from "./DashboardMiniWidget";
import DashboardSkeleton from "./DashboardSkeleton";
import DashboardSettingsDialog from "./DashboardSettingsDialog";
import NocSnapshotCard from "./NocSnapshotCard";
import WatchlistCard from "./WatchlistCard";
import PlatformHealthCard from "./PlatformHealthCard";
import RecentActivityCard, { RECENT_AUDIT_QUERY_KEY } from "./RecentActivityCard";
import RejectDrilldownDialog from "./RejectDrilldownDialog";
import { useDashboardWidgets } from "./useDashboardWidgets";
import { useResellerSummary } from "./useResellerSummary";

// Below-fold widgets — lazy-loaded so they don't block first dashboard paint
const AnalyticsWidget = dynamic(() => import("@/components/AnalyticsWidget"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full" />,
});
const BandwidthWidget = dynamic(() => import("@/components/BandwidthWidget"), {
  ssr: false,
  loading: () => <Skeleton className="h-[280px] w-full" />,
});
const DailyOpsBriefPanel = dynamic(() => import("@/components/DailyOpsBriefPanel"), {
  ssr: false,
  loading: () => <Skeleton className="h-32 w-full" />,
});
const AlertNotification = dynamic(() => import("@/components/AlertNotification"), {
  ssr: false,
  loading: () => <Skeleton className="h-[200px] w-full" />,
});
const GlobalTrafficMap = dynamic(() => import("@/components/GlobalTrafficMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[500px] w-full" />,
});


const Dashboard: React.FC = () => {
  const { t } = useTranslation("screens");
  const queryClient = useQueryClient();
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
  const [rejectAlertThreshold, setRejectAlertThreshold] = useState<number>(() => getStoredRejectAlertThreshold());
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
  const canSeeCompanyWallet = !isReseller && canAny(user, [...COMPANY_WALLET_VIEW_PERMS]);
  const canSeeAudit = canAny(user, ['users.view', 'reseller.users.view']);
  const canSeeQuotaExceeded = canAny(user, ['users.view', 'reseller.users.view']);
  const showNocSection = (!isReseller && canSeeOnline) || isReseller;

  const { data: alerts, isLoading: alertsLoading } = useAlerts();
  const onlineMetrics = useOnlineMetrics();
  const expenseMonthlyTotals = useExpenseMonthlyTotals();
  const authMetrics = useAuthMetrics(86400);
  const collectedMetricsQuery = useCollectedMetrics();
  const nasQuery = useNas(1, 1);
  const onlineWatchlistQuery = useOnlineUsers("", 1, 5, {
    enabled: showNocSection,
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
    enabled: showNocSection,
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
    enabled: showNocSection,
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

  const authAttempts = authMetrics.data?.current.attempts ?? 0;
  const authAccepted = authMetrics.data?.current.accepted ?? 0;
  const authRejected = authMetrics.data?.current.rejected ?? 0;
  const authSuccessRate = authAttempts > 0 ? (authAccepted / authAttempts) * 100 : 0;
  const authRejectRate = authAttempts > 0 ? (authRejected / authAttempts) * 100 : 0;
  const authHealthLabel =
    authRejectRate <= 5 ? "Healthy" : authRejectRate <= 15 ? "Warning" : "Critical";
  const authHealthBadgeClass = healthBadgeClassFor(authHealthLabel);
  const isRejectThresholdBreached = authAttempts >= 20 && authRejectRate >= rejectAlertThreshold;
  const isRejectAlertMuted = Date.now() < rejectAlertMutedUntil;
  const showRejectThresholdAlert = isRejectThresholdBreached && !isRejectAlertMuted;
  const totalNas = nasQuery.data?.data?.totalEntries ?? 0;
  const watchlistRows = useMemo(
    () => onlineWatchlistQuery.data?.data ?? [],
    [onlineWatchlistQuery.data?.data]
  );
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
  const rejectTrendData = useMemo(
    () =>
      (nocSnapshotQuery.data?.authRejectTrend ?? []).map((r) => ({
        bucket: r.bucket,
        time: String(r.bucket || "").slice(11, 16),
        attempts: Number(r.attempts ?? 0),
        rejected: Number(r.rejected ?? 0),
        rejectRate: Number(r.rejectRate ?? 0),
      })),
    [nocSnapshotQuery.data?.authRejectTrend]
  );
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
  const healthBadgeClass = healthBadgeClassFor(healthState);
  const degradedHealthSamples = useMemo(() => {
    return nocHealthTrend.filter(
      (s) => s.dbLatencyMs > 400 || s.serverProcessingMs > 800 || s.clientRttMs > 2000
    ).length;
  }, [nocHealthTrend]);
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

  // Reseller dashboard data: balance + scoped counts
  const resellerSummary = useResellerSummary(isReseller);
  const companyWalletQuery = useQuery({
    queryKey: ["company-wallet", "balance"],
    queryFn: fetchCompanyWalletBalance,
    enabled: canSeeCompanyWallet,
    refetchInterval: 60000,
  });

  const totalOnlineUsers = isReseller ? (resellerSummary.onlineCount ?? 0) : onlineMetrics.totalOnlineUsers;
  const totalActiveUsers = isReseller ? (resellerSummary.onlineCount ?? 0) : onlineMetrics.totalActiveUsers;
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

  const orderedDashboardWidgets = useDashboardWidgets({
    isReseller,
    canSeeOnline,
    canSeeExpenses,
    canSeeTotals,
    canSeeInvoiceCounts,
    canSeeCollections,
    canSeeQuotaExceeded,
    canSeeAlerts,
    canSeeCompanyWallet,
    companyWalletBalance: companyWalletQuery.data ?? null,
    companyWalletLoading: companyWalletQuery.isLoading,
    resellerBalance: resellerSummary.balance,
    resellerUserCount: resellerSummary.userCount,
    totalOnlineUsers,
    totalActiveUsers,
    expensesLoading: expenseMonthlyTotals.isLoading,
    spendThis,
    spendCurrency,
    spendGrowth,
    thisMonthKey,
    authMetricsLoading: authMetrics.isLoading,
    authAttempts,
    collectedMetricsLoading: collectedMetricsQuery.isLoading,
    totalCollectedInvoices,
    totalCollectedCash,
    fupUsersCount,
    quotaDailyCount,
    quotaMonthlyCount,
    alertsLoading,
    unresolvedAlertsCount,
    unacknowledgedAlertsCount,
  });

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
    localStorage.setItem(DASHBOARD_REJECT_ALERT_THRESHOLD_KEY, String(value));
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

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const tasks: Array<Promise<unknown>> = [];
      if (showNocSection) {
        tasks.push(onlineWatchlistQuery.refetch());
        tasks.push(nocSnapshotQuery.refetch());
        tasks.push(nocHealthQuery.refetch());
      }
      if (canSeeExpenses) tasks.push(expenseMonthlyTotals.refetch());
      if (canSeeAudit) tasks.push(queryClient.invalidateQueries({ queryKey: RECENT_AUDIT_QUERY_KEY }));
      if (canSeeQuotaExceeded) tasks.push(quotaExceededQuery.refetch());
      tasks.push(nasQuery.refetch());
      await Promise.allSettled(tasks);
      setLastUpdatedAt(new Date());
    } finally {
      setIsRefreshing(false);
    }
  }, [
    showNocSection,
    canSeeExpenses,
    canSeeAudit,
    canSeeQuotaExceeded,
    onlineWatchlistQuery,
    nocSnapshotQuery,
    nocHealthQuery,
    expenseMonthlyTotals,
    quotaExceededQuery,
    nasQuery,
    queryClient,
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

  const handleWatchlistDefaultFilterChange = useCallback((next: WatchlistFilter) => {
    setWatchlistDefaultFilter(next);
    setWatchlistFilter(next);
  }, []);

  const handleResetSettings = useCallback(() => {
    setWatchlistDefaultFilter("all");
    setWatchlistFilter("all");
    setWatchlistStaleThresholdSec(60);
    setDashboardAutoRefreshSec(0);
    setWidgetSurface("white");
  }, []);

  return (
    <div className="w-full space-y-4 animate-in fade-in-50">
      <PageHeader
        variant="card"
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        icon={Activity}
        className="rounded-lg border-border bg-card p-4 shadow-none sm:p-4"
        actions={(
          <div className="flex w-full flex-wrap justify-end gap-2">
            <IconActionButton
              label={isRefreshing ? "Refreshing..." : "Refresh Data"}
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="border-border bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              icon={<RefreshCw className={`h-4 w-4 ${isLoading || isRefreshing ? "animate-spin" : ""}`} />}
            />
            {canSeeAnalytics ? (
              <IconActionButton
                label="View Analytics"
                to="/analytics"
                className="border-border bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                icon={<LineChart className="h-4 w-4" />}
              />
            ) : null}
            <IconActionButton
              label="Dashboard settings"
              onClick={() => setIsSettingsOpen(true)}
              className="border-border bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
              icon={<Settings className="h-4 w-4" />}
            />
            {canSeeAlerts ? (
              <IconActionButton
                label="Alerts"
                to="/alerts"
                className="border-border bg-background text-foreground shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
                icon={<Bell className="h-4 w-4" />}
              />
            ) : null}
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        {showNocSection ? (
          <Button variant="outline" size="sm" className="h-8 rounded-md border-border bg-card shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary" asChild>
            <Link href="/online-users">
              <Wifi className="mr-2 h-4 w-4" />
              Live Sessions
            </Link>
          </Button>
        ) : null}
        {canAny(user, ["users.view", "reseller.users.view"]) ? (
          <Button variant="outline" size="sm" className="h-8 rounded-md border-border bg-card shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary" asChild>
            <Link href="/users/list">
              <Users className="mr-2 h-4 w-4" />
              Users
            </Link>
          </Button>
        ) : null}
        {can(user, "radius.profiles.view") ? (
          <Button variant="outline" size="sm" className="h-8 rounded-md border-border bg-card shadow-none hover:border-primary/30 hover:bg-primary/5 hover:text-primary" asChild>
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
            <Badge variant="outline" className="rounded-md border-primary/20 bg-primary/5 text-primary">
              Auto-refresh every {dashboardAutoRefreshSec}s
            </Badge>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <DashboardSkeleton />
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

          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">Operational overview</h2>
              <p className="text-xs text-muted-foreground">Live account, network, and billing indicators</p>
            </div>
            <Badge variant="outline" className="hidden rounded-md border-primary/20 bg-primary/5 text-primary sm:inline-flex">
              {orderedDashboardWidgets.length} metrics
            </Badge>
          </div>

          {/* KPI widgets */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {orderedDashboardWidgets.map((widget, i) => (
              <div key={widget.key} className={`animate-scale-in stagger-${Math.min(i + 1, 8)}`}>
              <DashboardMiniWidget
                title={widget.title}
                value={widget.value}
                subtitle={widget.subtitle}
                to={widget.to}
                icon={widget.icon}
                accentClass={widget.accentClass}
                glowClass={widget.glowClass}
              />
              </div>
            ))}
          </div>

          {canAny(user, ["users.view", "users.online.view", "reseller.users.view"]) ? (
            <DailyOpsBriefPanel />
          ) : null}

          {/* NOC Snapshot */}
          {showNocSection ? (
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-foreground">Network operations</h2>
                <p className="text-xs text-muted-foreground">Authentication quality, live sessions, and infrastructure health</p>
              </div>
              <div className="grid gap-3 lg:grid-cols-7">
              <NocSnapshotCard
                authHealthLabel={authHealthLabel}
                authHealthBadgeClass={authHealthBadgeClass}
                authSuccessRate={authSuccessRate}
                authRejectRate={authRejectRate}
                authAttempts={authAttempts}
                authAccepted={authAccepted}
                authRejected={authRejected}
                rejectAlertThreshold={rejectAlertThreshold}
                onRejectAlertThresholdChange={setRejectAlertThreshold}
                isRejectThresholdBreached={isRejectThresholdBreached}
                showRejectThresholdAlert={showRejectThresholdAlert}
                authFailuresLastHourHref={authFailuresLastHourHref}
                onMuteRejectAlert={() => setRejectAlertMutedUntil(Date.now() + 30 * 60 * 1000)}
                quotaDailyCount={quotaDailyCount}
                quotaMonthlyCount={quotaMonthlyCount}
                totalNas={totalNas}
                rejectTrendDisplayData={rejectTrendDisplayData}
                rejectTrendWindowHours={rejectTrendWindowHours}
                onRejectTrendWindowChange={setRejectTrendWindowHours}
                rejectWindowStats={rejectWindowStats}
                onSelectRejectBucket={setSelectedRejectBucket}
              />

              <WatchlistCard
                watchlistLoading={onlineWatchlistQuery.isLoading}
                watchlistFetching={onlineWatchlistQuery.isFetching}
                onRefreshWatchlist={() => onlineWatchlistQuery.refetch()}
                watchlistRows={watchlistRows}
                filteredWatchlistRows={filteredWatchlistRows}
                watchlistCounts={watchlistCounts}
                watchlistFilter={watchlistFilter}
                onWatchlistFilterChange={setWatchlistFilter}
                watchlistStaleThresholdSec={watchlistStaleThresholdSec}
                nocHealth={nocHealth}
                healthState={healthState}
                healthBadgeClass={healthBadgeClass}
                nocHealthFetching={nocHealthQuery.isFetching}
                nocHealthTrend={nocHealthTrend}
                degradedHealthSamples={degradedHealthSamples}
                topNasBySessions={topNasBySessions}
                onRefreshSnapshot={() => nocSnapshotQuery.refetch()}
                snapshotFetching={nocSnapshotQuery.isFetching}
              />
              </div>
            </section>
          ) : null}

          {/* Reject-rate drilldown dialog */}
          <RejectDrilldownDialog
            selectedRejectBucket={selectedRejectBucket}
            onClose={() => setSelectedRejectBucket(null)}
          />

          {/* System Stats and Activity */}
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">System activity</h2>
              <p className="text-xs text-muted-foreground">Health signals, recent changes, and usage trends</p>
            </div>
            <div className="grid w-full min-w-0 gap-3 md:grid-cols-2 lg:grid-cols-7">
            {/* Platform health — real API / auth metrics */}
            {showNocSection ? (
              <PlatformHealthCard
                authHealthLabel={authHealthLabel}
                authHealthBadgeClass={authHealthBadgeClass}
                authSuccessRate={authSuccessRate}
                authAccepted={authAccepted}
                authRejected={authRejected}
                healthState={healthState}
                healthBadgeClass={healthBadgeClass}
                nocHealth={nocHealth}
                totalNas={totalNas}
                fupUsersCount={fupUsersCount}
              />
            ) : (
              <Card className="w-full min-w-0 md:col-span-4">
                <CardHeader className="p-4">
                  <CardTitle>Overview</CardTitle>
                  <CardDescription>Key metrics from your assigned widgets above</CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-sm text-muted-foreground">
                    Use the KPI cards above for quick access to sessions, users, billing, and alerts.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            {canSeeAudit ? <RecentActivityCard enabled={Boolean(canSeeAudit) && !isLoading} /> : null}

            {/* Global Traffic Map */}
            <div className="col-span-full w-full min-w-0 lg:col-span-4">
              <GlobalTrafficMap />
            </div>

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
          </section>
        </>
      )}

      <DashboardSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        watchlistDefaultFilter={watchlistDefaultFilter}
        onWatchlistDefaultFilterChange={handleWatchlistDefaultFilterChange}
        watchlistStaleThresholdSec={watchlistStaleThresholdSec}
        onWatchlistStaleThresholdChange={setWatchlistStaleThresholdSec}
        dashboardAutoRefreshSec={dashboardAutoRefreshSec}
        onAutoRefreshChange={setDashboardAutoRefreshSec}
        widgetSurface={widgetSurface}
        onWidgetSurfaceChange={setWidgetSurface}
        onResetDefaults={handleResetSettings}
      />
    </div>
  );
};

export default Dashboard;
