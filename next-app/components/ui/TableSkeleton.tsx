import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type TableSkeletonProps = {
  columns?: number;
  rows?: number;
  showToolbar?: boolean;
  className?: string;
};

export default function TableSkeleton({
  columns = 5,
  rows = 6,
  showToolbar = true,
  className,
}: TableSkeletonProps) {
  return (
    <div className={cn("w-full space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm", className)}>
      {showToolbar ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-64 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-lg" />
            <Skeleton className="h-9 w-28 rounded-lg" />
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-border/60">
        <div className="grid grid-cols-12 gap-4 border-b border-border/80 bg-muted/40 px-4 py-3">
          {Array.from({ length: columns }).map((_, idx) => (
            <div
              key={idx}
              className={cn(
                idx === 0
                  ? "col-span-4"
                  : idx === 1
                  ? "col-span-3"
                  : idx === 2
                  ? "col-span-2"
                  : "col-span-1 text-right"
              )}
            >
              <Skeleton className="h-4 w-3/4 rounded" />
            </div>
          ))}
        </div>

        <div className="divide-y divide-border/40">
          {Array.from({ length: rows }).map((_, rIdx) => (
            <div
              key={rIdx}
              className="grid grid-cols-12 items-center gap-4 px-4 py-3.5 transition-colors"
            >
              <div className="col-span-4 flex items-center gap-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="space-y-1.5 min-w-0 flex-1">
                  <Skeleton className="h-4 w-3/5 rounded" />
                  <Skeleton className="h-3 w-2/5 rounded" />
                </div>
              </div>
              <div className="col-span-3">
                <Skeleton className="h-4 w-4/5 rounded" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="col-span-2">
                <Skeleton className="h-4 w-2/3 rounded" />
              </div>
              <div className="col-span-1 flex justify-end gap-1">
                <Skeleton className="h-7 w-7 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
