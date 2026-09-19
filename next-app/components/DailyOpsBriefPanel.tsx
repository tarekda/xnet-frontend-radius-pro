import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDailyOpsBrief, type OpsBriefSeverity } from "@/hooks/useDailyOpsBrief";

function severityBadge(severity: OpsBriefSeverity) {
  if (severity === "critical") {
    return (
      <Badge variant="outline" className="border-red-500 text-red-600 dark:text-red-400">
        Needs attention
      </Badge>
    );
  }
  if (severity === "warning") {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
        Watch list
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-300">
      All clear
    </Badge>
  );
}

function highlightIcon(severity: "info" | "warning" | "critical") {
  if (severity === "critical") return <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />;
  if (severity === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
  return <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />;
}

export default function DailyOpsBriefPanel() {
  const briefQuery = useDailyOpsBrief();
  const brief = briefQuery.data;

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Daily ops brief
          </CardTitle>
          <CardDescription>
            Last 24 hours — connectivity, quota, accounts, and billing signals for support triage.
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={briefQuery.isFetching}
          onClick={() => briefQuery.refetch()}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${briefQuery.isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {briefQuery.isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : briefQuery.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">Could not load the ops brief.</p>
        ) : brief ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {severityBadge(brief.severity)}
              {brief.aiEnhanced ? (
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI summary
                </Badge>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {new Date(brief.generatedAt).toLocaleString()}
              </span>
            </div>

            <p className="text-sm leading-relaxed">{brief.summary}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground text-xs">Offline + rejects</div>
                <div className="text-xl font-semibold tabular-nums">{brief.metrics.offlineWithRecentRejects}</div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground text-xs">Quota exceeded</div>
                <div className="text-xl font-semibold tabular-nums">{brief.metrics.quotaExceeded}</div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground text-xs">Auth reject rate</div>
                <div className="text-xl font-semibold tabular-nums">{brief.metrics.authRejectRate24h}%</div>
              </div>
              <div className="rounded-lg border p-3 text-sm">
                <div className="text-muted-foreground text-xs">Overdue invoices</div>
                <div className="text-xl font-semibold tabular-nums">{brief.metrics.overdueInvoices}</div>
              </div>
            </div>

            {brief.highlights.length > 0 ? (
              <ul className="space-y-2">
                {brief.highlights.map((h) => (
                  <li key={h.code} className="flex gap-2 text-sm">
                    {highlightIcon(h.severity)}
                    <span>{h.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            {brief.usersWithRecentRejects.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="text-sm font-medium">Users with recent auth failures</div>
                <div className="flex flex-wrap gap-2">
                  {brief.usersWithRecentRejects.slice(0, 8).map((u) => (
                    <Link
                      key={u.username}
                      href={`/users/${encodeURIComponent(u.username)}`}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs hover:bg-muted/60 transition-colors"
                    >
                      <span className="font-medium">{u.username}</span>
                      <Badge variant={u.isOnline ? "secondary" : "destructive"} className="text-[10px] px-1.5 py-0">
                        {u.isOnline ? "online" : "offline"}
                      </Badge>
                      <span className="text-muted-foreground">{u.rejectCount}×</span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {brief.topNasAuthFailures.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-border/60">
                <div className="text-sm font-medium">Top NAS auth failures (24h)</div>
                <div className="space-y-1.5">
                  {brief.topNasAuthFailures.map((nas) => (
                    <Link
                      key={nas.nasIp}
                      href={`/online-users?search=${encodeURIComponent(nas.nasIp)}`}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span>
                        {nas.nasLabel}{" "}
                        <span className="text-muted-foreground font-mono text-xs">({nas.nasIp})</span>
                      </span>
                      <Badge variant="outline">{nas.failures}</Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
