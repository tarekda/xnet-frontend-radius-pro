import React from "react";
import { Activity, Server, Shield } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { healthBarTone, latencyLoadPct, type NocHealth } from "./dashboardShared";

type Props = {
  authHealthLabel: string;
  authHealthBadgeClass: string;
  authSuccessRate: number;
  authAccepted: number;
  authRejected: number;
  healthState: string;
  healthBadgeClass: string;
  nocHealth: NocHealth;
  totalNas: number;
  fupUsersCount: number;
};

/** "Platform Health" card: auth quality and API latency from live probes. */
const PlatformHealthCard: React.FC<Props> = ({
  authHealthLabel,
  authHealthBadgeClass,
  authSuccessRate,
  authAccepted,
  authRejected,
  healthState,
  healthBadgeClass,
  nocHealth,
  totalNas,
  fupUsersCount,
}) => {
  return (
    <Card className="w-full min-w-0 md:col-span-4">
      <CardHeader className="border-b border-border p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>Authentication quality and API latency from live probes</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={authHealthBadgeClass}>
              Auth {authHealthLabel}
            </Badge>
            <Badge variant="outline" className={healthBadgeClass}>
              API {healthState}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Auth success rate (24h)</span>
              </div>
              <span className="font-semibold tabular-nums">{authSuccessRate.toFixed(1)}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${healthBarTone(100 - authSuccessRate)}`}
                style={{ width: `${Math.min(100, Math.max(0, authSuccessRate))}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {authAccepted.toLocaleString()} accepted · {authRejected.toLocaleString()} rejected
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Server className="h-4 w-4 text-primary" />
                <span className="font-medium">Database latency</span>
              </div>
              <span className="font-semibold tabular-nums">{Math.round(nocHealth.dbLatencyMs)} ms</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${healthBarTone(latencyLoadPct(nocHealth.dbLatencyMs, 120, 400))}`}
                style={{ width: `${latencyLoadPct(nocHealth.dbLatencyMs, 120, 400)}%` }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                <span className="font-medium">Client round-trip</span>
              </div>
              <span className="font-semibold tabular-nums">{Math.round(nocHealth.clientRttMs)} ms</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${healthBarTone(latencyLoadPct(nocHealth.clientRttMs, 800, 2000))}`}
                style={{ width: `${latencyLoadPct(nocHealth.clientRttMs, 800, 2000)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Active sessions</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{Number(nocHealth.activeSessions ?? 0)}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">NAS devices</div>
            <div className="mt-1 text-xl font-bold tabular-nums">{totalNas}</div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-3">
            <div className="text-xs text-muted-foreground">Users in FUP</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-amber-600">{fupUsersCount}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformHealthCard;
