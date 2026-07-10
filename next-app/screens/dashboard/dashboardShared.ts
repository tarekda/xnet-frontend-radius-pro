/** Shared types, storage helpers, and pure formatting utilities for the dashboard feature. */

export type AuditLogRow = {
  id: number;
  level: string;
  message: string;
  meta: any;
  timestamp: string;
};

export type NocHealthSample = {
  key: string;
  time: string;
  dbLatencyMs: number;
  serverProcessingMs: number;
  clientRttMs: number;
};

export type NocHealth = {
  generatedAt: string | null;
  dbLatencyMs: number;
  serverProcessingMs: number;
  activeSessions: number;
  clientRttMs: number;
};

export type RejectTrendPoint = {
  bucket: string;
  time: string;
  attempts: number;
  rejected: number;
  rejectRate: number;
};

export type TopNasEntry = { nasIp: string; nasLabel: string; sessions: number };

export type HealthState = "Healthy" | "Warning" | "Critical" | "Down";

export type WatchlistFilter = "all" | "fup" | "stale";
export type DashboardAutoRefreshSeconds = 0 | 30 | 60 | 120;
export type WatchlistStaleThresholdSeconds = 30 | 60 | 120;
export type DashboardWidgetSurface = "white" | "theme";

export const DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY = "dashboard.watchlist.defaultFilter";
export const DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY = "dashboard.watchlist.staleAfterSeconds";
export const DASHBOARD_AUTO_REFRESH_SECONDS_KEY = "dashboard.autoRefreshSeconds";
export const DASHBOARD_WIDGET_SURFACE_KEY = "dashboard.widgetSurface";
export const DASHBOARD_QUOTA_ALERT_DISMISS_KEY = "dashboard.quotaAlert.dismissedCounts";
export const DASHBOARD_REJECT_ALERT_THRESHOLD_KEY = "dashboard.noc.rejectAlertThreshold";

export const getStoredWatchlistFilter = (): WatchlistFilter => {
  const raw = localStorage.getItem(DASHBOARD_WATCHLIST_DEFAULT_FILTER_KEY);
  return raw === "fup" || raw === "stale" || raw === "all" ? raw : "all";
};

export const getStoredStaleThreshold = (): WatchlistStaleThresholdSeconds => {
  const raw = Number(localStorage.getItem(DASHBOARD_WATCHLIST_STALE_THRESHOLD_KEY));
  return raw === 30 || raw === 60 || raw === 120 ? raw : 60;
};

export const getStoredAutoRefreshSeconds = (): DashboardAutoRefreshSeconds => {
  const raw = Number(localStorage.getItem(DASHBOARD_AUTO_REFRESH_SECONDS_KEY));
  return raw === 0 || raw === 30 || raw === 60 || raw === 120 ? raw : 0;
};

export const getStoredWidgetSurface = (): DashboardWidgetSurface => {
  const raw = localStorage.getItem(DASHBOARD_WIDGET_SURFACE_KEY);
  return raw === "theme" || raw === "white" ? raw : "white";
};

export const getStoredRejectAlertThreshold = (): number => {
  const raw = localStorage.getItem(DASHBOARD_REJECT_ALERT_THRESHOLD_KEY);
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 15;
  return Math.min(Math.max(Math.round(parsed), 1), 100);
};

export function isQuotaAlertDismissed(monthlyCount: number, dailyCount: number): boolean {
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

export function dismissQuotaAlert(monthlyCount: number, dailyCount: number): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DASHBOARD_QUOTA_ALERT_DISMISS_KEY,
    JSON.stringify({ monthly: monthlyCount, daily: dailyCount })
  );
}

export function healthBarTone(pct: number): string {
  if (pct >= 85) return "bg-red-500";
  if (pct >= 60) return "bg-amber-500";
  return "bg-emerald-500";
}

export function latencyLoadPct(ms: number, warnAt: number, criticalAt: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  if (ms >= criticalAt) return 100;
  if (ms <= warnAt) return Math.round((ms / warnAt) * 45);
  return Math.round(45 + ((ms - warnAt) / (criticalAt - warnAt)) * 55);
}

/** Badge classes shared by the "Healthy / Warning / Critical" states. */
export function healthBadgeClassFor(state: string): string {
  if (state === "Healthy") {
    return "border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/45 dark:text-green-300";
  }
  if (state === "Warning") {
    return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200";
  }
  return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/45 dark:text-red-300";
}

export const formatAgo = (iso: string | null | undefined) => {
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

export const isSessionStale = (iso: string | null | undefined, staleAfterSeconds: number = 60) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return true;
  return (Date.now() - t) / 1000 > staleAfterSeconds;
};

export function formatAuditTitle(action: string, meta: any): { title: string; detail?: string } {
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
