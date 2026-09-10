"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, DollarSign, Users, Wifi,
  ArrowRight, Activity, ExternalLink
} from "lucide-react";
import { apiClient } from "@/api/client";
import { formatBytes, cn } from "@/lib/utils";
import { CountUpNumber } from "@/components/viz";

// ─── Types ──────────────────────────────────────────────────────────────────
export interface InvoiceTrendPoint {
  month: string;
  totalCount: number;
  paidCount: number;
  totalAmount: number;
  paidAmount: number;
}

export interface UsersFleetMetrics {
  total: number;
  online: number;
  monthlyExceeded: number;
  byStatus: Record<string, number>;
}

export interface OnlineUserItem {
  username: string;
  nasIp?: string;
  nasName?: string;
  ipAddress?: string;
  profileName?: string;
  dailyUsage?: number | string;
  monthlyUsage?: number | string;
  downloadSpeed?: number;
  uploadSpeed?: number;
  fullName?: string;
}

// ─── 1. Revenue Sparkline Widget ───────────────────────────────────────────
export const RevenueTrendSparklineWidget = ({ canSeeInvoices }: { canSeeInvoices: boolean }) => {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["invoices", "trend", 6],
    queryFn: async () => {
      const resp = await apiClient.get("/invoices/external/trend", { params: { months: 6 } });
      const raw = resp?.data?.data ?? [];
      return (Array.isArray(raw) ? raw : []) as InvoiceTrendPoint[];
    },
    enabled: canSeeInvoices,
    staleTime: 60000,
  });

  const trendData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data;
  }, [data]);

  // Compute metrics
  const latest = trendData[trendData.length - 1];
  const previous = trendData.length > 1 ? trendData[trendData.length - 2] : null;

  const currentRevenue = Number(latest?.paidAmount ?? latest?.totalAmount ?? 0);
  const prevRevenue = Number(previous?.paidAmount ?? previous?.totalAmount ?? 0);
  const diffPct = prevRevenue > 0 ? ((currentRevenue - prevRevenue) / prevRevenue) * 100 : 0;

  const totalBilled = Number(latest?.totalAmount ?? 0);
  const collectionRate = totalBilled > 0 ? (currentRevenue / totalBilled) * 100 : 100;

  // Sparkline coordinates
  const points = trendData.map((d) => Number(d.paidAmount || d.totalAmount || 0));
  const maxVal = Math.max(...points, 1);
  const minVal = Math.min(...points, 0);
  const range = maxVal - minVal || 1;

  const width = 320;
  const height = 70;
  const padding = 8;
  const effectiveW = width - padding * 2;
  const effectiveH = height - padding * 2;

  const coords = points.map((val, i) => {
    const x = padding + (i / Math.max(points.length - 1, 1)) * effectiveW;
    const y = height - padding - ((val - minVal) / range) * effectiveH;
    return { x, y, val };
  });

  const pathD = coords.reduce((acc, pt, i) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = coords[i - 1];
    const cX1 = (prev.x + pt.x) / 2;
    return `${acc} C ${cX1} ${prev.y}, ${cX1} ${pt.y}, ${pt.x} ${pt.y}`;
  }, "");

  const areaD = coords.length > 0
    ? `${pathD} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`
    : "";

  if (!canSeeInvoices) return null;

  return (
    <Card className="border-border/60 shadow-sm card-hover-lift animate-slide-up stagger-3 flex flex-col justify-between overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Revenue Momentum</CardTitle>
              <CardDescription className="text-xs">6-Month collections & billing trend</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "gap-1 font-mono text-xs font-semibold",
              diffPct >= 0
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {diffPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {diffPct >= 0 ? "+" : ""}{diffPct.toFixed(1)}% MoM
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {isLoading ? (
                "…"
              ) : (
                <>${Math.round(currentRevenue).toLocaleString()}</>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {latest ? `${latest.month} Collected` : "Recent billing month"}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs font-medium text-muted-foreground">Collection Rate</span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
              {collectionRate.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="relative w-full rounded-md bg-muted/20 p-1">
          {isLoading ? (
            <div className="h-[70px] flex items-center justify-center text-xs text-muted-foreground">
              Loading trend…
            </div>
          ) : coords.length < 2 ? (
            <div className="h-[70px] flex items-center justify-center text-xs text-muted-foreground">
              Awaiting billing cycles…
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-[70px] overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <path d={areaD} fill="url(#revGrad)" />
              <path
                d={pathD}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {coords.map((pt, i) => (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={hoverIdx === i ? 4.5 : 2.5}
                  className="cursor-pointer fill-background stroke-emerald-600 transition-all"
                  strokeWidth="2"
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx(null)}
                />
              ))}
            </svg>
          )}

          {/* Tooltip on hover */}
          {hoverIdx !== null && trendData[hoverIdx] && (
            <div className="absolute top-1 right-2 rounded bg-popover/90 px-2 py-0.5 text-[10px] font-mono shadow border text-popover-foreground pointer-events-none backdrop-blur-sm">
              {trendData[hoverIdx].month}: ${Math.round(trendData[hoverIdx].paidAmount).toLocaleString()}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-1">
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground" asChild>
          <Link href="/external-invoices">
            <span>Inspect invoices & cashflow</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// ─── 2. Subscriber Churn & Fleet Health Card ────────────────────────────────
export const SubscriberChurnCard = ({
  fleet,
  isLoading,
  canSeeUsers,
}: {
  fleet: UsersFleetMetrics | null | undefined;
  isLoading: boolean;
  canSeeUsers: boolean;
}) => {
  const total = fleet?.total ?? 0;
  const byStatus = fleet?.byStatus ?? {};

  // Status breakdown
  const activeCount = Number(byStatus["active"] || 0);
  const expiredCount = Number(byStatus["expired"] || 0);
  const disabledCount = Number(byStatus["disabled"] || byStatus["inactive"] || 0);
  const suspendedCount = Number(byStatus["suspended"] || 0);
  const atRiskCount = expiredCount + disabledCount + suspendedCount;

  const retentionPct = total > 0 ? (activeCount / total) * 100 : 100;
  const churnPct = total > 0 ? (atRiskCount / total) * 100 : 0;

  if (!canSeeUsers) return null;

  return (
    <Card className="border-border/60 shadow-sm card-hover-lift animate-slide-up stagger-3 flex flex-col justify-between">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-sky-500/10 p-2 text-sky-600 dark:text-sky-400">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Subscriber Retention & Health</CardTitle>
              <CardDescription className="text-xs">Fleet stability, churn & quota risk</CardDescription>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-xs font-semibold",
              churnPct <= 5
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : churnPct <= 15
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400"
            )}
          >
            {retentionPct.toFixed(1)}% Retention
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pb-2">
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">Active Fleet</span>
            <div className="mt-1 text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isLoading ? "…" : <CountUpNumber value={activeCount} />}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {total > 0 ? `${((activeCount / total) * 100).toFixed(0)}% of total subscribers` : "Fleet normal"}
            </span>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <span className="text-[11px] font-medium text-muted-foreground">At-Risk / Churned</span>
            <div className="mt-1 text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {isLoading ? "…" : <CountUpNumber value={atRiskCount} />}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {total > 0 ? `${churnPct.toFixed(1)}% expired/suspended` : "None"}
            </span>
          </div>
        </div>

        {/* Multi-segment status distribution bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Fleet Distribution</span>
            <span>{total.toLocaleString()} total</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40 flex">
            <div
              className="bg-emerald-500 transition-all"
              style={{ width: `${total > 0 ? (activeCount / total) * 100 : 100}%` }}
              title={`Active: ${activeCount}`}
            />
            <div
              className="bg-amber-500 transition-all"
              style={{ width: `${total > 0 ? (suspendedCount / total) * 100 : 0}%` }}
              title={`Suspended: ${suspendedCount}`}
            />
            <div
              className="bg-rose-500 transition-all"
              style={{ width: `${total > 0 ? (expiredCount + disabledCount) / total * 100 : 0}%` }}
              title={`Expired/Disabled: ${expiredCount + disabledCount}`}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Active ({activeCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> Suspended ({suspendedCount})
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Expired ({expiredCount + disabledCount})
            </span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-1">
        <Button variant="ghost" size="sm" className="w-full justify-between text-xs text-muted-foreground hover:text-foreground" asChild>
          <Link href="/users/list?status=expired">
            <span>Review churned & expired accounts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// ─── 3. Top Bandwidth Consumers Mini-Table ─────────────────────────────────
export const TopBandwidthConsumersWidget = ({ canSeeOnline }: { canSeeOnline: boolean }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["online-users", "top-consumers"],
    queryFn: async () => {
      const resp = await apiClient.get("/online-users", {
        params: { page: 1, limit: 6 },
      });
      const list = (resp?.data?.data ?? []) as OnlineUserItem[];
      // Sort in-memory by usage desc
      return list.sort((a, b) => {
        const uA = Number(a.dailyUsage || a.monthlyUsage || 0);
        const uB = Number(b.dailyUsage || b.monthlyUsage || 0);
        return uB - uA;
      }).slice(0, 5);
    },
    enabled: canSeeOnline,
    staleTime: 15000,
    refetchInterval: 30000,
  });

  const consumers = data ?? [];
  const maxUsage = Math.max(...consumers.map(c => Number(c.dailyUsage || c.monthlyUsage || 0)), 1);

  if (!canSeeOnline) return null;

  return (
    <Card className="border-border/60 shadow-sm card-hover-lift animate-slide-up stagger-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600 dark:text-indigo-400">
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Top Bandwidth Consumers</CardTitle>
              <CardDescription className="text-xs">Live subscriber sessions with highest throughput</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="text-xs gap-1 h-7" asChild>
            <Link href="/online-users">
              <span>Live sessions</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 w-full animate-pulse rounded bg-muted/40" />
            ))}
          </div>
        ) : consumers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <Wifi className="h-8 w-8 stroke-1 opacity-40 mb-2" />
            <p className="text-sm font-medium">No active heavy traffic sessions</p>
            <p className="text-xs">Subscribers will appear here when connected.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {consumers.map((u, idx) => {
              const usage = Number(u.dailyUsage || u.monthlyUsage || 0);
              const barPct = Math.min(100, Math.max(5, (usage / maxUsage) * 100));

              return (
                <div key={u.username + idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/users/details/${encodeURIComponent(u.username)}`}
                          className="font-medium text-sm text-foreground hover:text-primary truncate block hover:underline"
                        >
                          {u.fullName || u.username}
                        </Link>
                        {u.fullName && (
                          <span className="text-xs text-muted-foreground font-mono truncate hidden sm:inline">
                            ({u.username})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono">
                        {u.ipAddress && <span>{u.ipAddress}</span>}
                        {u.profileName && <span>· {u.profileName}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0 w-32">
                    <div className="font-mono font-semibold text-xs text-foreground">
                      {usage > 0 ? formatBytes(usage) : "< 1 MB"}
                    </div>
                    <div className="mt-1 h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── 4. Active Alerts Pulse Badge ──────────────────────────────────────────
export const ActiveAlertsPulseBadge = ({ canSeeAlerts }: { canSeeAlerts: boolean }) => {
  const { data } = useQuery({
    queryKey: ["alerts", "home-badge"],
    queryFn: async () => {
      const resp = await apiClient.get("/alerts");
      const raw = resp?.data;
      const list = Array.isArray(raw) ? raw : raw?.data ?? [];
      return list as Array<{ id: number; severity: string; resolved?: boolean; acknowledged?: boolean }>;
    },
    enabled: canSeeAlerts,
    refetchInterval: 15000,
    staleTime: 5000,
  });

  const alerts = data ?? [];
  const unresolved = alerts.filter(a => !a.resolved);
  const critical = unresolved.filter(a => a.severity === "critical" || a.severity === "high");

  if (!canSeeAlerts || unresolved.length === 0) return null;

  return (
    <Link
      href="/alerts"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-sm transition-all hover:opacity-90",
        critical.length > 0
          ? "border border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400"
          : "border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
      )}
    >
      <span className="relative flex h-2 w-2">
        {critical.length > 0 && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
        )}
        <span className={cn("relative inline-flex rounded-full h-2 w-2", critical.length > 0 ? "bg-rose-500" : "bg-amber-500")} />
      </span>
      <span>
        {unresolved.length} alert{unresolved.length !== 1 ? "s" : ""}
        {critical.length > 0 && ` (${critical.length} critical)`}
      </span>
    </Link>
  );
};
