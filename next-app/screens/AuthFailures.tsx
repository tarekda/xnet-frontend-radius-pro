import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, Download, ExternalLink, Filter, Loader2, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";
import TablePager from "@/components/TablePager";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ALERT_METRICS } from "@/types/alerts";
import TableRowActions, { type TableRowAction } from "@/components/TableRowActions";
import SavedViews from "@/components/SavedViews";
import type { SavedViewState } from "@/lib/savedViews";
import FilterPills from "@/components/FilterPills";

type AuthFailureRow = {
  id: number;
  timestamp: string;
  username: string | null;
  nasIp: string | null;
  macAddress: string | null;
  status: string | null;
};

type AuthFailuresResponse = {
  rows: AuthFailureRow[];
  total: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  summary?: {
    topUsers: Array<{ username: string; count: number }>;
    topNas: Array<{ nasIp: string; count: number }>;
  };
};

function toDateTimeLocalValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export default function AuthFailuresPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const router = useRouter();
  const canOpenUsers = canAny(user, ["users.view", "reseller.users.view"]);
  const canManageAlerts = can(user, "admin.alerts.view");

  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const defaultTo = toDateTimeLocalValue(now);
  const defaultFrom = toDateTimeLocalValue(new Date(now.getTime() - 60 * 60 * 1000));

  const [from, setFrom] = useState(searchParams.get("from") || defaultFrom);
  const [to, setTo] = useState(searchParams.get("to") || defaultTo);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [page, setPage] = useState(() => {
    const n = Number(searchParams.get("page") || 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const n = Number(searchParams.get("pageSize") || 50);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
  });

  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [appliedQuery, setAppliedQuery] = useState(query);
  const [appliedStatus, setAppliedStatus] = useState(status);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [ruleDraft, setRuleDraft] = useState<null | {
    source: "user" | "nas";
    value: string;
    threshold: string;
    duration: string;
    severity: "low" | "medium" | "high" | "critical";
  }>(null);
  const authFailuresSavedViewsKeys = useMemo(() => ["from", "to", "q", "status", "pageSize"], []);

  const fetchFailuresPage = async (targetPage: number, targetPageSize: number): Promise<AuthFailuresResponse> => {
    const fromIso = new Date(appliedFrom).toISOString();
    const toIso = new Date(appliedTo).toISOString();
    const resp = await apiClient.get("/auth-failures", {
      params: {
        from: fromIso,
        to: toIso,
        q: appliedQuery || undefined,
        status: appliedStatus !== "all" ? appliedStatus : undefined,
        page: targetPage,
        pageSize: targetPageSize,
      },
    });
    return (resp?.data?.data ?? {
      rows: [],
      total: 0,
      totalPages: 1,
      currentPage: targetPage,
      pageSize: targetPageSize,
    }) as AuthFailuresResponse;
  };

  const authFailuresQuery = useQuery({
    queryKey: ["auth-failures-page", appliedFrom, appliedTo, appliedQuery, appliedStatus, page, pageSize],
    queryFn: async () => {
      return fetchFailuresPage(page, pageSize);
    },
    enabled: Boolean(appliedFrom && appliedTo),
  });

  const createAlertRuleMutation = useMutation({
    mutationFn: async (payload: {
      source: "user" | "nas";
      value: string;
      threshold: number;
      duration: number;
      severity: "low" | "medium" | "high" | "critical";
    }) => {
      const metric = ALERT_METRICS.find((m) => m.type === "auth_failed_attempts");
      if (!metric) throw new Error("auth_failed_attempts metric is not configured");
      const scopeLabel = payload.source === "user" ? `user ${payload.value}` : `NAS ${payload.value}`;
      const body = {
        name: `Auth failures spike - ${scopeLabel}`,
        description: `Auto-created from Auth Failures investigation for ${scopeLabel}.`,
        metric,
        condition: "greater_than",
        threshold: payload.threshold,
        duration: payload.duration,
        severity: payload.severity,
        enabled: true,
      };
      const resp = await apiClient.post("/alerts/rules", body);
      return resp?.data?.data;
    },
    onSuccess: () => {
      notify.success("Rule created", "Alert rule created. You can review it in Alerts.");
      setRuleDraft(null);
    },
    onError: (e: any) => {
      notify.error("Create failed", e?.message || "Could not create alert rule.");
    },
  });

  const rows = authFailuresQuery.data?.rows ?? [];
  const total = authFailuresQuery.data?.total ?? 0;
  const totalPages = authFailuresQuery.data?.totalPages ?? 1;
  const topUsers = authFailuresQuery.data?.summary?.topUsers ?? [];
  const topNas = authFailuresQuery.data?.summary?.topNas ?? [];

  const stats = useMemo(() => {
    const users = new Set<string>();
    const nas = new Set<string>();
    rows.forEach((r) => {
      if (r.username) users.add(r.username);
      if (r.nasIp) nas.add(r.nasIp);
    });
    return {
      total,
      uniqueUsers: users.size,
      uniqueNas: nas.size,
    };
  }, [rows, total]);

  const applyFiltersToUrl = () => {
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedQuery(query.trim());
    setAppliedStatus(status);
    setPage(1);

    const next = new URLSearchParams(searchParams);
    next.set("from", from);
    next.set("to", to);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    if (status !== "all") next.set("status", status);
    else next.delete("status");
    next.set("page", "1");
    next.set("pageSize", String(pageSize));
    setSearchParams(next);
  };

  const applyQuickRange = (preset: "1h" | "24h" | "7d") => {
    const now = new Date();
    const fromDate = new Date(now);
    if (preset === "1h") fromDate.setHours(now.getHours() - 1);
    else if (preset === "24h") fromDate.setHours(now.getHours() - 24);
    else fromDate.setDate(now.getDate() - 7);

    const nextFrom = toDateTimeLocalValue(fromDate);
    const nextTo = toDateTimeLocalValue(now);

    setFrom(nextFrom);
    setTo(nextTo);
    setAppliedFrom(nextFrom);
    setAppliedTo(nextTo);
    setAppliedQuery(query.trim());
    setAppliedStatus(status);
    setPage(1);

    const next = new URLSearchParams(searchParams);
    next.set("from", nextFrom);
    next.set("to", nextTo);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    if (status !== "all") next.set("status", status);
    else next.delete("status");
    next.set("page", "1");
    next.set("pageSize", String(pageSize));
    setSearchParams(next);
  };

  const getAuthFailuresViewState = useCallback((): SavedViewState => {
    return {
      from,
      to,
      q: query,
      status,
      pageSize: String(pageSize),
    };
  }, [from, to, query, status, pageSize]);

  const applyAuthFailuresViewState = useCallback(
    (state: SavedViewState) => {
      const nextFrom = String(state.from ?? defaultFrom);
      const nextTo = String(state.to ?? defaultTo);
      const nextQ = String(state.q ?? "");
      const nextStatusRaw = String(state.status ?? "all");
      const nextStatus = ["all", "rejected", "timeout", "error"].includes(nextStatusRaw) ? nextStatusRaw : "all";
      const parsedPageSize = Number(String(state.pageSize ?? pageSize));
      const nextPageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.floor(parsedPageSize) : pageSize;

      setFrom(nextFrom);
      setTo(nextTo);
      setQuery(nextQ);
      setStatus(nextStatus);
      setPageSize(nextPageSize);

      setAppliedFrom(nextFrom);
      setAppliedTo(nextTo);
      setAppliedQuery(nextQ.trim());
      setAppliedStatus(nextStatus);
      setPage(1);

      const next = new URLSearchParams(searchParams);
      next.set("from", nextFrom);
      next.set("to", nextTo);
      if (nextQ.trim()) next.set("q", nextQ.trim());
      else next.delete("q");
      if (nextStatus !== "all") next.set("status", nextStatus);
      else next.delete("status");
      next.set("page", "1");
      next.set("pageSize", String(nextPageSize));
      setSearchParams(next);
    },
    [defaultFrom, defaultTo, pageSize, searchParams, setSearchParams]
  );

  const exportExcel = async () => {
    const exportRows = rows.map((r) => ({
      time: r.timestamp ? new Date(r.timestamp).toLocaleString() : "",
      username: r.username ?? "",
      status: r.status ?? "",
      nasIp: r.nasIp ?? "",
      macAddress: r.macAddress ?? "",
    }));
    if (!exportRows.length) return;
    const xlsx = await import("xlsx");
    const ws = xlsx.utils.json_to_sheet(exportRows);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Auth Failures");
    const date = new Date().toISOString().slice(0, 10);
    xlsx.writeFile(wb, `auth_failures_${date}.xlsx`);
  };

  const exportAllExcel = async () => {
    try {
      setIsExportingAll(true);
      const exportPageSize = 500;
      const first = await fetchFailuresPage(1, exportPageSize);
      const allRows: AuthFailureRow[] = [...(first.rows ?? [])];
      const pages = first.totalPages ?? 1;

      for (let p = 2; p <= pages; p++) {
        const next = await fetchFailuresPage(p, exportPageSize);
        if (next.rows?.length) allRows.push(...next.rows);
      }

      if (!allRows.length) {
        notify.error("Export failed", "No rows to export.");
        return;
      }

      const exportRows = allRows.map((r) => ({
        time: r.timestamp ? new Date(r.timestamp).toLocaleString() : "",
        username: r.username ?? "",
        status: r.status ?? "",
        nasIp: r.nasIp ?? "",
        macAddress: r.macAddress ?? "",
      }));

      const xlsx = await import("xlsx");
      const ws = xlsx.utils.json_to_sheet(exportRows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Auth Failures");
      const date = new Date().toISOString().slice(0, 10);
      xlsx.writeFile(wb, `auth_failures_all_${date}.xlsx`);
      notify.success("Exported", `${exportRows.length} rows exported.`);
    } catch (e: any) {
      notify.error("Export failed", e?.message || "Unable to export all rows.");
    } finally {
      setIsExportingAll(false);
    }
  };

  const copyToClipboard = async (label: string, value: string | null) => {
    const text = String(value ?? "").trim();
    if (!text) {
      notify.error("Copy failed", `No ${label} available.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      notify.success("Copied", `${label} copied.`);
    } catch {
      notify.error("Copy failed", `Unable to copy ${label}.`);
    }
  };

  const openCreateRuleDialog = (source: "user" | "nas", value: string | null) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
      notify.error("Cannot create rule", `Missing ${source}.`);
      return;
    }
    setRuleDraft({
      source,
      value: normalized,
      threshold: source === "user" ? "10" : "25",
      duration: "5",
      severity: "high",
    });
  };

  const submitCreateRule = async () => {
    if (!ruleDraft) return;
    const threshold = Number(ruleDraft.threshold);
    const duration = Number(ruleDraft.duration);
    if (!Number.isFinite(threshold) || threshold <= 0) {
      notify.error("Invalid threshold", "Threshold must be a positive number.");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      notify.error("Invalid duration", "Duration must be a positive number.");
      return;
    }
    await createAlertRuleMutation.mutateAsync({
      source: ruleDraft.source,
      value: ruleDraft.value,
      threshold,
      duration,
      severity: ruleDraft.severity,
    });
  };

  return (
    <div className="w-full space-y-6 py-6">
      <PageHeader
        title={t("authFailures.title")}
        subtitle={t("authFailures.subtitle")}
        icon={AlertTriangle}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <IconActionButton
              label={authFailuresQuery.isFetching ? "Refreshing..." : "Refresh"}
              onClick={() => authFailuresQuery.refetch()}
              disabled={authFailuresQuery.isFetching}
              icon={<RefreshCw className={`h-4 w-4 ${authFailuresQuery.isFetching ? "animate-spin" : ""}`} />}
            />
            <IconActionButton
              label="Export Excel"
              onClick={exportExcel}
              disabled={!rows.length}
              icon={<Download className="h-4 w-4" />}
            />
            <IconActionButton
              label={isExportingAll ? "Exporting all..." : "Export All"}
              onClick={exportAllExcel}
              disabled={isExportingAll || authFailuresQuery.isFetching}
              icon={isExportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            />
          </div>
        )}
      />

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Quick ranges</span>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("1h")}>Last Hour</Button>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("24h")}>Last 24h</Button>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("7d")}>Last 7d</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <Input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="flex items-center">
              <FilterPills
                name="auth-failures-status-filter"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "all", label: "All" },
                  { value: "rejected", label: "Rejected" },
                  { value: "timeout", label: "Timeout" },
                  { value: "error", label: "Error" },
                ]}
              />
            </div>
            <Input placeholder="Search user / NAS / MAC" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <IconActionButton
              label="Apply filters"
              onClick={applyFiltersToUrl}
              variant="default"
              icon={<Filter className="h-4 w-4" />}
            />
            <SavedViews
              storageKey="savedViews:authFailures"
              keys={authFailuresSavedViewsKeys}
              getState={getAuthFailuresViewState}
              applyState={applyAuthFailuresViewState}
              compact
              onSaved={() => notify.success("View saved")}
              onDeleted={() => notify.success("View deleted")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Failures</div><div className="text-2xl font-semibold">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Affected Users</div><div className="text-2xl font-semibold">{stats.uniqueUsers}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Affected NAS</div><div className="text-2xl font-semibold">{stats.uniqueNas}</div></CardContent></Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-medium">Top Offenders - Users</div>
            {topUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">No user offenders for this filter.</div>
            ) : (
              <div className="space-y-2">
                {topUsers.map((u) => (
                  <div key={u.username} className="flex items-center justify-between rounded border p-2">
                    <div className="truncate text-sm">{u.username}</div>
                    <Badge variant="secondary">{u.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 text-sm font-medium">Top Offenders - NAS</div>
            {topNas.length === 0 ? (
              <div className="text-sm text-muted-foreground">No NAS offenders for this filter.</div>
            ) : (
              <div className="space-y-2">
                {topNas.map((n) => (
                  <div key={n.nasIp} className="flex items-center justify-between rounded border p-2">
                    <div className="truncate text-sm">{n.nasIp}</div>
                    <Badge variant="secondary">{n.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {authFailuresQuery.isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          ) : (
            <div className="max-h-[560px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left">
                    <th className="px-3 py-2">Time</th>
                    <th className="px-3 py-2">User</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">NAS</th>
                    <th className="px-3 py-2">MAC</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td className="px-3 py-6 text-muted-foreground" colSpan={6}>No failures found for this filter.</td></tr>
                  ) : (
                    rows.map((r) => (
                      <tr key={String(r.id)} className="border-t">
                        <td className="px-3 py-2 whitespace-nowrap">{r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}</td>
                        <td className="px-3 py-2">
                          {r.username && canOpenUsers ? (
                            <Link className="underline" href={`/users/${encodeURIComponent(r.username)}`}>{r.username}</Link>
                          ) : (
                            r.username || "-"
                          )}
                        </td>
                        <td className="px-3 py-2"><Badge variant="destructive">{r.status || "failed"}</Badge></td>
                        <td className="px-3 py-2">{r.nasIp || "-"}</td>
                        <td className="px-3 py-2">{r.macAddress || "-"}</td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end">
                            <TableRowActions
                              label="Actions"
                              triggerSrLabel="Open auth failure actions"
                              actions={[
                                ...(r.username && canOpenUsers
                                  ? [{
                                      label: "Open user",
                                      icon: ExternalLink,
                                      onClick: () => router.push(`/users/${encodeURIComponent(r.username as string)}`),
                                    } satisfies TableRowAction]
                                  : []),
                                ...(r.nasIp
                                  ? [{
                                      label: "Open live sessions for NAS",
                                      icon: ExternalLink,
                                      onClick: () => router.push(`/online-users?search=${encodeURIComponent(r.nasIp as string)}`),
                                    } satisfies TableRowAction]
                                  : []),
                                ...(r.username && canManageAlerts
                                  ? [{
                                      label: "Create alert rule for user",
                                      icon: AlertTriangle,
                                      onClick: () => openCreateRuleDialog("user", r.username),
                                    } satisfies TableRowAction]
                                  : []),
                                ...(r.nasIp && canManageAlerts
                                  ? [{
                                      label: "Create alert rule for NAS",
                                      icon: AlertTriangle,
                                      onClick: () => openCreateRuleDialog("nas", r.nasIp),
                                    } satisfies TableRowAction]
                                  : []),
                                {
                                  label: "Copy MAC",
                                  icon: Copy,
                                  onClick: () => copyToClipboard("MAC", r.macAddress),
                                },
                                {
                                  label: "Copy NAS",
                                  icon: Copy,
                                  onClick: () => copyToClipboard("NAS", r.nasIp),
                                },
                              ]}
                            />
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TablePager
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          const next = new URLSearchParams(searchParams);
          next.set("page", String(nextPage));
          next.set("pageSize", String(pageSize));
          setSearchParams(next);
        }}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
          const next = new URLSearchParams(searchParams);
          next.set("page", "1");
          next.set("pageSize", String(nextSize));
          setSearchParams(next);
        }}
        isDisabled={authFailuresQuery.isFetching}
        noun="failures"
      />

      <Dialog open={Boolean(ruleDraft)} onOpenChange={(open) => (open ? null : setRuleDraft(null))}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Create Alert Rule</DialogTitle>
          </DialogHeader>
          {ruleDraft ? (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Scope: <span className="font-medium text-foreground">{ruleDraft.source === "user" ? "User" : "NAS"} - {ruleDraft.value}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <Label>Threshold</Label>
                  <Input
                    type="number"
                    min="1"
                    value={ruleDraft.threshold}
                    onChange={(e) => setRuleDraft((prev) => (prev ? { ...prev, threshold: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={ruleDraft.duration}
                    onChange={(e) => setRuleDraft((prev) => (prev ? { ...prev, duration: e.target.value } : prev))}
                  />
                </div>
                <div>
                  <Label>Severity</Label>
                  <Select
                    value={ruleDraft.severity}
                    onValueChange={(v: "low" | "medium" | "high" | "critical") =>
                      setRuleDraft((prev) => (prev ? { ...prev, severity: v } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRuleDraft(null)}>
              Cancel
            </Button>
            <Button onClick={submitCreateRule} disabled={createAlertRuleMutation.isPending}>
              {createAlertRuleMutation.isPending ? "Creating..." : "Create Rule"}
            </Button>
            <Button asChild variant="ghost">
              <Link href="/alerts">Open Alerts</Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

