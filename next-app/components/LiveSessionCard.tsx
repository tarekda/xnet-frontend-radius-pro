import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Clock, Radio, Server, XCircle } from "lucide-react";
import { apiClient } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

function formatBytes(bytes?: number | string | null) {
  const n = Number(bytes ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / 1024 ** i).toFixed(2)} ${units[i]}`;
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "—";
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function LiveSessionCard({ username }: { username: string }) {
  const liveQuery = useQuery({
    queryKey: ["liveSession", username],
    queryFn: async () => {
      const resp = await apiClient.get(`/sessions/live/${encodeURIComponent(username)}`);
      return resp?.data?.data ?? null;
    },
    enabled: Boolean(username),
    refetchInterval: 10000,
    retry: false,
  });

  const rejectsQuery = useQuery({
    queryKey: ["userRejects", username],
    queryFn: async () => {
      const resp = await apiClient.get(`/sessions/rejects/${encodeURIComponent(username)}`, {
        params: { limit: 10 }
      });
      return resp?.data?.data ?? [];
    },
    enabled: Boolean(username),
    refetchInterval: 15000,
  });

  const live = liveQuery.data;
  const rejects = rejectsQuery.data ?? [];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border/60 shadow-none hover:border-primary/20 transition-colors">
        <CardHeader className="border-b border-border/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Radio className={`h-4 w-4 ${live ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
                Current Live Session
              </CardTitle>
              <CardDescription>Real-time RADIUS accounting state</CardDescription>
            </div>
            {live ? (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Offline</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {liveQuery.isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : live ? (
            <div className="grid grid-cols-2 divide-x divide-y divide-border/50 text-sm">
              <div className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Clock className="h-3.5 w-3.5" /> Uptime
                </div>
                <div className="font-medium">{formatDuration(live.sessionTime)}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  Since {new Date(live.acctStartTime).toLocaleTimeString()}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Server className="h-3.5 w-3.5" /> Assigned IP
                </div>
                <div className="font-mono font-medium">{live.framedIpAddress || "—"}</div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  NAS: {live.nasIpAddress || "—"}
                </div>
              </div>
              <div className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Download className="h-3.5 w-3.5 text-blue-500" /> Total Download
                </div>
                <div className="font-medium">{formatBytes(live.totalBytesOut)}</div>
              </div>
              <div className="p-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                  <Upload className="h-3.5 w-3.5 text-emerald-500" /> Total Upload
                </div>
                <div className="font-medium">{formatBytes(live.totalBytesIn)}</div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center">
              <Activity className="h-8 w-8 text-muted-foreground/30 mb-2" />
              No active session found right now.
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card hover:border-primary/20 transition-colors flex flex-col">
        <CardHeader className="border-b border-border/50 p-4">
          <CardTitle className="text-base flex items-center gap-2">
            <XCircle className="h-4 w-4 text-rose-500" />
            Recent Rejects
          </CardTitle>
          <CardDescription>Latest authentication failures</CardDescription>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto max-h-[220px]">
          {rejectsQuery.isLoading ? (
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : rejects.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/30 sticky top-0">
                <TableRow>
                  <TableHead className="w-[140px] text-xs">Time</TableHead>
                  <TableHead className="text-xs">NAS / MAC</TableHead>
                  <TableHead className="text-right text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rejects.map((rej: any, idx: number) => (
                  <TableRow key={idx} className="hover:bg-primary/[0.02]">
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(rej.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-mono">{rej.nasIp}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{rej.macAddress || "—"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="border-rose-200 text-rose-600 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/50">
                        {rej.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center h-full">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/30 mb-2" />
              No recent authentication rejects.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Ensure these imports are available for the component if missing
import { Download, Upload, CheckCircle2 } from "lucide-react";
