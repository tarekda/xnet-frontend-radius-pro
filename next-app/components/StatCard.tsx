import type React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type AccentColor = "indigo" | "blue" | "emerald" | "violet" | "orange" | "rose" | "sky" | "amber";

const accentMap: Record<
  AccentColor,
  { bar: string; ring: string; icon: string; shadow: string }
> = {
  indigo:  { bar: "from-indigo-500 via-indigo-400 to-purple-500",  ring: "border-indigo-500/20 bg-indigo-500/10", icon: "text-indigo-600 dark:text-indigo-400", shadow: "group-hover:shadow-indigo-500/15" },
  blue:    { bar: "from-blue-500 via-sky-400 to-cyan-500",          ring: "border-blue-500/20 bg-blue-500/10",    icon: "text-blue-600 dark:text-blue-400",    shadow: "group-hover:shadow-blue-500/15"  },
  emerald: { bar: "from-emerald-500 via-teal-400 to-cyan-500",      ring: "border-emerald-500/20 bg-emerald-500/10", icon: "text-emerald-600 dark:text-emerald-400", shadow: "group-hover:shadow-emerald-500/15" },
  violet:  { bar: "from-violet-500 via-purple-400 to-fuchsia-500",  ring: "border-violet-500/20 bg-violet-500/10", icon: "text-violet-600 dark:text-violet-400", shadow: "group-hover:shadow-violet-500/15" },
  orange:  { bar: "from-orange-500 via-amber-400 to-yellow-500",    ring: "border-orange-500/20 bg-orange-500/10", icon: "text-orange-600 dark:text-orange-400", shadow: "group-hover:shadow-orange-500/15" },
  rose:    { bar: "from-rose-500 via-pink-400 to-red-500",          ring: "border-rose-500/20 bg-rose-500/10",    icon: "text-rose-600 dark:text-rose-400",    shadow: "group-hover:shadow-rose-500/15"  },
  sky:     { bar: "from-sky-500 via-blue-400 to-indigo-500",        ring: "border-sky-500/20 bg-sky-500/10",      icon: "text-sky-600 dark:text-sky-400",      shadow: "group-hover:shadow-sky-500/15"   },
  amber:   { bar: "from-amber-500 via-yellow-400 to-orange-400",    ring: "border-amber-500/20 bg-amber-500/10",  icon: "text-amber-600 dark:text-amber-400",  shadow: "group-hover:shadow-amber-500/15" },
};

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** Optional slot under the value/sublabel (e.g. sparkline). */
  footer?: React.ReactNode;
  /** Trend direction — renders a colored arrow badge below the sublabel. */
  trend?: "up" | "down" | "neutral";
  /** Human-readable trend context, e.g. "+12% vs last week" */
  trendLabel?: string;
  /** Accent color token — controls top bar, icon ring, and hover shadow. Default: "indigo" */
  accentColor?: AccentColor;
};

const TrendBadge = ({ trend, label }: { trend: "up" | "down" | "neutral"; label?: string }) => {
  if (trend === "up") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        <TrendingUp className="h-3 w-3" />
        {label}
      </span>
    );
  }
  if (trend === "down") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
        <TrendingDown className="h-3 w-3" />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-muted-foreground">
      <Minus className="h-3 w-3" />
      {label}
    </span>
  );
};

export default function StatCard({
  label,
  value,
  sublabel,
  icon,
  onClick,
  className,
  footer,
  trend,
  trendLabel,
  accentColor = "indigo",
}: StatCardProps) {
  const accent = accentMap[accentColor] ?? accentMap.indigo;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-xs card-hover-lift",
        "transition-all duration-300 hover:border-primary/40 hover:shadow-xl",
        accent.shadow,
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {/* Animated top accent bar */}
      <div className={cn("absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-70 transition-opacity duration-300 group-hover:opacity-100", accent.bar)} />

      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</div>
            <div className="mt-1 truncate text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</div>
            {sublabel ? <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{sublabel}</div> : null}
            {trend && (
              <div className="mt-1.5">
                <TrendBadge trend={trend} label={trendLabel} />
              </div>
            )}
          </div>
          {icon ? (
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-xs transition-all duration-300 group-hover:scale-110 group-hover:shadow-md",
                accent.ring,
                accent.icon
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
        {footer ? <div className="mt-3.5 pt-2.5 border-t border-border/40">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
