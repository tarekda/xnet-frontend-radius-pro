"use client";

import React, { useMemo } from "react";
import {
  useDownloadQueue,
  formatBytes,
  DownloadItem,
} from "@/context/DownloadQueueContext";
import {
  Database,
  Server,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCw,
  ChevronDown,
  ChevronUp,
  Trash2,
  Loader2,
  HardDriveDownload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getItemIcon(kind: DownloadItem["kind"]) {
  switch (kind) {
    case "db":
      return <Database className="h-4 w-4 text-primary shrink-0" />;
    case "mikrotik-export":
      return <Server className="h-4 w-4 text-indigo-400 shrink-0" />;
    default:
      return <FileText className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

export const DownloadQueueDock: React.FC = () => {
  const {
    items,
    activeCount,
    isDockOpen,
    setIsDockOpen,
    cancelDownload,
    retryDownload,
    clearCompleted,
    removeDownload,
  } = useDownloadQueue();

  const totalProgress = useMemo(() => {
    const active = items.filter(
      (it) => it.status === "downloading" || it.status === "queued"
    );
    if (active.length === 0) return 100;
    const sum = active.reduce((acc, it) => acc + it.progress, 0);
    return Math.round(sum / active.length);
  }, [items]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 max-w-[calc(100vw-2rem)] pointer-events-none">
      {/* Minimized Dock Button */}
      {!isDockOpen && (
        <button
          type="button"
          onClick={() => setIsDockOpen(true)}
          className={cn(
            "pointer-events-auto flex items-center gap-3 px-4 py-2.5 rounded-full shadow-2xl transition-all duration-300",
            "bg-card/95 backdrop-blur-md border border-border/80 text-card-foreground",
            "hover:scale-[1.03] hover:border-primary/50 hover:shadow-primary/20",
            activeCount > 0 && "ring-2 ring-primary/40 ring-offset-2 ring-offset-background"
          )}
        >
          <div className="relative flex items-center justify-center">
            {activeCount > 0 ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            )}
            {activeCount > 0 && (
              <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {activeCount}
              </span>
            )}
          </div>

          <div className="text-left text-xs">
            <div className="font-semibold flex items-center gap-1.5">
              <span>{activeCount > 0 ? `Downloading (${activeCount})` : "Downloads"}</span>
              {activeCount > 0 && <span className="font-mono text-primary">{totalProgress}%</span>}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {activeCount > 0
                ? `${items.find((i) => i.status === "downloading")?.filename || "In progress…"}`
                : `${items.length} ${items.length === 1 ? "file" : "files"} ready`}
            </div>
          </div>

          <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
        </button>
      )}

      {/* Expanded Dock Panel */}
      {isDockOpen && (
        <div
          className={cn(
            "pointer-events-auto w-[380px] max-w-full rounded-2xl border border-border/80 shadow-2xl",
            "bg-card/95 backdrop-blur-xl text-card-foreground flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-2">
              <HardDriveDownload className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Download Queue</span>
              {activeCount > 0 ? (
                <span className="rounded-full bg-primary/15 text-primary border border-primary/30 px-2 py-0.5 text-[11px] font-bold">
                  {activeCount} active
                </span>
              ) : (
                <span className="rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-medium">
                  Done
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {items.some((i) => i.status === "completed" || i.status === "failed" || i.status === "cancelled") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearCompleted}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="Clear finished downloads"
                >
                  Clear
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDockOpen(false)}
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                title="Minimize"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List of items */}
          <div className="max-h-[320px] overflow-y-auto divide-y divide-border/40 p-2 space-y-1">
            {items.map((item) => {
              const isDownloading = item.status === "downloading";
              const isQueued = item.status === "queued";
              const isCompleted = item.status === "completed";
              const isFailed = item.status === "failed";
              const isCancelled = item.status === "cancelled";

              return (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl transition-colors hover:bg-muted/30 flex flex-col gap-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {getItemIcon(item.kind)}
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate leading-tight" title={item.filename}>
                          {item.filename}
                        </div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          {isDownloading && (
                            <>
                              <span className="text-primary font-medium">{item.progress}%</span>
                              <span>•</span>
                              <span>
                                {formatBytes(item.loadedBytes)}
                                {item.totalBytes > 0 ? ` / ${formatBytes(item.totalBytes)}` : ""}
                              </span>
                              {item.speedBytesPerSec > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{formatBytes(item.speedBytesPerSec)}/s</span>
                                </>
                              )}
                            </>
                          )}
                          {isQueued && <span>Waiting in queue…</span>}
                          {isCompleted && (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Downloaded ({formatBytes(item.loadedBytes || item.totalBytes)})
                            </span>
                          )}
                          {isFailed && (
                            <span className="text-destructive font-medium flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" />
                              {item.error || "Failed"}
                            </span>
                          )}
                          {isCancelled && <span className="text-muted-foreground">Cancelled</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isDownloading && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancelDownload(item.id)}
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                          title="Cancel download"
                        >
                          Cancel
                        </Button>
                      )}
                      {(isFailed || isCancelled) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryDownload(item.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Retry"
                        >
                          <RotateCw className="h-3 w-3" />
                        </Button>
                      )}
                      {(isCompleted || isFailed || isCancelled) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDownload(item.id)}
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          title="Remove from queue"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Progress bar */}
                  {(isDownloading || isQueued) && (
                    <div className="w-full bg-muted/70 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-primary to-indigo-500 h-full rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${Math.max(4, item.progress)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
