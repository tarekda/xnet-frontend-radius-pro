import React from "react";
import Link from "next/link";
import { RefreshCw, Server } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import FilterPills from "@/components/FilterPills";
import dynamic from "next/dynamic";
import type { OnlineUser } from "@/hooks/useOnlineUsers";

const LatencyTrendChart = dynamic(() => import("./LatencyTrendChart"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Loading chart…</div>
  ),
});
import {
  formatAgo,
  isSessionStale,
  type NocHealth,
  type NocHealthSample,
  type TopNasEntry,
  type WatchlistFilter,
} from "./dashboardShared";

type Props = {
  watchlistLoading: boolean;
  watchlistFetching: boolean;
  onRefreshWatchlist: () => void;
  watchlistRows: OnlineUser[];
  filteredWatchlistRows: OnlineUser[];
  watchlistCounts: { fup: number; stale: number };
  watchlistFilter: WatchlistFilter;
  onWatchlistFilterChange: (filter: WatchlistFilter) => void;
  watchlistStaleThresholdSec: number;
  nocHealth: NocHealth;
  healthState: string;
  healthBadgeClass: string;
  nocHealthFetching: boolean;
  nocHealthTrend: NocHealthSample[];
  degradedHealthSamples: number;
  topNasBySessions: TopNasEntry[];
  onRefreshSnapshot: () => void;
  snapshotFetching: boolean;
};

/** "Live Session Watchlist" card: session triage list, API health probes, and top NAS by sessions. */
const WatchlistCard: React.FC<Props> = ({
  watchlistLoading,
  watchlistFetching,
  onRefreshWatchlist,
  watchlistRows,
  filteredWatchlistRows,
  watchlistCounts,
  watchlistFilter,
  onWatchlistFilterChange,
  watchlistStaleThresholdSec,
  nocHealth,
  healthState,
  healthBadgeClass,
  nocHealthFetching,
  nocHealthTrend,
  degradedHealthSamples,
  topNasBySessions,
  onRefreshSnapshot,
  snapshotFetching,
}) => {
  return (
    <Card className="rounded-lg border-border shadow-none lg:col-span-3">
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Session Watchlist</CardTitle>
            <CardDescription>Latest active sessions for quick triage</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefreshWatchlist} disabled={watchlistFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${watchlistFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {watchlistLoading ? (
          <div className="space-y-1.5">
            {[...Array(5)].map((_, idx) => (
              <Skeleton key={idx} className="h-10 w-full" />
            ))}
          </div>
        ) : filteredWatchlistRows.length === 0 ? (
          <div className="text-sm text-muted-foreground">No sessions match the selected watchlist filter.</div>
        ) : (
          <div className="space-y-2">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <FilterPills
                value={watchlistFilter}
                onChange={(v) => onWatchlistFilterChange(v as WatchlistFilter)}
                options={[
                  { value: "all", label: `All (${watchlistRows.length})` },
                  { value: "fup", label: `FUP (${watchlistCounts.fup})` },
                  { value: "stale", label: `Stale (${watchlistCounts.stale})` },
                ]}
                name="dashboard-watchlist-filter"
              />
            </div>
            {filteredWatchlistRows.map((row) => (
              <div key={`${row.session_username}-${row.session_mac_address}`} className="flex items-center justify-between rounded-md border border-border p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{row.session_username}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {row.profile_profile_name || "No profile"} • Last update {formatAgo(row.session_last_update)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {isSessionStale(row.session_last_update, watchlistStaleThresholdSec) ? (
                    <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                      Stale
                    </Badge>
                  ) : null}
                  <Badge variant={row.is_fallback ? "destructive" : "secondary"}>
                    {row.is_fallback ? "FUP" : "Normal"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="my-3 border-t" />
        <div className="mb-3 rounded-md border border-border bg-muted/10 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">API Health</div>
            <Badge variant="outline" className={healthBadgeClass}>{healthState}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border bg-background p-2">
              <div className="text-muted-foreground">DB latency</div>
              <div className="font-semibold">{Math.round(Number(nocHealth.dbLatencyMs ?? 0))} ms</div>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <div className="text-muted-foreground">Server processing</div>
              <div className="font-semibold">{Math.round(Number(nocHealth.serverProcessingMs ?? 0))} ms</div>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <div className="text-muted-foreground">Client RTT</div>
              <div className="font-semibold">{Math.round(Number(nocHealth.clientRttMs ?? 0))} ms</div>
            </div>
            <div className="rounded-md border border-border bg-background p-2">
              <div className="text-muted-foreground">Active sessions</div>
              <div className="font-semibold">{Number(nocHealth.activeSessions ?? 0)}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="inline-flex items-center gap-1">
              <Server className="h-3.5 w-3.5" />
              {nocHealthFetching ? "Refreshing..." : "Auto-refresh 30s"}
            </div>
            <div>
              {nocHealth.generatedAt ? `Updated ${new Date(nocHealth.generatedAt).toLocaleTimeString()}` : "No sample yet"}
            </div>
          </div>
          <div className="mt-3 rounded-md border border-border bg-background p-2">
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Latency trend ({nocHealthTrend.length} samples)</span>
              <span>{degradedHealthSamples} degraded</span>
            </div>
            <div className="h-20 w-full">
              {nocHealthTrend.length ? (
                <LatencyTrendChart data={nocHealthTrend} />
              ) : (
                <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Collecting samples...</div>
              )}
            </div>
          </div>
        </div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium">Top NAS by Active Sessions</div>
          <Button variant="ghost" size="sm" onClick={onRefreshSnapshot} disabled={snapshotFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${snapshotFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        {!topNasBySessions.length ? (
          <div className="text-sm text-muted-foreground">No NAS session data available.</div>
        ) : (
          <div className="space-y-1.5">
            {topNasBySessions.map((nas) => (
              <Link
                key={`${nas.nasIp}-${nas.nasLabel}`}
                href={`/online-users?search=${encodeURIComponent(nas.nasIp)}`}
                className="block rounded-md border border-border p-2.5 transition-colors hover:border-primary/30 hover:bg-primary/5"
                title="Open live sessions filtered by this NAS"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{nas.nasLabel || nas.nasIp}</div>
                    <div className="truncate text-xs text-muted-foreground">{nas.nasIp}</div>
                  </div>
                  <Badge variant="secondary">{nas.sessions} sessions</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WatchlistCard;
