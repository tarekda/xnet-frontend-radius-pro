import React from "react";
import { cn } from "@/lib/utils";
import { LayoutGrid, Rows3 } from "lucide-react";
import IconActionButton from "@/components/IconActionButton";

type Density = "comfortable" | "compact";

function readDensity(storageKey: string, defaultValue: Density): Density {
  try {
    const v = localStorage.getItem(storageKey);
    if (v === "compact" || v === "comfortable") return v;
  } catch {}
  return defaultValue;
}

function writeDensity(storageKey: string, value: Density) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {}
}

function applyDensityToRoot(value: Density) {
  const root = document.documentElement;
  if (value === "compact") root.classList.add("table-compact");
  else root.classList.remove("table-compact");
}

type Props = {
  /** Left-side label, e.g. "25 users" */
  label: string;
  /** Persist density across the app; default "ui.tableDensity" */
  densityStorageKey?: string;
  /** Default density if nothing stored */
  defaultDensity?: Density;
  /** Optional extra actions (export, columns...) */
  right?: React.ReactNode;
  className?: string;
};

export default function TableToolbar({
  label,
  densityStorageKey = "ui.tableDensity",
  defaultDensity = "comfortable",
  right,
  className,
}: Props) {
  const [density, setDensity] = React.useState<Density>(() => readDensity(densityStorageKey, defaultDensity));

  React.useEffect(() => {
    applyDensityToRoot(density);
    writeDensity(densityStorageKey, density);
  }, [density, densityStorageKey]);

  return (
    <div
      className={cn(
        "flex flex-col gap-2 border-b border-border/80 bg-card px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="min-w-0 break-words text-xs font-medium text-muted-foreground">{label}</div>
      <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
        {right}
        <IconActionButton
          label={`Density: ${density === "compact" ? "Compact" : "Comfortable"}`}
          onClick={() => setDensity((d) => (d === "compact" ? "comfortable" : "compact"))}
          icon={density === "compact" ? <Rows3 className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        />
      </div>
    </div>
  );
}

