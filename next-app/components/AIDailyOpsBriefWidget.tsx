"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, AlertTriangle, ShieldAlert, Activity, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/client";

export type HighlightItem =
  | string
  | {
      code?: string;
      severity?: string;
      message?: string;
      count?: number;
    };

export interface AIDailyOpsBriefData {
  generatedAt?: string;
  summary?: string;
  totalAuthFailures24h?: number;
  rejectCount24h?: number;
  highlights?: HighlightItem[];
}

export function AIDailyOpsBriefWidget() {
  const query = useQuery<AIDailyOpsBriefData | null>({
    queryKey: ["aiDailyOpsBrief"],
    queryFn: async () => {
      try {
        const { data } = await apiClient.get("/ai/ops/daily-brief");
        return data?.data ?? null;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const data = query.data;

  if (query.isLoading) {
    return (
      <Card className="border border-border/60 shadow-xs bg-muted/20 p-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Loading AI NOC Operational Brief…</span>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const formattedHighlights = (data.highlights || []).map((item) => {
    if (typeof item === "string") return { message: item, severity: "info" };
    return {
      message: item?.message || item?.code || JSON.stringify(item),
      severity: item?.severity || "info",
      count: item?.count,
    };
  });

  const rejects = Number(data.rejectCount24h ?? data.totalAuthFailures24h ?? 0);

  return (
    <Card className="border border-indigo-500/30 shadow-sm bg-gradient-to-r from-indigo-500/10 via-background to-purple-500/10 overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              NOC Daily AI Operational Brief
              <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 bg-indigo-500/10 text-indigo-600">
                Copilot Insight
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Real-time network security & subscriber auth telemetry</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => query.refetch()}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          title="Refresh Brief"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        <div className="text-sm text-foreground font-medium flex items-start gap-2 bg-background/80 p-3 rounded-lg border border-border/50">
          <Activity className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
          <span>{data.summary || "All network authentication services are performing within normal parameters."}</span>
        </div>

        {formattedHighlights.length > 0 ? (
          <div className="space-y-2">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Network Highlights (Last 24 Hours)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {formattedHighlights.map((hl, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs p-2 rounded-md border border-border/60 bg-card shadow-2xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    {hl.severity === "high" || hl.severity === "danger" ? (
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    )}
                    <span className="truncate font-medium">{hl.message}</span>
                  </div>
                  {hl.count != null ? (
                    <Badge variant="secondary" className="font-mono text-[10px] shrink-0 ml-1">
                      {hl.count}
                    </Badge>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
