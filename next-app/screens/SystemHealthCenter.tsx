"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Database,
  HardDrive,
  HeartPulse,
  MessageCircle,
  Network,
  RefreshCw,
  Router,
  Server,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";
import type { Nas } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CountUpNumber, ProgressRing } from "@/components/viz";

type HealthTone = "healthy" | "warning" | "critical" | "neutral";

type ReadyCheck = {
  ok: boolean;
  required?: boolean;
  reason?: string;
};

type ReadyResponse = {
  status: "UP" | "DOWN";
  reason?: string;
  checks?: {
    db?: ReadyCheck;
    redis?: ReadyCheck;
    rabbitmq?: ReadyCheck;
  };
};

type NocHealth = {
  generatedAt: string | null;
  dbLatencyMs: number;
  serverProcessingMs: number;
  activeSessions: number;
  clientRttMs: number;
};

type BandwidthMetrics = {
  bandwidth?: {
    total?: { rate?: number; bytes?: number };
    download?: { rate?: number; utilization?: number };
    upload?: { rate?: number; utilization?: number };
  };
  system?: {
    cpuLoad?: number;
    memoryUsage?: number;
    uptime?: number;
  };
  interfaces?: unknown[];
  timestamp?: string;
};

type WhatsAppDiagnostics = {
  config: {
    enabled: boolean;
    provider: string;
    configured: boolean;
    issues: string[];
  };
  twilio: {
    authModeUsed: "api-key" | "auth-token" | null;
    apiKeySidWithoutSecret: boolean;
    whatsappFrom: string | null;
    contentSid: string | null;
  };
  authTest: {
    ok: boolean;
    status?: number;
    message?: string;
    accountStatus?: string;
  } | null;
};

type PaymentProviderStatus = {
  provider: string;
  whishConfigured: boolean;
  currency: string;
  qrEnabled: boolean;
  qrImageUrl?: string | null;
  qrLabel?: string;
  qrHint?: string;
};

type BackupMeta = {
  id: string;
  kind: "db" | "mikrotik-export";
  status?: "running" | "success" | "failed";
  createdAt: string;
  finishedAt?: string;
  filename: string;
  sizeBytes: number;
  error?: string;
};

type DunningPreview = {
  totalCandidates: number;
  readyToSend: number;
  missingPhone: number;
  totalAmount: number;
  actionSummary?: {
    remind: number;
    throttle: number;
    suspend: number;
    none: number;
  };
};

function StatusBadge({ tone, label }: { tone: HealthTone; label: string }) {
  const Icon = tone === "healthy" ? CheckCircle2 : tone === "critical" ? XCircle : AlertTriangle;
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1",
        tone === "healthy" && "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warning" && "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "critical" && "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300",
        tone === "neutral" && "text-muted-foreground"
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function Metric({ label, value, hint, animatedValue }: { label: string; value: string; hint?: string; animatedValue?: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 card-hover-lift">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">{label}</div>
      <div className="mt-1 break-all font-mono text-lg font-bold text-foreground">
        {animatedValue !== undefined ? <CountUpNumber value={animatedValue} /> : value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="space-y-2 py-2">
      <div className="h-3 w-2/3 rounded animate-shimmer" />
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="h-14 rounded-lg animate-shimmer" />)}
      </div>
      <p className="text-xs text-muted-foreground/60 text-center pt-2">{label}</p>
    </div>
  );
}

function ErrorState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      {label}
    </div>
  );
}

function DependencyRow({ name, check }: { name: string; check?: ReadyCheck }) {
  const optionalAndUnavailable = check?.required === false && check.ok === false;
  const tone: HealthTone = check?.ok ? "healthy" : optionalAndUnavailable ? "warning" : "critical";
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
      <div>
        <div className="font-medium">{name}</div>
        <div className="text-xs text-muted-foreground">
          {check?.ok
            ? "Connection verified"
            : check?.reason
              ? check.reason.replaceAll("_", " ")
              : "No check result"}
        </div>
      </div>
      <StatusBadge
        tone={tone}
        label={check?.ok ? "Available" : optionalAndUnavailable ? "Optional" : "Unavailable"}
      />
    </div>
  );
}

function formatRate(bytesPerSecond?: number) {
  const value = Number(bytesPerSecond ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B/s";
  const units = ["B/s", "KB/s", "MB/s", "GB/s"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index >= 2 ? 2 : 1)} ${units[index]}`;
}

function formatBytes(bytes?: number) {
  const value = Number(bytes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index >= 2 ? 2 : 1)} ${units[index]}`;
}

function formatUptime(seconds?: number) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "—";
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function SystemHealthCenterPage() {
  const { user } = useAuth();

  const canSeeNoc = canAny(user, ["users.online.view", "reseller.users.view"]);
  const canSeeInfra = canAny(user, ["admin.access.manage", "users.online.view", "reseller.users.view"]);
  const canSeeNas = can(user, "radius.nas.view");
  const canSeeMikrotik = canAny(user, ["admin.analytics.view", "users.online.view"]);
  const canSeeBilling = canAny(user, [
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ]);
  const canSeeBackups = can(user, "admin.access.manage");
  const hasAnyAccess =
    canSeeNoc || canSeeInfra || canSeeNas || canSeeMikrotik || canSeeBilling || canSeeBackups;

  const readyQuery = useQuery({
    queryKey: ["systemHealth", "ready"],
    queryFn: async (): Promise<ReadyResponse> => {
      try {
        const { data } = await apiClient.get("/ready");
        return data as ReadyResponse;
      } catch (error: any) {
        const payload = error?.response?.data;
        if (payload?.status === "DOWN") return payload as ReadyResponse;
        throw error;
      }
    },
    enabled: canSeeInfra,
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });

  const nocQuery = useQuery({
    queryKey: ["systemHealth", "noc"],
    queryFn: async (): Promise<NocHealth> => {
      const started = performance.now();
      const { data } = await apiClient.get("/noc-health");
      return {
        ...(data?.data ?? {}),
        clientRttMs: Math.max(0, Math.round(performance.now() - started)),
      } as NocHealth;
    },
    enabled: canSeeNoc,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });

  const nasQuery = useQuery({
    queryKey: ["systemHealth", "nas"],
    queryFn: async (): Promise<Nas[]> => {
      const { data } = await apiClient.get("/nas", { params: { page: 1, limit: 250 } });
      return (data?.data?.nasEntries ?? []) as Nas[];
    },
    enabled: canSeeNas,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });

  const mikrotikQuery = useQuery({
    queryKey: ["systemHealth", "mikrotik"],
    queryFn: async (): Promise<BandwidthMetrics> => {
      const { data } = await apiClient.get("/bandwidth/metrics");
      return data?.data ?? {};
    },
    enabled: canSeeMikrotik,
    staleTime: 10_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const whatsappQuery = useQuery({
    queryKey: ["systemHealth", "whatsapp"],
    queryFn: async (): Promise<WhatsAppDiagnostics> => {
      const { data } = await apiClient.get("/invoices/whatsapp/diagnostics");
      return data.data as WhatsAppDiagnostics;
    },
    enabled: canSeeBilling,
    staleTime: 30_000,
  });

  const paymentQuery = useQuery({
    queryKey: ["systemHealth", "paymentProvider"],
    queryFn: async (): Promise<PaymentProviderStatus> => {
      const { data } = await apiClient.get("/invoices/payment-provider");
      return data.data as PaymentProviderStatus;
    },
    enabled: canSeeBilling,
    staleTime: 30_000,
  });

  const backupsQuery = useQuery({
    queryKey: ["systemHealth", "backups"],
    queryFn: async (): Promise<BackupMeta[]> => {
      const { data } = await apiClient.get("/backups", { params: { limit: 10 } });
      return (data?.data?.backups ?? []) as BackupMeta[];
    },
    enabled: canSeeBackups,
    staleTime: 30_000,
    refetchInterval: (query) => {
      const rows = query.state.data as BackupMeta[] | undefined;
      return rows?.some((backup) => backup.status === "running") ? 5_000 : false;
    },
  });

  const dunningQuery = useQuery({
    queryKey: ["systemHealth", "dunningReadiness"],
    queryFn: async (): Promise<DunningPreview> => {
      const { data } = await apiClient.get("/invoices/external/dunning/preview", {
        params: { graceDays: 7, limit: 5, minAmount: 0, statuses: "unpaid,pending" },
      });
      return data.data as DunningPreview;
    },
    enabled: canSeeBilling,
    staleTime: 60_000,
  });

  const nasRows = nasQuery.data ?? [];
  const activeNas = nasRows.filter((nas) => nas.status === "active");
  const downNas = nasRows.filter((nas) => nas.status === "down");
  const whatsappHealthy =
    Boolean(whatsappQuery.data?.config.enabled) &&
    Boolean(whatsappQuery.data?.config.configured) &&
    (whatsappQuery.data?.authTest == null || whatsappQuery.data.authTest.ok);
  const latestBackup = backupsQuery.data?.[0];
  const nocTone: HealthTone = nocQuery.isError
    ? "critical"
    : !nocQuery.data
      ? "neutral"
      : nocQuery.data.dbLatencyMs <= 120 &&
          nocQuery.data.serverProcessingMs <= 200 &&
          nocQuery.data.clientRttMs <= 800
        ? "healthy"
        : nocQuery.data.dbLatencyMs <= 400 &&
            nocQuery.data.serverProcessingMs <= 800 &&
            nocQuery.data.clientRttMs <= 2000
          ? "warning"
          : "critical";

  const visibleChecks = useMemo(() => {
    const checks: Array<{ ok: boolean; warning?: boolean }> = [];
    if (canSeeInfra && readyQuery.data) checks.push({ ok: readyQuery.data.status === "UP" });
    if (canSeeNoc && nocQuery.data) checks.push({ ok: nocTone === "healthy", warning: nocTone === "warning" });
    if (canSeeNas && nasQuery.data) checks.push({ ok: downNas.length === 0, warning: downNas.length > 0 });
    if (canSeeMikrotik) checks.push({ ok: mikrotikQuery.isSuccess });
    if (canSeeBilling && whatsappQuery.data) checks.push({ ok: whatsappHealthy });
    if (canSeeBilling && paymentQuery.data) {
      checks.push({
        ok: paymentQuery.data.provider !== "whish" || paymentQuery.data.whishConfigured,
        warning: paymentQuery.data.provider === "whish" && !paymentQuery.data.whishConfigured,
      });
    }
    if (canSeeBackups && latestBackup) {
      checks.push({ ok: latestBackup.status === "success", warning: latestBackup.status === "running" });
    }
    return checks;
  }, [
    canSeeBackups,
    canSeeBilling,
    canSeeInfra,
    canSeeMikrotik,
    canSeeNas,
    canSeeNoc,
    downNas.length,
    latestBackup,
    mikrotikQuery.isSuccess,
    nasQuery.data,
    nocQuery.data,
    nocTone,
    paymentQuery.data,
    readyQuery.data,
    whatsappHealthy,
    whatsappQuery.data,
  ]);

  const criticalCount = visibleChecks.filter((check) => !check.ok && !check.warning).length;
  const warningCount = visibleChecks.filter((check) => check.warning).length;
  const healthyCount = visibleChecks.filter((check) => check.ok).length;
  const allFetching = [
    readyQuery,
    nocQuery,
    nasQuery,
    mikrotikQuery,
    whatsappQuery,
    paymentQuery,
    backupsQuery,
    dunningQuery,
  ].some((query) => query.isFetching);

  const refreshAll = () => {
    const tasks: Array<Promise<unknown>> = [];
    if (canSeeInfra) tasks.push(readyQuery.refetch());
    if (canSeeNoc) tasks.push(nocQuery.refetch());
    if (canSeeNas) tasks.push(nasQuery.refetch());
    if (canSeeMikrotik) tasks.push(mikrotikQuery.refetch());
    if (canSeeBilling) {
      tasks.push(whatsappQuery.refetch(), paymentQuery.refetch(), dunningQuery.refetch());
    }
    if (canSeeBackups) tasks.push(backupsQuery.refetch());
    void Promise.allSettled(tasks);
  };

  if (!hasAnyAccess) {
    return (
      <div className="w-full space-y-6 p-6">
        <PageHeader title="System health" subtitle="Infrastructure and integration status" icon={HeartPulse} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to view operational health information.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Live NOC Telemetry Marquee Ticker */}
      <div className="w-full bg-card dark:bg-[#0a0e17] border border-border dark:border-slate-800 rounded-xl overflow-hidden py-2 px-3 shadow-sm dark:shadow-md relative">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-500/15 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 text-[10px] font-mono font-bold shrink-0 z-10 shadow-2xs">
            <Activity className="w-3 h-3 text-indigo-600 dark:text-indigo-400 animate-pulse" />
            <span>NOC TELEMETRY FEED</span>
          </div>

          <div className="flex-1 overflow-hidden relative">
            <div className="flex gap-8 whitespace-nowrap animate-ticker text-xs font-mono text-foreground/80 dark:text-slate-300">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span>DB LATENCY:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.round(nocQuery.data?.dbLatencyMs ?? 0)}ms</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400" />
                <span>API PROCESSING:</span>
                <strong className="text-sky-600 dark:text-sky-400 font-bold">{Math.round(nocQuery.data?.serverProcessingMs ?? 0)}ms</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                <span>CLIENT RTT:</span>
                <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{Math.round(nocQuery.data?.clientRttMs ?? 0)}ms</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-violet-500 dark:bg-violet-400" />
                <span>ACTIVE AAA SESSIONS:</span>
                <strong className="text-violet-600 dark:text-violet-300 font-bold">{nocQuery.data?.activeSessions ?? 0}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span>NAS REACHABLE:</span>
                <strong className="text-emerald-600 dark:text-emerald-300 font-bold">{activeNas.length} / {nasRows.length}</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span>DB LATENCY:</span>
                <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{Math.round(nocQuery.data?.dbLatencyMs ?? 0)}ms</strong>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-sky-400" />
                <span>API PROCESSING:</span>
                <strong className="text-sky-600 dark:text-sky-400 font-bold">{Math.round(nocQuery.data?.serverProcessingMs ?? 0)}ms</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3 animate-slide-up">
        <PageHeader
          title="System health"
          subtitle="Live operational status for infrastructure, network services, billing, and communications"
          icon={HeartPulse}
          variant="gradient"
          liveTime
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={allFetching} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", allFetching && "animate-spin")} />
            Refresh all
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-sm glow-emerald card-hover-lift animate-slide-up stagger-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Healthy checks</p>
          <p className="mt-1 text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums"><CountUpNumber value={healthyCount} /></p>
          <p className="text-[11px] text-emerald-700/60 dark:text-emerald-400/60 mt-0.5">Reporting normally</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm glow-amber card-hover-lift animate-slide-up stagger-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Warnings</p>
          <p className="mt-1 text-3xl font-extrabold font-mono text-amber-600 dark:text-amber-400 tabular-nums"><CountUpNumber value={warningCount} /></p>
          <p className="text-[11px] text-amber-700/60 dark:text-amber-400/60 mt-0.5">Review recommended</p>
        </div>
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 shadow-sm glow-rose card-hover-lift animate-slide-up stagger-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">Critical</p>
          <p className={cn("mt-1 text-3xl font-extrabold font-mono tabular-nums", criticalCount > 0 ? "text-rose-600 dark:text-rose-400 animate-pulse" : "text-rose-600 dark:text-rose-400")}><CountUpNumber value={criticalCount} /></p>
          <p className="text-[11px] text-rose-700/60 dark:text-rose-400/60 mt-0.5">Immediate attention</p>
        </div>
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 shadow-sm glow-indigo card-hover-lift animate-slide-up stagger-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Visible checks</p>
          <p className="mt-1 text-3xl font-extrabold font-mono text-indigo-600 dark:text-indigo-300 tabular-nums"><CountUpNumber value={visibleChecks.length} /></p>
          <p className="text-[11px] text-indigo-700/60 dark:text-indigo-300/60 mt-0.5">Based on your permissions</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {canSeeInfra ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-500" />
                    Infrastructure
                  </CardTitle>
                  <CardDescription>Backend dependencies from the readiness probe</CardDescription>
                </div>
                {readyQuery.data ? (
                  <StatusBadge
                    tone={readyQuery.data.status === "UP" ? "healthy" : "critical"}
                    label={readyQuery.data.status === "UP" ? "Ready" : "Not ready"}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {readyQuery.isLoading ? (
                <LoadingState label="Checking infrastructure…" />
              ) : readyQuery.isError ? (
                <ErrorState label="The readiness endpoint could not be reached." />
              ) : (
                <>
                  <DependencyRow name="Database" check={readyQuery.data?.checks?.db} />
                  <DependencyRow name="Redis" check={readyQuery.data?.checks?.redis} />
                  <DependencyRow name="RabbitMQ" check={readyQuery.data?.checks?.rabbitmq} />
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canSeeNoc ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-emerald-500" />
                    Platform & RADIUS activity
                  </CardTitle>
                  <CardDescription>Database latency, API response time, and active sessions</CardDescription>
                </div>
                <StatusBadge
                  tone={nocTone}
                  label={nocTone === "healthy" ? "Healthy" : nocTone === "warning" ? "Degraded" : nocTone === "critical" ? "Critical" : "Pending"}
                />
              </div>
            </CardHeader>
            <CardContent>
              {nocQuery.isLoading ? (
                <LoadingState label="Running NOC probe…" />
              ) : nocQuery.isError ? (
                <ErrorState label="The NOC health probe failed." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Database latency" value="" animatedValue={Math.round(nocQuery.data?.dbLatencyMs ?? 0)} hint="ms" />
                  <Metric label="Server processing" value="" animatedValue={Math.round(nocQuery.data?.serverProcessingMs ?? 0)} hint="ms" />
                  <Metric label="Client round-trip" value="" animatedValue={Math.round(nocQuery.data?.clientRttMs ?? 0)} hint="ms" />
                  <Metric label="Active sessions" value="" animatedValue={nocQuery.data?.activeSessions ?? 0} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canSeeNas ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Network className="h-5 w-5 text-violet-500" />
                    NAS reachability
                  </CardTitle>
                  <CardDescription>Live ping status for configured network access servers</CardDescription>
                </div>
                {nasQuery.data ? (
                  <StatusBadge
                    tone={downNas.length === 0 ? "healthy" : "critical"}
                    label={downNas.length === 0 ? "All reachable" : `${downNas.length} down`}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {nasQuery.isLoading ? (
                <LoadingState label="Checking NAS devices…" />
              ) : nasQuery.isError ? (
                <ErrorState label="NAS status could not be loaded." />
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Metric label="Total" value={String(nasRows.length)} />
                    <Metric label="Active" value={String(activeNas.length)} />
                    <Metric label="Down" value={String(downNas.length)} />
                  </div>
                  {downNas.length > 0 ? (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
                      <div className="font-medium text-red-700 dark:text-red-300">Unreachable devices</div>
                      <div className="mt-1 text-muted-foreground">
                        {downNas.slice(0, 5).map((nas) => nas.shortname || nas.nasname).join(", ")}
                        {downNas.length > 5 ? ` and ${downNas.length - 5} more` : ""}
                      </div>
                    </div>
                  ) : null}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/nas">Manage NAS devices</Link>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-border/60 shadow-none">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-amber-500" />
                  NOC Security & Anomaly Guard
                </CardTitle>
                <CardDescription>Real-time line flapping & MAC spoofing monitoring</CardDescription>
              </div>
              <StatusBadge tone="healthy" label="Monitoring" />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Flapping Rule" value="10 drops / 15m" hint="Active threshold" />
              <Metric label="MAC Protection" value="Multi-MAC Check" hint="Strict enforcement" />
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-700 dark:text-emerald-300">
              Subscriber session anomalies and MAC spoofing attempts are automatically broadcast over the NOC event bus.
            </div>
          </CardContent>
        </Card>

        {canSeeMikrotik ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Router className="h-5 w-5 text-cyan-500" />
                    MikroTik
                  </CardTitle>
                  <CardDescription>Router connectivity, load, and aggregate traffic</CardDescription>
                </div>
                <StatusBadge
                  tone={mikrotikQuery.isError ? "critical" : mikrotikQuery.data ? "healthy" : "neutral"}
                  label={mikrotikQuery.isError ? "Unavailable" : mikrotikQuery.data ? "Connected" : "Pending"}
                />
              </div>
            </CardHeader>
            <CardContent>
              {mikrotikQuery.isLoading ? (
                <LoadingState label="Connecting to MikroTik…" />
              ) : mikrotikQuery.isError ? (
                <ErrorState label="MikroTik metrics could not be retrieved." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 card-hover-lift flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">CPU Load</div>
                      <div className="mt-1 font-mono text-lg font-bold">{Number(mikrotikQuery.data?.system?.cpuLoad ?? 0).toFixed(1)}%</div>
                    </div>
                    <ProgressRing percent={Number(mikrotikQuery.data?.system?.cpuLoad ?? 0)} size={48} tone="inverse" />
                  </div>
                  <div className="rounded-lg border border-border/60 bg-muted/20 p-3 card-hover-lift flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">Memory Usage</div>
                      <div className="mt-1 font-mono text-lg font-bold">{Number(mikrotikQuery.data?.system?.memoryUsage ?? 0).toFixed(1)}%</div>
                    </div>
                    <ProgressRing percent={Number(mikrotikQuery.data?.system?.memoryUsage ?? 0)} size={48} tone="inverse" />
                  </div>
                  <Metric label="Total traffic" value={formatRate(mikrotikQuery.data?.bandwidth?.total?.rate)} />
                  <Metric label="Router uptime" value={formatUptime(mikrotikQuery.data?.system?.uptime)} />
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canSeeBilling ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5 text-emerald-500" />
                    WhatsApp
                  </CardTitle>
                  <CardDescription>Reminder delivery configuration and credential check</CardDescription>
                </div>
                {whatsappQuery.data ? (
                  <StatusBadge
                    tone={whatsappHealthy ? "healthy" : "critical"}
                    label={whatsappHealthy ? "Operational" : "Needs attention"}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {whatsappQuery.isLoading ? (
                <LoadingState label="Testing WhatsApp…" />
              ) : whatsappQuery.isError ? (
                <ErrorState label="WhatsApp diagnostics failed." />
              ) : whatsappQuery.data ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Provider" value={whatsappQuery.data.config.provider || "—"} />
                    <Metric label="Authentication" value={whatsappQuery.data.twilio.authModeUsed || "—"} />
                    <Metric label="Sender" value={whatsappQuery.data.twilio.whatsappFrom || "Messaging service / not set"} />
                    <Metric label="Template" value={whatsappQuery.data.twilio.contentSid || "Not configured"} />
                  </div>
                  {whatsappQuery.data.config.issues.length > 0 || whatsappQuery.data.authTest?.message ? (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                      <div className="font-medium text-amber-700 dark:text-amber-300">Action required</div>
                      <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                        {whatsappQuery.data.config.issues.map((issue) => <li key={issue}>{issue}</li>)}
                        {whatsappQuery.data.authTest?.message ? <li>{whatsappQuery.data.authTest.message}</li> : null}
                        {whatsappQuery.data.twilio.apiKeySidWithoutSecret ? <li>Twilio API key secret is missing.</li> : null}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {canSeeBilling ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-indigo-500" />
                    Payment provider
                  </CardTitle>
                  <CardDescription>Configured subscriber payment and QR capabilities</CardDescription>
                </div>
                {paymentQuery.data ? (
                  <StatusBadge
                    tone={paymentQuery.data.provider !== "whish" || paymentQuery.data.whishConfigured ? "healthy" : "warning"}
                    label={paymentQuery.data.provider !== "whish" || paymentQuery.data.whishConfigured ? "Configured" : "Incomplete"}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {paymentQuery.isLoading ? (
                <LoadingState label="Loading payment configuration…" />
              ) : paymentQuery.isError ? (
                <ErrorState label="Payment provider configuration could not be loaded." />
              ) : paymentQuery.data ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Provider" value={paymentQuery.data.provider || "—"} />
                    <Metric label="Currency" value={paymentQuery.data.currency || "—"} />
                    <Metric label="Whish configuration" value={paymentQuery.data.whishConfigured ? "Complete" : "Not configured"} />
                    <Metric label="QR payments" value={paymentQuery.data.qrEnabled ? "Enabled" : "Disabled"} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This card verifies configuration only; the payment API does not expose a live credential probe.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {canSeeBackups ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-orange-500" />
                    Backups
                  </CardTitle>
                  <CardDescription>Latest database or MikroTik backup job</CardDescription>
                </div>
                {latestBackup ? (
                  <StatusBadge
                    tone={latestBackup.status === "success" ? "healthy" : latestBackup.status === "running" ? "warning" : "critical"}
                    label={latestBackup.status || "Unknown"}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {backupsQuery.isLoading ? (
                <LoadingState label="Loading backup history…" />
              ) : backupsQuery.isError ? (
                <ErrorState label="Backup status could not be loaded." />
              ) : latestBackup ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Metric label="Kind" value={latestBackup.kind} />
                    <Metric label="Size" value={formatBytes(latestBackup.sizeBytes)} />
                    <Metric label="Started" value={formatWhen(latestBackup.createdAt)} />
                    <Metric label="Finished" value={formatWhen(latestBackup.finishedAt)} />
                  </div>
                  {latestBackup.error ? <ErrorState label={latestBackup.error} /> : null}
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/backups">Open backup center</Link>
                  </Button>
                </>
              ) : (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No backup jobs have been recorded.
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {canSeeBilling ? (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Clock3 className="h-5 w-5 text-amber-500" />
                    Dunning readiness
                  </CardTitle>
                  <CardDescription>Current overdue workload and contact-data readiness</CardDescription>
                </div>
                {dunningQuery.data ? (
                  <StatusBadge
                    tone={dunningQuery.data.missingPhone > 0 ? "warning" : "healthy"}
                    label={dunningQuery.data.missingPhone > 0 ? "Missing contacts" : "Ready"}
                  />
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {dunningQuery.isLoading ? (
                <LoadingState label="Building dunning preview…" />
              ) : dunningQuery.isError ? (
                <ErrorState label="Dunning readiness could not be calculated." />
              ) : dunningQuery.data ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="Candidates" value={String(dunningQuery.data.totalCandidates)} />
                    <Metric label="Ready to send" value={String(dunningQuery.data.readyToSend)} />
                    <Metric label="Missing phone" value={String(dunningQuery.data.missingPhone)} />
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/external-invoices/dunning">Open dunning center</Link>
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
          Health results are permission-scoped and come from live application probes. NetFlow/ClickHouse,
          FreeRADIUS daemon, scheduler history, and queue-depth monitoring require dedicated backend health endpoints.
        </CardContent>
      </Card>
    </div>
  );
}
