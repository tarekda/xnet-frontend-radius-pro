import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CountUpNumber } from "@/components/viz";

export type DashboardWidgetItem = {
  key: string;
  title: string;
  value: string;
  subtitle: string;
  to: string;
  icon: React.ElementType;
  accentClass?: string;
  glowClass?: string;
};

const DashboardMiniWidget = ({
  title,
  value,
  subtitle,
  to,
  icon: Icon,
  accentClass = "text-blue-600 dark:text-blue-400",
  glowClass = "bg-blue-500",
}: {
  title: string;
  value: string;
  subtitle: string;
  to: string;
  icon: React.ElementType;
  accentClass?: string;
  glowClass?: string;
}) => {
  // Animate plain numeric values; keep formatted strings (currency, %, "…") as-is.
  const numericValue = /^[\d,]+$/.test(value.trim()) ? Number(value.replace(/,/g, "")) : null;
  return (
    <Link
      href={to}
      className="group relative block overflow-hidden rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:bg-card/80"
    >
      <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08] ${glowClass}`} />
      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{title}</span>
          <div className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${accentClass}`}>
            {numericValue !== null ? <CountUpNumber value={numericValue} /> : value}
          </div>
          <div className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</div>
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 ${accentClass}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <ArrowUpRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
    </Link>
  );
};

export default DashboardMiniWidget;
