import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import IconActionButton from "@/components/IconActionButton";
import StatCard from "@/components/StatCard";
import { CountUpNumber, Sparkline } from "@/components/viz";
import { ChevronDown, ChevronUp, Gauge, Shield, UserX, Users as UsersIcon, Wifi } from "lucide-react";
import type { UsersFleetMetrics } from "@/api/users";
import { STATUS_SEGMENTS, type LocalUsersMetrics } from "./lib";

const METRICS_COLLAPSED_STORAGE_KEY = "ui.users.metricsCollapsed";

export const FleetMetricsPanel = ({
  fleet,
  metrics,
  isLoading,
  activeAccountStatus,
  onClearAllFilters,
  onQuickFilter,
  onQuotaFilter,
  onAccountStatusFilter,
}: {
  fleet: UsersFleetMetrics | null | undefined;
  metrics: LocalUsersMetrics;
  isLoading: boolean;
  activeAccountStatus: string;
  onClearAllFilters: () => void;
  onQuickFilter: (filter: string) => void;
  onQuotaFilter: () => void;
  onAccountStatusFilter: (status: string) => void;
}) => {
  const [metricsCollapsed, setMetricsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(METRICS_COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(METRICS_COLLAPSED_STORAGE_KEY, metricsCollapsed ? "1" : "0");
    } catch {}
  }, [metricsCollapsed]);

  const fleetStatusTotal = useMemo(
    () => Object.values(fleet?.byStatus ?? {}).reduce((acc, n) => acc + n, 0),
    [fleet?.byStatus]
  );
  const fleetSparks = useMemo(
    () => ({
      newUsers: (fleet?.trends?.newUsersWeekly ?? []).map((p) => p.count),
      onlineDaily: (fleet?.trends?.onlineDaily ?? []).map((p) => p.count),
    }),
    [fleet?.trends]
  );

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex shrink-0 items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Fleet metrics</span>
            </div>
            {metricsCollapsed ? (
              isLoading && !fleet ? (
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <Skeleton key={i} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    {
                      key: "total",
                      label: "Total",
                      value: fleet?.total ?? metrics.total,
                      icon: UsersIcon,
                      onClick: onClearAllFilters,
                    },
                    {
                      key: "online",
                      label: "Online",
                      value: fleet?.online ?? metrics.online,
                      icon: Wifi,
                      onClick: () => onQuickFilter("online"),
                    },
                    {
                      key: "suspended",
                      label: "Suspended",
                      value: fleet?.byStatus?.suspended ?? metrics.suspended,
                      icon: UserX,
                      onClick: () => onQuickFilter("suspended"),
                    },
                    {
                      key: "quota",
                      label: "Quota exceeded",
                      value: fleet?.monthlyExceeded ?? metrics.quotaExceeded,
                      icon: Gauge,
                      onClick: onQuotaFilter,
                    },
                  ].map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={item.onClick}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:bg-muted"
                    >
                      <item.icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {(item.value ?? 0).toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : null}
          </div>
          <IconActionButton
            label={metricsCollapsed ? "Show metrics" : "Hide metrics"}
            onClick={() => setMetricsCollapsed((v) => !v)}
            icon={metricsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          />
        </div>

        {!metricsCollapsed ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {isLoading && !fleet ? (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="border bg-card/60">
                      <CardContent className="p-4">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-2 h-8 w-20" />
                        <Skeleton className="mt-2 h-3 w-28" />
                      </CardContent>
                    </Card>
                  ))}
                </>
              ) : (
                <>
                  <StatCard
                    label="Total users"
                    value={<CountUpNumber value={fleet?.total ?? metrics.total} />}
                    sublabel={
                      fleetSparks.newUsers.length
                        ? `+${fleetSparks.newUsers[fleetSparks.newUsers.length - 1]} new this week`
                        : "Registered users"
                    }
                    onClick={onClearAllFilters}
                    icon={
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UsersIcon className="h-5 w-5 text-primary" />
                      </div>
                    }
                    footer={
                      fleetSparks.newUsers.length >= 2 ? (
                        <Sparkline data={fleetSparks.newUsers} strokeClass="stroke-blue-500" />
                      ) : null
                    }
                  />
                  <StatCard
                    label="Online now"
                    value={<CountUpNumber value={fleet?.online ?? metrics.online} />}
                    sublabel={
                      fleet?.total
                        ? `${Math.round(((fleet.online ?? 0) / fleet.total) * 100)}% of all users`
                        : "Live RADIUS sessions"
                    }
                    onClick={() => onQuickFilter("online")}
                    icon={
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                        <Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    }
                    footer={
                      fleetSparks.onlineDaily.length >= 2 ? (
                        <Sparkline data={fleetSparks.onlineDaily} strokeClass="stroke-emerald-500" />
                      ) : null
                    }
                  />
                  <StatCard
                    label="Suspended"
                    value={<CountUpNumber value={fleet?.byStatus?.suspended ?? metrics.suspended} />}
                    sublabel={
                      fleet?.total
                        ? `${Math.round(((fleet.byStatus?.suspended ?? 0) / fleet.total) * 100)}% of all users`
                        : "Account status"
                    }
                    onClick={() => onQuickFilter("suspended")}
                    icon={
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                        <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />
                      </div>
                    }
                  />
                  <StatCard
                    label="Quota exceeded"
                    value={<CountUpNumber value={fleet?.monthlyExceeded ?? metrics.quotaExceeded} />}
                    sublabel="Monthly traffic limit reached"
                    onClick={onQuotaFilter}
                    icon={
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                        <Gauge className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                    }
                  />
                </>
              )}
            </div>

            {fleet && fleetStatusTotal > 0 ? (
              <div className="space-y-3 border-t border-border/60 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Account status distribution</span>
                    <span className="text-xs text-muted-foreground">click a segment to filter</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {fleetStatusTotal.toLocaleString()} users total
                  </span>
                </div>
                <div className="flex h-9 w-full overflow-hidden rounded-lg border border-border/50">
                  {STATUS_SEGMENTS.map((segment) => {
                    const count = fleet.byStatus?.[segment.key] ?? 0;
                    if (count <= 0) return null;
                    const widthPercent = (count / fleetStatusTotal) * 100;
                    const isActive = activeAccountStatus === segment.key;
                    return (
                      <button
                        key={segment.key}
                        type="button"
                        className={`relative h-full transition-all ${segment.barClass} ${
                          isActive ? "ring-2 ring-inset ring-foreground/60" : ""
                        }`}
                        style={{ width: `${Math.max(widthPercent, 2)}%` }}
                        title={`${segment.label}: ${count.toLocaleString()} users`}
                        onClick={() => onAccountStatusFilter(segment.key)}
                      >
                        {widthPercent > 12 ? (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow-sm">
                            {segment.label}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {STATUS_SEGMENTS.map((segment) => {
                    const count = fleet.byStatus?.[segment.key] ?? 0;
                    const isActive = activeAccountStatus === segment.key;
                    return (
                      <button
                        key={segment.key}
                        type="button"
                        onClick={() => onAccountStatusFilter(segment.key)}
                        className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-muted ${
                          isActive ? "bg-muted font-semibold" : "text-muted-foreground"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${segment.dotClass}`} />
                        {segment.label}
                        <span className="tabular-nums">{count.toLocaleString()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
