import React from "react";
import { cn } from "@/lib/utils";

type Props = {
  left: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
};

/**
 * Standard responsive layout for page/table filters:
 * - stacks on mobile, aligns left/right on desktop
 * - normalizes control sizing (buttons/inputs) for a consistent UI
 */
export default function FiltersBar({ left, right, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-[var(--shop-shadow)] md:flex-row md:items-center md:justify-between",
        // Normalize input sizing inside filter bars (buttons vary: icon-only vs text)
        "[&_input]:h-9 [&_input]:text-sm",
        className
      )}
    >
      <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">{left}</div>
      {right ? <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row md:items-center">{right}</div> : null}
    </div>
  );
}

