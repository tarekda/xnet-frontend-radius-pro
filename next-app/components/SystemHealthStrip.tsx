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
      ? "border-emerald-200/80 bg-emerald-50/90 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100"
      : healthState === "Warning"
        ? "border-amber-200/80 bg-amber-50/90 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        : "border-red-200/80 bg-red-50/90 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-2 py-1.5 pr-1 text-xs sm:px-4 ${tone}`}
      role="status"
      aria-live="polite"
    >
      <Link href="/integrations" className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline">
        <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t("health_api")}: {healthState}
      </Link>
      <span className="text-muted-foreground">·</span>
      <span>
        {t("health_db")} {noc.dbLatencyMs}ms
      </span>
      <span>
        {t("health_srv")} {noc.serverProcessingMs}ms
      </span>
      <span>
        {t("health_rtt")} {noc.clientRttMs}ms
      </span>
      {q.isFetching ? <span className="ml-auto opacity-70 sm:ml-0">…</span> : null}
      <button
        type="button"
        className="ml-auto shrink-0 rounded p-1 opacity-70 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => setShowHealthStrip(false)}
        aria-label={t("health_strip_hide")}
        title={t("health_strip_hide")}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}
