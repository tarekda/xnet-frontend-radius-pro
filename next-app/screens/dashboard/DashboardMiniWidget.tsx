import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
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
  accentClass,
  glowClass,
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
      className="group relative block min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/85 p-3.5 glass-card card-hover-lift transition-all duration-200 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {/* Left accent bar — uses widget accent color */}
      <div className={cn(
        "absolute inset-y-0 left-0 w-[3px] rounded-r-full opacity-0 transition-opacity duration-300 group-hover:opacity-100",
        glowClass ?? "bg-primary"
      )} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</span>
          <div className="mt-1.5 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
            {numericValue !== null ? <CountUpNumber value={numericValue} /> : value}
          </div>
          <div className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">{subtitle}</div>
        </div>
        <div className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-110",
          accentClass
            ? `${accentClass} border-current/15 bg-current/8`
            : "border-primary/15 bg-primary/5 text-primary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <ArrowUpRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-all duration-200 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
};

export default DashboardMiniWidget;
