"use client";

import { useQuery } from "@tanstack/react-query";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/client";
import { Database, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DailyUsageRow {
  eventDate: string;
  username: string;
  bytesIn: number;
  bytesOut: number;
  flowsCount: number;
}

interface AnomalyData {
  flapping?: {
    isFlapping: boolean;
    disconnectCount: number;
    timeframeMinutes: number;
  };
  spoofing?: {
    isSpoofed: boolean;
    activeMacs: string[];
    nasAddresses: string[];
  };
}

export function ClickHouseBandwidthChart({ username }: { username: string }) {
  const usageQuery = useQuery({
    queryKey: ["daily-usage", username],
    queryFn: async () => {
      if (!username) return [];
      const resp = await apiClient.get(`/analytics/daily-usage/${encodeURIComponent(username)}`);
      return (resp.data?.data || []) as DailyUsageRow[];
    },
    enabled: Boolean(username),
    staleTime: 60000,
  });

  const anomalyQuery = useQuery({
    queryKey: ["subscriber-anomalies", username],
    queryFn: async () => {
      if (!username) return null;
      const resp = await apiClient.get(`/analytics/anomalies/${encodeURIComponent(username)}`);
      return (resp.data?.data || null) as AnomalyData | null;
    },
    enabled: Boolean(username),
    staleTime: 30000,
  });

  const chartData = (usageQuery.data || []).map((row) => ({
    date: row.eventDate,
    downloadMB: parseFloat((row.bytesIn / (1024 * 1024)).toFixed(2)),
    uploadMB: parseFloat((row.bytesOut / (1024 * 1024)).toFixed(2)),
  }));

  const flapping = anomalyQuery.data?.flapping;
  const spoofing = anomalyQuery.data?.spoofing;

  return (
    <div className="space-y-4">
      {/* Diagnostics / Security Banner */}
      {(flapping?.isFlapping || spoofing?.isSpoofed) && (
        <Card className="border-amber-500/40 bg-amber-500/10">
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
              NOC Security Alerts Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="py-2 text-xs space-y-2">
            {flapping?.isFlapping && (
              <div className="flex items-center justify-between">
                <span>Frequent Disconnections (Flapping):</span>
                <Badge variant="destructive">{flapping.disconnectCount} disconnects / {flapping.timeframeMinutes}m</Badge>
              </div>
            )}
            {spoofing?.isSpoofed && (
              <div className="flex items-center justify-between">
                <span>Multi-MAC Concurrency Warning:</span>
                <Badge variant="destructive">{spoofing.activeMacs.length} distinct MACs</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Daily Usage Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-500" />
              ClickHouse Bandwidth Analytics
            </CardTitle>
            <CardDescription className="text-xs">
              Daily bandwidth aggregated per subscriber (Upload vs Download)
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              usageQuery.refetch();
              anomalyQuery.refetch();
            }}
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Refresh
          </Button>
        </CardHeader>

        <CardContent>
          {usageQuery.isLoading ? (
            <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
              Loading ClickHouse usage logs...
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm border border-dashed rounded-md">
              No historical ClickHouse usage logs found for this subscriber.
            </div>
          ) : (
            <div className="h-64 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="downloadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit=" MB" />
                  <Tooltip
                    formatter={(val: any) => [`${val} MB`, ""]}
                    contentStyle={{ borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="downloadMB"
                    name="Download (In)"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#downloadGrad)"
                  />
                  <Area
                    type="monotone"
                    dataKey="uploadMB"
                    name="Upload (Out)"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#uploadGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
