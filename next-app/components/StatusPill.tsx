import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  default:
    "border-border/80 bg-secondary/50 text-foreground dark:bg-secondary/30 backdrop-blur-xs",
  success:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 backdrop-blur-xs shadow-2xs shadow-emerald-500/10",
  warning:
    "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-300 backdrop-blur-xs shadow-2xs shadow-amber-500/10",
  danger:
    "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-300 backdrop-blur-xs shadow-2xs shadow-rose-500/10",
  info:
    "border-indigo-500/30 bg-indigo-500/10 text-indigo-800 dark:text-indigo-300 backdrop-blur-xs shadow-2xs shadow-indigo-500/10",
};

export default function StatusPill(props: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  pulseDot?: boolean;
  className?: string;
}) {
  const { label, tone = "default", dot = false, pulseDot = false, className } = props;

  return (
    <Badge
      variant="outline"
      className={cn("relative gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight transition-all duration-200 hover:scale-105", toneClasses[tone], className)}
    >
      {dot ? (
        <span
          className={cn(
            "relative inline-block h-1.5 w-1.5 rounded-full shrink-0",
            tone === "success" && "bg-emerald-500 text-emerald-500",
            tone === "warning" && "bg-amber-500 text-amber-500",
            tone === "danger" && "bg-rose-500 text-rose-500",
            tone === "info" && "bg-indigo-500 text-indigo-500",
            tone === "default" && "bg-muted-foreground/60 text-muted-foreground",
            pulseDot && "status-dot-pulse"
          )}
        />
      ) : null}
      <span className="whitespace-nowrap">{label}</span>
    </Badge>
  );
}

