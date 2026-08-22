"use client";

import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, Zap, ShieldAlert, Wifi } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";

export type HighlightItem =
  | string
  | {
      code?: string;
      severity?: string;
      message?: string;
      count?: number;
    };

export type RecommendedActionItem =
  | string
  | {
      priority?: number;
      label?: string;
      action?: string;
    };

export interface AIDiagnosisData {
  username: string;
  healthScore: number;
  summary: string;
  highlights: HighlightItem[];
  recommendedActions: RecommendedActionItem[];
}

export function AIDiagnosticsCard({ username }: { username: string }) {
  const qc = useQueryClient();

  const query = useQuery<AIDiagnosisData | null>({
    queryKey: ["aiDiagnostics", username],
    queryFn: async () => {
      if (!username) return null;
      try {
        const { data } = await apiClient.get(`/ai/ops/diagnose/${encodeURIComponent(username)}`);
        return data?.data ?? null;
      } catch {
        return null;
      }
    },
    enabled: Boolean(username),
    staleTime: 60 * 1000,
  });

  const resetMacMutation = useMutation({
    mutationFn: () => apiClient.post(`/radius/users/resetAddress/${encodeURIComponent(username)}`),
    onSuccess: () => {
      notify.success("MAC Reset", `Cleared MAC address for ${username}`);
      qc.invalidateQueries({ queryKey: ["aiDiagnostics", username] });
      qc.invalidateQueries({ queryKey: ["user", username] });
    },
    onError: (err: any) => notify.error("MAC Reset Failed", err?.response?.data?.message || err?.message),
  });

  const resetQuotaMutation = useMutation({
    mutationFn: () => apiClient.put(`/radius/users/resetQuota/${encodeURIComponent(username)}`),
    onSuccess: () => {
      notify.success("Daily Quota Reset", `Daily quota reset for ${username}`);
      qc.invalidateQueries({ queryKey: ["aiDiagnostics", username] });
      qc.invalidateQueries({ queryKey: ["user", username] });
    },
    onError: (err: any) => notify.error("Quota Reset Failed", err?.response?.data?.message || err?.message),
  });

  const data = query.data;

  if (query.isLoading) {
    return (
      <Card className="border border-border/60 shadow-xs bg-gradient-to-r from-indigo-500/5 via-background to-purple-500/5 p-4">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
          <span className="text-sm font-medium text-muted-foreground">Analyzing line connectivity with AI Copilot…</span>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const score = Number(data.healthScore ?? 100);
  const isGood = score >= 80;
  const isWarning = score >= 50 && score < 80;

  const formattedHighlights = (data.highlights || []).map((item) => {
    if (typeof item === "string") return item;
    return item?.message || item?.code || JSON.stringify(item);
  });

  const formattedActions = (data.recommendedActions || []).map((item) => {
    if (typeof item === "string") return { label: item, action: "general" };
    return {
      label: item?.label || item?.action || "Recommended Action",
      action: item?.action || "general",
    };
  });

  return (
    <Card className="border border-primary/30 shadow-md bg-gradient-to-r from-indigo-500/10 via-background to-purple-500/10 overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              AI Line Copilot Diagnostics
              <Badge variant="outline" className="text-[10px] font-mono border-primary/30 bg-primary/5">
                Live Analysis
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground">Automated NOC telemetry & pattern recognition</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-semibold text-xs px-2.5 py-1 ${
              isGood
                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                : isWarning
                  ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                  : "bg-destructive/10 text-destructive border-destructive/30"
            }`}
          >
            Health Score: {score}/100
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => query.refetch()}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            title="Re-run AI Diagnostics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Summary text */}
        <div className="text-sm text-foreground font-medium flex items-start gap-2 bg-background/80 p-3 rounded-lg border border-border/50">
          {isGood ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          )}
          <span>{data.summary || "Line status healthy with normal auth parameters."}</span>
        </div>

        {/* Highlights */}
        {formattedHighlights.length > 0 ? (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Diagnostic Telemetry
            </span>
            <div className="flex flex-wrap gap-1.5">
              {formattedHighlights.map((hl, idx) => (
                <div
                  key={idx}
                  className="text-xs bg-muted/60 text-foreground px-2.5 py-1 rounded-md border border-border/50 font-mono"
                >
                  {hl}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Recommended 1-Click Fix Actions */}
        {formattedActions.length > 0 ? (
          <div className="pt-2 border-t border-border/40 space-y-2">
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Suggested AI Resolutions
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {formattedActions.map((act, idx) => {
                const isResetMac = act.action?.toLowerCase().includes("mac") || act.label?.toLowerCase().includes("mac");
                const isResetQuota = act.action?.toLowerCase().includes("quota") || act.label?.toLowerCase().includes("quota");
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (isResetMac) resetMacMutation.mutate();
                      else if (isResetQuota) resetQuotaMutation.mutate();
                      else notify.info("Action Selected", act.label);
                    }}
                    disabled={resetMacMutation.isPending || resetQuotaMutation.isPending}
                    className="h-8 text-xs gap-1.5 bg-background hover:bg-primary/10 border-primary/30 text-primary shadow-xs"
                  >
                    <Zap className="h-3 w-3 text-amber-500" />
                    {act.label}
                  </Button>
                );
              })}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
