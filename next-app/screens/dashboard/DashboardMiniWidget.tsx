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
      className="group relative block min-w-0 overflow-hidden rounded-lg border border-border bg-card p-3.5 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="absolute inset-y-0 left-0 w-0.5 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{title}</span>
          <div className="mt-1.5 truncate text-xl font-semibold tabular-nums tracking-tight text-foreground sm:text-2xl">
            {numericValue !== null ? <CountUpNumber value={numericValue} /> : value}
          </div>
          <div className="mt-1 truncate text-[11px] leading-4 text-muted-foreground">{subtitle}</div>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/5 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <ArrowUpRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-primary" />
    </Link>
  );
};

export default DashboardMiniWidget;
