import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchRecentUsersAudit } from "@/api/users";

type AuditMeta = {
  actor?: { username?: string };
  targets?: unknown[];
  changed?: {
    accountStatus?: { from?: string; to?: string };
    profileId?: { from?: number | string; to?: number | string };
  };
  accountStatus?: string;
};

function formatAuditTitle(action: string, meta: AuditMeta): { title: string; detail?: string } {
  const a = String(action || "");

  const pretty =
    a === "users.resetMac"
      ? "Reset MAC"
      : a === "users.resetDailyQuota"
        ? "Reset daily quota"
        : a === "users.resetMonthlyQuota"
          ? "Reset monthly traffic"
          : a === "users.bulk.resetMac"
            ? "Bulk reset MAC"
            : a === "users.bulk.setStatus"
              ? "Bulk set user status"
              : a === "users.update"
                ? "Update user"
                : a === "users.create"
                  ? "Create user"
                  : a === "users.delete"
                    ? "Delete user"
                    : a || "Activity";

  if (a === "users.update") {
    const status = meta?.changed?.accountStatus;
    if (status?.from && status?.to && status.from !== status.to) {
      return {
        title: status.to === "suspended" ? "Suspend user" : status.to === "active" ? "Activate user" : pretty,
        detail: `${status.from} → ${status.to}`,
      };
    }
    const prof = meta?.changed?.profileId;
    if (prof?.from && prof?.to && prof.from !== prof.to) {
      return { title: "Change profile", detail: `#${prof.from} → #${prof.to}` };
    }
  }

  if (a === "users.bulk.setStatus") {
    const s = String(meta?.accountStatus ?? "");
    if (s) {
      return {
        title: s === "suspended" ? "Bulk suspend users" : s === "active" ? "Bulk activate users" : pretty,
        detail: s,
      };
    }
  }

  return { title: pretty };
}

export const AuditActivityTimeline = ({ enabled }: { enabled: boolean }) => {
  const auditQuery = useQuery({
    queryKey: ["audit", "users", "recent"],
    queryFn: () => fetchRecentUsersAudit(8),
    enabled,
    refetchInterval: 30000,
    staleTime: 10000,
  });

  const items = useMemo(() => {
    const rows = auditQuery.data ?? [];
    return rows.map((e) => {
      const meta = (e.meta ?? {}) as AuditMeta;
      const actor = meta?.actor?.username ?? "—";
      const targets = Array.isArray(meta?.targets) ? meta.targets : [];
      const primaryTarget = targets[0] ?? null;
      const action = String(e.message ?? "").replace(/^audit\./, "") || "—";
      const ts = e.timestamp ? new Date(e.timestamp) : null;
      const fmt = formatAuditTitle(action, meta);
      return { id: e.id, actor, primaryTarget, title: fmt.title, detail: fmt.detail, ts };
    });
  }, [auditQuery.data]);

  if (auditQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">Loading activity…</div>;
  }
  if (auditQuery.error) {
    return <div className="text-sm text-red-600">Failed to load activity.</div>;
  }
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">No recent user activity.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((e) => (
        <div
          key={String(e.id)}
          className="group relative rounded-lg border border-transparent p-3 transition-all duration-300 hover:border-primary/25 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 hover:shadow-md dark:hover:from-primary/10 dark:hover:to-primary/5"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              <div className="absolute inset-0 w-3 h-3 rounded-full bg-emerald-500 animate-ping opacity-75" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-semibold text-foreground transition-colors duration-300 group-hover:text-primary">
                {e.title}
              </p>
              <p className="truncate text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
                Actor: {e.actor}
                {e.primaryTarget ? ` • Target: ${String(e.primaryTarget)}` : ""}
                {e.detail ? ` • ${e.detail}` : ""}
              </p>
            </div>
            <span className="whitespace-nowrap font-mono text-xs text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
              {e.ts ? e.ts.toLocaleTimeString() : "—"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};
