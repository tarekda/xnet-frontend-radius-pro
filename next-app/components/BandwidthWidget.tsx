import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Upload,
  Activity,
  WifiOff,
  Server
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useBandwidthMetrics, useHistoricalBandwidth, formatBytes, formatUptime } from '@/hooks/useBandwidth';

export const bytesPerSecToMbps = (bps: number, decimals = 2) =>
  ((bps * 8) / 1_000_000).toFixed(decimals);   // returns string

const BandwidthWidget: React.FC = () => {
  const { data: metrics, isLoading, error } = useBandwidthMetrics();
  const ifaceName = Array.isArray(metrics?.interfaces) ? metrics?.interfaces[0]?.interface : null;
  const historical = useHistoricalBandwidth(ifaceName || null, 3600);

  if (isLoading) {
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-[120px]" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-4 w-[200px]" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[60px]" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-[80px]" />
              <Skeleton className="h-4 w-[60px]" />
            </div>
            <Skeleton className="h-2 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="hover:shadow-lg transition-shadow border-destructive/30 bg-destructive/5 dark:border-destructive/20 dark:bg-destructive/10">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-destructive">Bandwidth Monitor</CardTitle>
            <WifiOff className="h-4 w-4 text-destructive" />
          </div>
          <CardDescription className="text-destructive/80">Connection Error</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive/80">Unable to connect to MikroTik router</p>
        </CardContent>
      </Card>
    );
  }

  if (!metrics) {
    return (
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Bandwidth Monitor</CardTitle>
          <CardDescription>No metric data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { bandwidth, system } = metrics;

  // Prefer per-interface rxRate/txRate (matches backend interfaces[] payload), fallback to bandwidth.*.rate
  const iface = Array.isArray(metrics.interfaces) ? metrics.interfaces[0] : undefined;
  const downloadRate = (iface?.rxRate ?? bandwidth.download.rate) as number;
  const uploadRate = (iface?.txRate ?? bandwidth.upload.rate) as number;

  const downloadMbps = Number.isFinite(downloadRate) ? downloadRate.toFixed(1) : '0';
  const uploadMbps = Number.isFinite(uploadRate) ? uploadRate.toFixed(1) : '0';

  return (
    <Card className="w-full min-w-0 hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-sm font-medium">Bandwidth Monitor</CardTitle>
            <CardDescription>Real-time network traffic</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant="outline" className="flex w-fit items-center gap-1">
              <Activity className="h-3 w-3 text-green-500" />
              Live
            </Badge>
            <Server className="h-4 w-4 text-blue-600" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          {/* Download Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Download</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {downloadMbps} Mbps
                </span>
                <Badge variant="secondary" className="text-xs">
                  {bandwidth.download.utilization.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(bandwidth.download.utilization, 100)}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Download: {downloadMbps} Mbps ({formatBytes(bandwidth.download.bytes)} total)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Upload Speed */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Upload</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {uploadMbps} Mbps
                </span>
                <Badge variant="secondary" className="text-xs">
                  {bandwidth.upload.utilization.toFixed(1)}%
                </Badge>
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger>
                <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(bandwidth.upload.utilization, 100)}%` }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Upload: {uploadMbps} Mbps ({formatBytes(bandwidth.upload.bytes)} total)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Total Traffic */}
          <div className="pt-2 border-t">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Total Traffic</span>
              <span>{formatBytes(bandwidth.total.bytes)}</span>
            </div>
            {historical.data && historical.data.length > 0 ? (
              <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Last hour samples</span>
                <span>{historical.data.length}</span>
              </div>
            ) : null}
          </div>

          {/* System Info */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">CPU Load</span>
              <span className="font-medium">{system.cpuLoad}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Memory</span>
              <span className="font-medium">{system.memoryUsage.toFixed(1)}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium">{formatUptime(system.uptime)}</span>
            </div>
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
};

export default BandwidthWidget; 