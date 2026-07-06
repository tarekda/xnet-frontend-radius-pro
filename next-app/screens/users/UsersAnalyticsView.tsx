import React from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/viz";
import { Activity, PieChart, Shield } from "lucide-react";
import type { User } from "@/types/api";
import { AuditActivityTimeline } from "./AuditActivityTimeline";
import type { LocalUsersMetrics } from "./lib";

// Loaded on demand: recharts stays out of the main /users/list bundle.
const UsageChart = dynamic(() => import("@/components/charts/ProfileDistributionChart"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
});

export const UsersAnalyticsView = ({
  filteredUsers,
  metrics,
  canSeeAudit,
}: {
  filteredUsers: User[];
  metrics: LocalUsersMetrics;
  canSeeAudit: boolean;
}) => {
  const rings = [
    {
      label: "Online rate",
      percent: metrics.total ? (metrics.online / metrics.total) * 100 : 0,
      detail: `${metrics.online.toLocaleString()} online`,
      tone: "auto" as const,
    },
    {
      label: "Active rate",
      percent: metrics.total ? (metrics.active / metrics.total) * 100 : 0,
      detail: `${metrics.active.toLocaleString()} active`,
      tone: "auto" as const,
    },
    {
      label: "Quota issues",
      percent: metrics.total ? (metrics.quotaExceeded / metrics.total) * 100 : 0,
      detail: `${metrics.quotaExceeded.toLocaleString()} exceeded`,
      tone: "inverse" as const,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="border bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <PieChart className="h-5 w-5 text-primary" />
            </div>
            Profile Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UsageChart users={filteredUsers} />
        </CardContent>
      </Card>

      <Card className="border bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AuditActivityTimeline enabled={canSeeAudit} />
        </CardContent>
      </Card>

      <Card className="border bg-card/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-card-foreground">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
              <Shield className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {rings.map((ring) => (
              <div key={ring.label} className="flex flex-col items-center gap-2 text-center">
                <div className="relative">
                  <ProgressRing percent={ring.percent} size={88} tone={ring.tone} />
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold tabular-nums">
                    {Math.round(ring.percent)}%
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground/90">{ring.label}</div>
                  <div className="text-[11px] text-muted-foreground">{ring.detail}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
