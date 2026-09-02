"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  actions?: React.ReactNode;
  rightContent?: React.ReactNode;
  className?: string;
  /** Default: "card" */
  variant?: "card" | "gradient";
  /** Show a live HH:mm:ss clock on gradient headers (great for NOC dashboards) */
  liveTime?: boolean;
  /** Optional badge/pill slot rendered next to the icon */
  badge?: React.ReactNode;
};

function useLiveClock(enabled: boolean) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    if (!enabled) return;
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 1000);
    return () => clearInterval(id);
  }, [enabled]);

  return time;
}

const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  icon: Icon,
  actions,
  rightContent,
  className,
  variant = "card",
  liveTime = false,
  badge,
}) => {
  const isGradient = variant === "gradient";
  const clock = useLiveClock(isGradient && liveTime);

  return (
    <div
      className={cn(
        "relative rounded-xl border border-border/80 p-4 shadow-[var(--shop-shadow)] transition-all duration-300 sm:p-5 overflow-hidden",
        isGradient
          ? "border-primary/20 text-foreground"
          : "bg-card/95 backdrop-blur-md",
        className
      )}
    >
      {/* Animated mesh background (gradient variant only) */}
      {isGradient && (
        <>
          <div className="absolute inset-0 animated-mesh-bg opacity-80" />
          {/* Subtle static tint overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-secondary/40 to-background/70 backdrop-blur-sm" />
          {/* Left accent bar */}
          <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-indigo-500 to-purple-600 rounded-l-xl" />
          {/* Ambient glow orbs */}
          <div className="absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-12 -bottom-20 h-40 w-40 rounded-full bg-indigo-500/15 blur-2xl pointer-events-none" />
        </>
      )}

      <div className={cn("relative", isGradient && "z-10 pl-2")}>
        <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3.5 min-w-0">
            {Icon ? (
              <div
                className={cn(
                  "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border shadow-sm transition-transform duration-200 hover:scale-105",
                  isGradient
                    ? "border-primary/30 bg-primary/20 text-primary backdrop-blur-sm"
                    : "border-primary/15 bg-secondary text-primary"
                )}
              >
                <Icon className="h-5 w-5 text-primary" />
              </div>
            ) : null}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{title}</h1>
                {badge && <div className="shrink-0">{badge}</div>}
              </div>
              {subtitle ? (
                <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
              ) : null}
            </div>
          </div>

          {(rightContent || actions || clock) ? (
            <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center md:justify-end">
              {/* Live clock */}
              {clock && (
                <div className="hidden sm:flex items-center gap-2 rounded-lg border border-border/60 bg-background/60 px-3 py-1.5 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-sm font-semibold tabular-nums tracking-widest text-foreground/90">
                    {clock}
                  </span>
                </div>
              )}
              {rightContent ? <div className="w-full md:w-auto">{rightContent}</div> : null}
              {actions ? (
                <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
                  {actions}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PageHeader;
