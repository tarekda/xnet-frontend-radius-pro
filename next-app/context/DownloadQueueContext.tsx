"use client";

import React, { createContext, useContext, useRef, useState, useCallback } from "react";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";

export type DownloadStatus = "queued" | "downloading" | "completed" | "failed" | "cancelled";

export interface DownloadItem {
  id: string;
  backupId: string;
  filename: string;
  kind: "db" | "mikrotik-export" | "generic";
  status: DownloadStatus;
  progress: number; // 0 to 100
  loadedBytes: number;
  totalBytes: number;
  speedBytesPerSec: number;
  startedAt: number;
  finishedAt?: number;
  error?: string;
  downloadUrl: string;
}

export interface EnqueueOptions {
  backupId: string;
  filename: string;
  kind?: "db" | "mikrotik-export" | "generic";
  sizeBytes?: number;
  downloadUrl?: string;
}

interface DownloadQueueContextType {
  items: DownloadItem[];
  activeCount: number;
  isDockOpen: boolean;
  setIsDockOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  enqueueDownload: (options: EnqueueOptions) => string;
  cancelDownload: (id: string) => void;
  retryDownload: (id: string) => void;
  clearCompleted: () => void;
  removeDownload: (id: string) => void;
}

const DownloadQueueContext = createContext<DownloadQueueContextType | undefined>(undefined);

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export const DownloadQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [isDockOpen, setIsDockOpen] = useState<boolean>(false);
  const activeControllers = useRef<Map<string, AbortController>>(new Map());
  const storedBlobs = useRef<Map<string, Blob>>(new Map());

  // Request browser notification permissions on first user action
  const requestNotificationPermission = useCallback(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, []);

  const sendBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        try {
          new Notification(title, {
            body,
            icon: "/favicon.ico",
          });
        } catch {}
      }
    }
  }, []);

  const startDownload = useCallback(
    async (item: DownloadItem) => {
      const controller = new AbortController();
      activeControllers.current.set(item.id, controller);

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? { ...it, status: "downloading", startedAt: Date.now(), error: undefined }
            : it
        )
      );

      let lastLoaded = 0;
      let lastTime = Date.now();

      try {
        const resp = await apiClient.get(item.downloadUrl, {
          responseType: "blob",
          signal: controller.signal,
          onDownloadProgress: (progressEvent) => {
            const now = Date.now();
            const timeDelta = (now - lastTime) / 1000;
            const loaded = progressEvent.loaded || 0;
            const total = progressEvent.total || item.totalBytes || 0;

            let speed = 0;
            if (timeDelta > 0.3) {
              speed = Math.max(0, (loaded - lastLoaded) / timeDelta);
              lastLoaded = loaded;
              lastTime = now;
            }

            const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;

            setItems((prev) =>
              prev.map((it) =>
                it.id === item.id
                  ? {
                      ...it,
                      progress: pct,
                      loadedBytes: loaded,
                      totalBytes: total > 0 ? total : it.totalBytes,
                      speedBytesPerSec: speed > 0 ? speed : it.speedBytesPerSec,
                    }
                  : it
              )
            );
          },
        });

        const blob = resp.data as Blob;
        if (blob && typeof (blob as any).size === "number" && blob.size === 0) {
          throw new Error("Downloaded file is empty (0 bytes).");
        }

        storedBlobs.current.set(item.id, blob);
        downloadBlob(item.filename, blob);

        setItems((prev) =>
          prev.map((it) =>
            it.id === item.id
              ? {
                  ...it,
                  status: "completed",
                  progress: 100,
                  loadedBytes: blob.size || it.loadedBytes,
                  totalBytes: blob.size || it.totalBytes,
                  finishedAt: Date.now(),
                  speedBytesPerSec: 0,
                }
              : it
          )
        );

        notify.success(
          "Download Complete",
          `${item.filename} has finished downloading (${formatBytes(blob.size || item.totalBytes)}).`
        );
        sendBrowserNotification(
          "Backup Download Complete",
          `${item.filename} has finished downloading (${formatBytes(blob.size || item.totalBytes)}).`
        );
      } catch (err: any) {
        if (controller.signal.aborted) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, status: "cancelled", speedBytesPerSec: 0 } : it
            )
          );
        } else {
          const errMsg = err?.response?.data?.message || err?.message || "Download failed";
          setItems((prev) =>
            prev.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: "failed",
                    error: String(errMsg),
                    speedBytesPerSec: 0,
                  }
                : it
            )
          );
          notify.error("Download Failed", `${item.filename}: ${errMsg}`);
        }
      } finally {
        activeControllers.current.delete(item.id);
      }
    },
    [sendBrowserNotification]
  );

  const enqueueDownload = useCallback(
    (options: EnqueueOptions) => {
      requestNotificationPermission();
      const id = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const downloadUrl =
        options.downloadUrl || `/backups/${encodeURIComponent(options.backupId)}/download`;

      const newItem: DownloadItem = {
        id,
        backupId: options.backupId,
        filename: options.filename,
        kind: options.kind || "db",
        status: "queued",
        progress: 0,
        loadedBytes: 0,
        totalBytes: options.sizeBytes || 0,
        speedBytesPerSec: 0,
        startedAt: Date.now(),
        downloadUrl,
      };

      setItems((prev) => [newItem, ...prev]);
      setIsDockOpen(true);
      notify.info("Download Queued", `"${options.filename}" added to background download queue.`);

      // Start immediately
      setTimeout(() => {
        startDownload(newItem);
      }, 50);

      return id;
    },
    [requestNotificationPermission, startDownload]
  );

  const cancelDownload = useCallback((id: string) => {
    const controller = activeControllers.current.get(id);
    if (controller) {
      controller.abort();
      activeControllers.current.delete(id);
    }
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, status: "cancelled", speedBytesPerSec: 0 } : it
      )
    );
    notify.info("Download Cancelled", "The download was cancelled.");
  }, []);

  const retryDownload = useCallback(
    (id: string) => {
      const item = items.find((it) => it.id === id);
      if (!item) return;
      startDownload(item);
    },
    [items, startDownload]
  );

  const clearCompleted = useCallback(() => {
    setItems((prev) => prev.filter((it) => it.status === "downloading" || it.status === "queued"));
  }, []);

  const removeDownload = useCallback((id: string) => {
    const controller = activeControllers.current.get(id);
    if (controller) {
      controller.abort();
      activeControllers.current.delete(id);
    }
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const activeCount = items.filter(
    (it) => it.status === "downloading" || it.status === "queued"
  ).length;

  return (
    <DownloadQueueContext.Provider
      value={{
        items,
        activeCount,
        isDockOpen,
        setIsDockOpen,
        enqueueDownload,
        cancelDownload,
        retryDownload,
        clearCompleted,
        removeDownload,
      }}
    >
      {children}
    </DownloadQueueContext.Provider>
  );
};

export const useDownloadQueue = () => {
  const context = useContext(DownloadQueueContext);
  if (!context) {
    throw new Error("useDownloadQueue must be used within a DownloadQueueProvider");
  }
  return context;
};
