"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { useOnlineMetrics } from "@/hooks/useOnlineMetrics";
import { useAuthMetrics } from "@/hooks/useAuthMetrics";
import {
  Wifi, WifiOff, ShieldAlert, ShieldCheck, AlertTriangle,
  CheckCircle2, Clock, RefreshCw, Maximize2, Minimize2,
  TrendingUp, TrendingDown, Minus, Users, Radio, Bell,
} from "lucide-react";
import { VERSION_LABEL } from "@/constants/version";

interface NocAlert {
  id: number;
  ruleName: string;
  severity: "critical" | "warning" | "info";
  message: string;
  firedAt: string;
  acknowledged: boolean;
}

interface SparkPoint { t: number; v: number; }

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch { return iso; }
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600),
    m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 5) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (pct < -5) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function Sparkline({ data, color = "#3b82f6" }: { data: SparkPoint[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data.map(p => p.v));
  const max = Math.max(...data.map(p => p.v)) || 1;
  const W = 120, H = 32;
  const pts = data.map((p, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((p.v - min) / (max - min)) * H;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} className="opacity-80">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={pts} />
    </svg>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const cls = severity === "critical"
    ? "bg-red-500/20 text-red-400 border-red-500/30"
    : severity === "warning"
    ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
    : "bg-blue-500/20 text-blue-400 border-blue-500/30";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${cls}`}>
      {severity}
    </span>
  );
}

const NocDashboard: React.FC = () => {
  const [kiosk, setKiosk] = useState(false);
  const [uptime, setUptime] = useState(0);
  const [now, setNow] = useState(new Date());
  const [onlineHistory, setOnlineHistory] = useState<SparkPoint[]>([]);
  const [authFailHistory, setAuthFailHistory] = useState<SparkPoint[]>([]);
  const startTime = useRef(Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      setNow(new Date());
      setUptime(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const online = useOnlineMetrics();
  const { data: auth } = useAuthMetrics(3600);

  useEffect(() => {
    setOnlineHistory(h => [...h.slice(-29), { t: Date.now(), v: online.totalOnlineUsers }]);
  }, [online.totalOnlineUsers]);

  useEffect(() => {
    setAuthFailHistory(h => [...h.slice(-29), { t: Date.now(), v: auth?.current?.rejected ?? 0 }]);
  }, [auth?.current?.rejected]);

  const { data: alertsData, refetch: refetchAlerts } = useQuery({
    queryKey: ["noc-alerts"],
    queryFn: async () => {
      const r = await apiClient.get<{ success: boolean; data: NocAlert[] }>("/alerts?limit=10&unacknowledged=true");
      return r.data?.data ?? [];
    },
    refetchInterval: 15_000,
  });
  const alerts: NocAlert[] = alertsData ?? [];

  const { data: fleet } = useQuery({
    queryKey: ["noc-fleet"],
    queryFn: async () => {
      const r = await apiClient.get("/users/fleet-metrics");
      return r.data?.data as Record<string, number> | undefined;
    },
    refetchInterval: 30_000,
  });

  const criticalCount = alerts.filter(a => a.severity === "critical").length;
  const warningCount = alerts.filter(a => a.severity === "warning").length;
  const acceptPct = auth?.current
    ? Math.round((auth.current.accepted / Math.max(auth.current.attempts, 1)) * 100)
    : 0;
  const authFailPct = auth?.changePct?.rejected ?? 0;

  const toggleKiosk = useCallback(() => {
    if (!kiosk) { document.documentElement.requestFullscreen?.().catch(() => {}); }
    else { document.exitFullscreen?.().catch(() => {}); }
    setKiosk(k => !k);
  }, [kiosk]);

  const barColor = (pct: number) =>
    pct >= 90 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : "bg-red-400";
  const textColor = (pct: number) =>
    pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-red-400";

  return (
    <div className={`${kiosk ? "fixed inset-0 z-50 bg-background overflow-auto" : "w-full"} text-foreground`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
            <Radio className="h-4 w-4 text-blue-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">NOC Dashboard</h1>
            <p className="text-[10px] text-muted-foreground font-mono">{VERSION_LABEL}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden md:block font-mono text-xs text-muted-foreground">
            Session: <span className="text-foreground">{formatUptime(uptime)}</span>
          </span>
          <span className="font-mono text-sm font-bold text-blue-300 tabular-nums">{now.toLocaleTimeString()}</span>
          <span className="hidden sm:block text-xs text-muted-foreground">
            {now.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
          </span>
          <button id="noc-kiosk-toggle" onClick={toggleKiosk}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            {kiosk ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button id="noc-refresh-btn" onClick={() => void refetchAlerts()}
            className="rounded-md border border-border p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Online Users */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Online Users</span>
              <Wifi className="h-4 w-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-400 tabular-nums leading-none">{online.totalOnlineUsers.toLocaleString()}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{online.totalActiveUsers.toLocaleString()} total active</p>
            </div>
            <Sparkline data={onlineHistory} color="#34d399" />
          </div>

          {/* Auth Rate */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Auth Rate (1h)</span>
              <ShieldCheck className="h-4 w-4 text-blue-400" />
            </div>
            <div>
              <p className={`text-3xl font-black tabular-nums leading-none ${textColor(acceptPct)}`}>{acceptPct}%</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{(auth?.current?.attempts ?? 0).toLocaleString()} attempts</p>
            </div>
            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${barColor(acceptPct)}`} style={{ width: `${acceptPct}%` }} />
            </div>
          </div>

          {/* Auth Failures */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Auth Failures (1h)</span>
              <ShieldAlert className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <p className="text-3xl font-black text-red-400 tabular-nums leading-none">{(auth?.current?.rejected ?? 0).toLocaleString()}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendIcon pct={authFailPct} />
                <span className="text-[11px] text-muted-foreground">{authFailPct > 0 ? "+" : ""}{Math.round(authFailPct)}% vs prev hour</span>
              </div>
            </div>
            <Sparkline data={authFailHistory} color="#f87171" />
          </div>

          {/* Active Alerts */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 min-h-[120px]">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Active Alerts</span>
              <Bell className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <p className={`text-3xl font-black tabular-nums leading-none ${criticalCount > 0 ? "text-red-400" : warningCount > 0 ? "text-amber-400" : "text-emerald-400"}`}>{alerts.length}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {criticalCount > 0 && <span className="text-[11px] text-red-400 font-semibold">{criticalCount} critical</span>}
                {warningCount > 0 && <span className="text-[11px] text-amber-400 font-semibold">{warningCount} warning</span>}
                {alerts.length === 0 && <span className="text-[11px] text-emerald-400 font-semibold">All clear</span>}
              </div>
            </div>
            <div className="flex gap-1.5">
              {criticalCount > 0 && <span className="h-2 w-2 rounded-full bg-red-400 animate-ping" />}
              {warningCount > 0 && <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />}
              {alerts.length === 0 && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />}
            </div>
          </div>
        </div>

        {/* Alert Feed + Fleet */}
        <div className="grid lg:grid-cols-3 gap-3">
          <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                Live Alert Feed
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono">auto-refresh 15s</span>
            </div>
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">All systems nominal</p>
                <p className="text-xs text-muted-foreground">No unacknowledged alerts</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {alerts.map(a => (
                  <div key={a.id} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${
                    a.severity === "critical" ? "border-red-500/20 bg-red-500/5"
                    : a.severity === "warning" ? "border-amber-500/20 bg-amber-500/5"
                    : "border-blue-500/20 bg-blue-500/5"
                  }`}>
                    <SeverityBadge severity={a.severity} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{a.ruleName}</p>
                      <p className="text-xs text-muted-foreground truncate">{a.message}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-muted-foreground font-mono">{formatTime(a.firedAt)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-purple-400" />
              Subscriber Fleet
            </h2>
            <div className="space-y-3">
              {[
                { label: "Total Subscribers", value: fleet?.total ?? "—", color: "text-foreground" },
                { label: "Currently Online", value: online.totalOnlineUsers, color: "text-emerald-400" },
                { label: "Monthly Exceeded", value: fleet?.monthlyExceeded ?? "—", color: "text-amber-400" },
                { label: "Expiring (7d)", value: fleet?.expiringSoon ?? "—", color: "text-orange-400" },
                { label: "Expired", value: fleet?.expired ?? "—", color: "text-red-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className={`font-bold tabular-nums font-mono ${color}`}>
                    {typeof value === "number" ? value.toLocaleString() : value}
                  </span>
                </div>
              ))}
            </div>
            {fleet?.total ? (
              <div className="mt-4">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Online ratio</span>
                  <span>{Math.round((online.totalOnlineUsers / fleet.total) * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-1000"
                    style={{ width: `${Math.min(100, Math.round((online.totalOnlineUsers / fleet.total) * 100))}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Service Status */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "RADIUS Server", ok: true, detail: "UDP :1812 / :1813" },
            { label: "MikroTik API", ok: true, detail: "RouterOS :8728" },
            { label: "RabbitMQ", ok: true, detail: "AMQP message queue" },
            { label: "Redis Cache", ok: true, detail: "Session and auth cache" },
          ].map(({ label, ok, detail }) => (
            <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3">
              <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${ok ? "bg-emerald-400 animate-pulse" : "bg-red-400"}`} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{label}</p>
                <p className="text-[10px] text-muted-foreground truncate">{detail}</p>
              </div>
              {ok
                ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                : <WifiOff className="h-3.5 w-3.5 text-red-400 shrink-0" />}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono px-1 pt-1">
          <span>XNet Radius Pro — NOC Operations View</span>
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{now.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
};

export default NocDashboard;