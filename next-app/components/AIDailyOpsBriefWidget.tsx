"use client";

import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, RefreshCw, ShieldAlert, Activity, CheckCircle2, Clock } from "lucide-react";
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

// ─── Skeleton Loading State ───────────────────────────────────────────────────
function BriefSkeleton() {
  return (
    <Card className="border border-indigo-500/30 overflow-hidden">
      <div className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg animate-shimmer" />
          <div className="space-y-1.5">
            <div className="h-3.5 w-36 rounded animate-shimmer" />
            <div className="h-2.5 w-48 rounded animate-shimmer" />
          </div>
        </div>
        <div className="h-7 w-7 rounded animate-shimmer" />
      </div>
      <div className="p-4 space-y-3">
        <div className="rounded-lg border border-border/50 bg-background/80 p-3 space-y-2">
          <div className="h-3 w-full rounded animate-shimmer" />
          <div className="h-3 w-4/5 rounded animate-shimmer" />
          <div className="h-3 w-3/5 rounded animate-shimmer" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-8 rounded-md border border-border/60 animate-shimmer" />
          ))}
        </div>
      </div>
    </Card>
  );
}

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  const indexRef = useRef(0);
  const prevText = useRef("");

  useEffect(() => {
    if (text === prevText.current) return;
    prevText.current = text;
    indexRef.current = 0;
    setDisplayed("");
    setDone(false);

    const interval = setInterval(() => {
      indexRef.current += 1;
      setDisplayed(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return { displayed, done };
}

// ─── Relative Time ─────────────────────────────────────────────────────────
function useRelativeTime(iso?: string) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    if (!iso) return;
    const update = () => {
      const sec = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
      if (sec < 60) setLabel(`${sec}s ago`);
      else if (sec < 3600) setLabel(`${Math.floor(sec / 60)}m ago`);
      else setLabel(`${Math.floor(sec / 3600)}h ago`);
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [iso]);

  return label;
}

// ─── Widget ───────────────────────────────────────────────────────────────────
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
  const summaryText = data?.summary ?? "";
  const { displayed: typedSummary, done: typewriterDone } = useTypewriter(summaryText, 16);
  const generatedAgo = useRelativeTime(data?.generatedAt);

  if (query.isLoading) return <BriefSkeleton />;
  if (!data) return null;

  const formattedHighlights = (data.highlights || []).map((item) => {
    if (typeof item === "string") return { message: item, severity: "info" };
    return {
      message: item?.message || item?.code || JSON.stringify(item),
      severity: item?.severity || "info",
      count: item?.count,
    };
  });

  return (
    <Card className="gradient-border border border-indigo-500/30 shadow-sm bg-gradient-to-r from-indigo-500/10 via-background to-purple-500/10 overflow-hidden animate-slide-up">
      {/* Subtle top shimmer bar */}
      <div className="h-[2px] bg-gradient-to-r from-indigo-500 via-sky-400 to-violet-500 opacity-70" />

      <CardHeader className="p-4 pb-2 border-b border-border/40 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              NOC Daily AI Operational Brief
              <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                Copilot Insight
              </Badge>
            </CardTitle>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Real-time network security &amp; subscriber auth telemetry
              {generatedAgo && (
                <>
                  <span className="opacity-40 mx-1">·</span>
                  <Clock className="h-3 w-3 opacity-60" />
                  <span className="opacity-70">Generated {generatedAgo}</span>
                </>
              )}
            </p>
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
        {/* Typewriter summary */}
        <div className="text-sm text-foreground font-medium flex items-start gap-2 bg-background/80 p-3 rounded-lg border border-border/50">
          <Activity className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
          <span className={!typewriterDone ? "typewriter-cursor" : ""}>
            {typedSummary || "All network authentication services are performing within normal parameters."}
          </span>
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
                  className="flex items-center justify-between text-xs p-2 rounded-md border border-border/60 bg-card shadow-2xs animate-slide-up"
                  style={{ animationDelay: `${idx * 0.06}s` }}
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
