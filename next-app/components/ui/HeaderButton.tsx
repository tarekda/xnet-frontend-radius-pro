import React from "react";
import { ArrowUpDown } from "lucide-react";
import { Button } from "./button";

/** Sortable column header control (avoids React.FC typing issues across React 18/19). */
export function HeaderButton({
  column,
  children,
  className,
}: {
  column: unknown;
  children: React.ReactNode;
  className?: string;
}) {
  const col = column as { toggleSorting: (asc: boolean) => void; getIsSorted: () => string | false };
  return (
    <Button
      variant="ghost"
      onClick={() => col.toggleSorting(col.getIsSorted() === "asc")}
      className={`h-8 w-full justify-start p-0! text-[11px] font-semibold uppercase tracking-wide hover:bg-transparent hover:text-foreground ${className ?? ""} `}
    >
      {children}
      <ArrowUpDown className="ml-1 h-3.5 w-3.5 opacity-60" />
    </Button>
  );
}
