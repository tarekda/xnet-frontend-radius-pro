import React from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import dynamic from "next/dynamic";
import type { RejectTrendPoint } from "./dashboardShared";

const RejectTrendChart = dynamic(() => import("./RejectTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart…</div>
  ),
});

type Props = {
  authHealthLabel: string;
  authHealthBadgeClass: string;
  authSuccessRate: number;
  authRejectRate: number;
  authAttempts: number;
  authAccepted: number;
  authRejected: number;
  rejectAlertThreshold: number;
  onRejectAlertThresholdChange: (value: number) => void;
  isRejectThresholdBreached: boolean;
  showRejectThresholdAlert: boolean;
  authFailuresLastHourHref: string;
  onMuteRejectAlert: () => void;
  quotaDailyCount: number;
  quotaMonthlyCount: number;
  totalNas: number;
  rejectTrendDisplayData: RejectTrendPoint[];
  rejectTrendWindowHours: 6 | 12 | 24;
  onRejectTrendWindowChange: (hours: 6 | 12 | 24) => void;
  rejectWindowStats: { attempts: number; rejected: number; avgRate: number };
  onSelectRejectBucket: (bucket: string) => void;
};

/** "NOC Snapshot (24h)" card: auth quality stats, reject alert threshold, and reject-rate trend chart. */
const NocSnapshotCard: React.FC<Props> = ({
  authHealthLabel,
  authHealthBadgeClass,
  authSuccessRate,
  authRejectRate,
  authAttempts,
  authAccepted,
  authRejected,
  rejectAlertThreshold,
  onRejectAlertThresholdChange,
  isRejectThresholdBreached,
  showRejectThresholdAlert,
  authFailuresLastHourHref,
  onMuteRejectAlert,
  quotaDailyCount,
  quotaMonthlyCount,
  totalNas,
  rejectTrendDisplayData,
  rejectTrendWindowHours,
  onRejectTrendWindowChange,
  rejectWindowStats,
  onSelectRejectBucket,
}) => {
  return (
    <Card className="rounded-lg border-border shadow-none lg:col-span-4">
      <CardHeader className="border-b border-border p-4">
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
      <CardContent className="p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/20 p-2.5">
          <div className="text-xs text-muted-foreground">Reject alert threshold</div>
          <Input
            type="number"
            min={1}
            max={100}
            value={rejectAlertThreshold}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onRejectAlertThresholdChange(Math.min(Math.max(Math.round(next), 1), 100));
            }}
            className="h-8 w-20 rounded-md bg-background"
          />
          <span className="text-xs text-muted-foreground">%</span>
          {isRejectThresholdBreached ? (
            <Badge variant="destructive">Threshold breached</Badge>
          ) : (
            <Badge variant="secondary">Within threshold</Badge>
          )}
        </div>
        {showRejectThresholdAlert ? (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <div className="text-sm text-red-700 dark:text-red-200">
              Reject rate is <span className="font-semibold">{authRejectRate.toFixed(1)}%</span> (threshold {rejectAlertThreshold}%).
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={authFailuresLastHourHref}>Open failed auths</Link>
              </Button>
              <Button variant="destructive" size="sm" onClick={onMuteRejectAlert}>
                Mute 30m
              </Button>
            </div>
          </div>
        ) : null}
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Auth Success Rate</div>
            <div className="mt-1 text-2xl font-semibold text-green-600 dark:text-green-400">{authSuccessRate.toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">{authAccepted} accepted of {authAttempts} attempts</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Auth Reject Rate</div>
            <div className="mt-1 text-2xl font-semibold text-red-600 dark:text-red-400">{authRejectRate.toFixed(1)}%</div>
            <div className="mt-1 text-xs text-muted-foreground">{authRejected} rejected requests</div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">Users in FUP</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600 dark:text-amber-400">
              {quotaDailyCount + quotaMonthlyCount}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {quotaDailyCount} daily / {quotaMonthlyCount} monthly
            </div>
          </div>
          <div className="rounded-md border border-border p-3">
            <div className="text-xs text-muted-foreground">NAS Devices</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{totalNas}</div>
            <div className="mt-1 text-xs text-muted-foreground">Configured NAS entries</div>
          </div>
        </div>
        <div className="mt-3 rounded-md border border-border p-3">
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
                  if (n === 6 || n === 12 || n === 24) onRejectTrendWindowChange(n);
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
            <div className="rounded-md border border-border bg-muted/20 p-1.5">
              <div className="text-muted-foreground">Attempts</div>
              <div className="font-semibold">{rejectWindowStats.attempts}</div>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-1.5">
              <div className="text-muted-foreground">Rejected</div>
              <div className="font-semibold">{rejectWindowStats.rejected}</div>
            </div>
            <div className="rounded-md border border-border bg-muted/20 p-1.5">
              <div className="text-muted-foreground">Avg reject</div>
              <div className="font-semibold">{rejectWindowStats.avgRate.toFixed(1)}%</div>
            </div>
          </div>
          <div className="h-28 w-full">
            {rejectTrendDisplayData.length ? (
              <RejectTrendChart data={rejectTrendDisplayData} onSelectRejectBucket={onSelectRejectBucket} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Not enough auth history yet
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default NocSnapshotCard;
