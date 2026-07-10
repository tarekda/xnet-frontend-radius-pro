import React, { useMemo } from "react";
import { Clock, RefreshCw, User as UserIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/api/client";
import { formatAuditTitle, type AuditLogRow } from "./dashboardShared";

type Props = {
  enabled: boolean;
};

export const RECENT_AUDIT_QUERY_KEY = ["audit", "recent"] as const;

/** "Recent Activity" card: latest admin/reseller audit-log actions. Owns its own query. */
const RecentActivityCard: React.FC<Props> = ({ enabled }) => {
  const recentAuditQuery = useQuery({
    queryKey: RECENT_AUDIT_QUERY_KEY,
    queryFn: async () => {
      const resp = await apiClient.get("/audit", { params: { limit: 8 } });
      const rows = (resp?.data?.data ?? []) as AuditLogRow[];
      return Array.isArray(rows) ? rows : [];
    },
    enabled,
    refetchInterval: 30000,
  });

  const recentAudit = useMemo(() => {
    const rows = recentAuditQuery.data ?? [];
    return rows.map((e) => {
      const meta = (e as any)?.meta ?? {};
      const actor = meta?.actor?.username ?? "—";
      const targets = Array.isArray(meta?.targets) ? meta.targets : [];
      const primaryTarget = targets[0] ?? null;
      const action = String(e.message ?? "").replace(/^audit\./, "") || "—";
      const ts = e.timestamp ? new Date(e.timestamp) : null;
      const fmt = formatAuditTitle(action, meta);
      return { id: e.id, actor, targets, primaryTarget, action, title: fmt.title, detail: fmt.detail, ts };
    });
  }, [recentAuditQuery.data]);

  return (
    <Card className="w-full min-w-0 md:col-span-3 border-border/70 shadow-sm">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest admin and reseller actions</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recentAuditQuery.refetch()}
            disabled={recentAuditQuery.isFetching}
            className="w-full justify-center border-border bg-background/90 text-foreground shadow-sm hover:bg-accent dark:bg-card/90 sm:w-auto"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${recentAuditQuery.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {recentAuditQuery.isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[220px]" />
                  <Skeleton className="h-3 w-[140px]" />
                </div>
              </div>
            ))}
          </div>
        ) : recentAuditQuery.error ? (
          <div className="text-sm text-red-600">Failed to load activity.</div>
        ) : recentAudit.length === 0 ? (
          <div className="text-sm text-muted-foreground">No recent activity.</div>
        ) : (
          <div className="space-y-3">
            {recentAudit.map((e) => (
              <div
                key={String(e.id)}
                className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                  <UserIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{e.title}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    Actor: {e.actor}
                    {e.primaryTarget ? (
                      <>
                        {" • "}
                        Target:{" "}
                        <a className="underline" href={`/users/${encodeURIComponent(String(e.primaryTarget))}`}>
                          {String(e.primaryTarget)}
                        </a>
                      </>
                    ) : null}
                    {e.detail ? (
                      <>
                        {" • "}
                        {e.detail}
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                  <Clock className="h-3.5 w-3.5" />
                  {e.ts ? e.ts.toLocaleTimeString() : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityCard;
