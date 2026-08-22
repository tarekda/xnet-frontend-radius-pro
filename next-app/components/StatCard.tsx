import type React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatCardProps = {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  /** Optional slot under the value/sublabel (e.g. sparkline). */
  footer?: React.ReactNode;
};

export default function StatCard({ label, value, sublabel, icon, onClick, className, footer }: StatCardProps) {
  return (
    <Card
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/60 bg-card/85 backdrop-blur-md shadow-xs transition-all duration-300 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1",
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
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-indigo-500 to-purple-500 opacity-60 transition-opacity duration-300 group-hover:opacity-100" />
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">{label}</div>
            <div className="mt-1 truncate text-2xl font-extrabold tabular-nums tracking-tight text-foreground">{value}</div>
            {sublabel ? <div className="mt-1 truncate text-xs font-medium text-muted-foreground">{sublabel}</div> : null}
          </div>
          {icon ? (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/15 via-indigo-500/10 to-transparent text-primary shadow-xs transition-all duration-300 group-hover:scale-110 group-hover:shadow-md group-hover:shadow-primary/20">
              {icon}
            </div>
          ) : null}
        </div>
        {footer ? <div className="mt-3.5 pt-2.5 border-t border-border/40">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}
