import React, { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, Download, RefreshCw, Server } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import QueryState from "@/components/QueryState";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";

type BackupKind = "db" | "mikrotik-export";
type BackupMeta = {
  id: string;
  kind: BackupKind;
  status?: "running" | "success" | "failed";
  createdAt: string;
  finishedAt?: string;
  filename: string;
  sizeBytes: number;
  details?: Record<string, any>;
  error?: string;
};

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let b = bytes;
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  return `${b.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

async function downloadBlob(filename: string, blob: Blob) {
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
    // Some browsers can produce 0-byte downloads if we revoke immediately.
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
}

const Backups: React.FC = () => {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canManage = useMemo(() => can(user, "admin.access.manage"), [user]);

  const [mikrotikHost, setMikrotikHost] = useState<string>("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const backupsQuery = useQuery({
    queryKey: ["backups"],
    queryFn: async () => {
      const resp = await apiClient.get("/backups", { params: { limit: 50 } });
      return (resp?.data?.data?.backups ?? []) as BackupMeta[];
    },
    refetchInterval: (q) => {
      const data = q.state.data as BackupMeta[] | undefined;
      const hasRunning = Array.isArray(data) && data.some((b) => b.status === "running");
      return hasRunning ? 5000 : false;
    },
  });

  const runDbBackupMutation = useMutation({
    mutationFn: async () => {
      const resp = await apiClient.post("/backups/db");
      return resp?.data?.data as BackupMeta;
    },
    onSuccess: async () => {
      await backupsQuery.refetch();
      notify.success("Backup started", "Database backup is running in the background.");
    },
    onError: (e: any) => notify.error("Backup failed", e?.message || "Database backup failed"),
  });

  const runMikrotikBackupMutation = useMutation({
    mutationFn: async () => {
      const body = mikrotikHost.trim().length ? { host: mikrotikHost.trim() } : {};
      const resp = await apiClient.post("/backups/mikrotik", body);
      return resp?.data?.data as BackupMeta;
    },
    onSuccess: async () => {
      await backupsQuery.refetch();
      notify.success("Backup created", "MikroTik export backup completed.");
    },
    onError: (e: any) => notify.error("Backup failed", e?.message || "MikroTik backup failed"),
  });

  const downloadMutation = useMutation({
    onMutate: async (b: BackupMeta) => {
      setDownloadingId(b.id);
      notify.info("Download started", "Downloading backup… this can take a while for large files.");
      return { id: b.id };
    },
    mutationFn: async (b: BackupMeta) => {
      const resp = await apiClient.get(`/backups/${encodeURIComponent(b.id)}/download`, { responseType: "blob" });
      const blob = resp.data as Blob;
      if (blob && typeof (blob as any).size === "number" && blob.size === 0) {
        throw new Error("Downloaded file is empty (0 bytes). Check MikroTik export credentials/permissions.");
      }
      await downloadBlob(b.filename, blob);
    },
    onError: (e: any) => notify.error("Download failed", e?.message || "Failed to download backup"),
    onSettled: () => setDownloadingId(null),
  });

  const backups = backupsQuery.data ?? [];

  if (!canManage) {
    return (
      <div className="w-full py-6 space-y-6">
        <PageHeader title={t("backups.title")} subtitle={t("backups.subtitle_forbidden")} icon={Database} />
      </div>
    );
  }

  return (
    <div className="w-full py-6 space-y-6">
      <PageHeader
        title={t("backups.title")}
        subtitle={t("backups.subtitle")}
        icon={Database}
        actions={(
          <IconActionButton
            label={backupsQuery.isFetching ? "Refreshing..." : "Refresh"}
            onClick={() => backupsQuery.refetch()}
            disabled={backupsQuery.isLoading}
            icon={<RefreshCw className={`h-4 w-4 ${backupsQuery.isFetching ? "animate-spin" : ""}`} />}
          />
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Creates a compressed `mysqldump` on the Windows host and stores it in the backend `backups/` folder.
            </div>
            <Button
              onClick={() => runDbBackupMutation.mutate()}
              disabled={runDbBackupMutation.isPending}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${runDbBackupMutation.isPending ? "animate-spin" : ""}`} />
              Run DB backup
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              MikroTik backup (export)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="mikrotikHost">Router IP/host (optional)</Label>
              <Input
                id="mikrotikHost"
                value={mikrotikHost}
                onChange={(e) => setMikrotikHost(e.target.value)}
                placeholder="Leave blank to use backend MIKROTIK_IP"
              />
            </div>
            <Button
              onClick={() => runMikrotikBackupMutation.mutate()}
              disabled={runMikrotikBackupMutation.isPending}
              className="w-full sm:w-auto"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${runMikrotikBackupMutation.isPending ? "animate-spin" : ""}`} />
              Run MikroTik export
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent backups</CardTitle>
        </CardHeader>
        <CardContent>
          <QueryState
            isLoading={backupsQuery.isLoading}
            error={backupsQuery.error as any}
            isEmpty={backups.length === 0}
            onRetry={() => backupsQuery.refetch()}
            emptyTitle="No backups yet"
            emptyDescription="Run a backup above to generate your first file."
          >
            <div className="space-y-2">
              {backups.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{b.filename}</div>
                    <div className="text-xs text-muted-foreground">
                      {b.kind}
                      {b.status ? ` • ${b.status}` : ""}
                      {" • "}
                      {formatBytes(b.sizeBytes)}
                      {" • "}
                      {new Date(b.createdAt).toLocaleString()}
                      {b.status === "failed" && b.error ? ` • ${b.error}` : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => downloadMutation.mutate(b)}
                    disabled={
                      (downloadMutation.isPending && downloadingId === b.id) ||
                      b.status === "running" ||
                      b.status === "failed"
                    }
                    className="shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {downloadMutation.isPending && downloadingId === b.id ? "Downloading…" : "Download"}
                  </Button>
                </div>
              ))}
            </div>
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backups;

