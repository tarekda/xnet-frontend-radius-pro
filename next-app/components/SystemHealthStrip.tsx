import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { useAppPreferences } from "@/context/AppPreferencesContext";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { Activity, X } from "lucide-react";

export default function SystemHealthStrip() {
  const { t } = useTranslation("common");
  const { showHealthStrip, setShowHealthStrip } = useAppPreferences();
  const { user } = useAuth();
  const isReseller = user?.role === "reseller";
  const canSeeOnline = can(user, "users.online.view");
  const enabled = Boolean(user) && showHealthStrip && ((!isReseller && canSeeOnline) || isReseller);

  const q = useQuery({
    queryKey: ["noc-health", "strip"],
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
      return { ...payload, clientRttMs };
    },
    enabled,
    refetchInterval: 30000,
  });

  if (!enabled) return null;

  const noc = q.data ?? {
    generatedAt: null,
    dbLatencyMs: 0,
    serverProcessingMs: 0,
    activeSessions: 0,
    clientRttMs: 0,
  };

  const healthState = q.isError
    ? "Down"
    : noc.dbLatencyMs <= 120 && noc.serverProcessingMs <= 200 && noc.clientRttMs <= 800
      ? "Healthy"
      : noc.dbLatencyMs <= 400 && noc.serverProcessingMs <= 800 && noc.clientRttMs <= 2000
        ? "Warning"
        : "Critical";

  const tone =
    healthState === "Healthy"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
      : healthState === "Warning"
        ? "border-amber-500/20 bg-amber-500/10 text-amber-950 dark:text-amber-200"
        : "border-rose-500/20 bg-rose-500/10 text-rose-950 dark:text-rose-200";

  const dotColor =
    healthState === "Healthy"
      ? "bg-emerald-500 text-emerald-500"
      : healthState === "Warning"
        ? "bg-amber-500 text-amber-500"
        : "bg-rose-500 text-rose-500";

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-b px-3 py-1.5 text-xs backdrop-blur-md transition-all duration-300 sm:px-6 ${tone}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href="/integrations"
          className="inline-flex items-center gap-2 font-semibold transition-opacity hover:opacity-85"
        >
          <span className={`relative inline-block h-2 w-2 rounded-full status-dot-pulse ${dotColor}`} />
          <Activity className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
          <span>{t("health_api")}:</span>
          <span className="rounded-md bg-background/60 px-1.5 py-0.5 font-bold uppercase tracking-wider text-[10px] shadow-xs">
            {healthState}
          </span>
        </Link>
        <span className="opacity-40">|</span>
        <div className="flex items-center gap-2 text-[11px] font-mono opacity-90">
          <span className="rounded bg-background/40 px-1.5 py-0.5">
            {t("health_db")} <strong className="font-bold">{noc.dbLatencyMs}ms</strong>
          </span>
          <span className="rounded bg-background/40 px-1.5 py-0.5">
            {t("health_srv")} <strong className="font-bold">{noc.serverProcessingMs}ms</strong>
          </span>
          <span className="rounded bg-background/40 px-1.5 py-0.5">
            {t("health_rtt")} <strong className="font-bold">{noc.clientRttMs}ms</strong>
          </span>
        </div>
        {q.isFetching ? <span className="animate-pulse text-xs opacity-70">fetching…</span> : null}
      </div>

      <button
        type="button"
        className="ml-auto shrink-0 rounded-lg p-1 opacity-70 transition-all hover:bg-black/10 hover:opacity-100 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setShowHealthStrip(false)}
        aria-label={t("health_strip_hide")}
        title={t("health_strip_hide")}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
