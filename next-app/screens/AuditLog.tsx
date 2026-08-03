"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2, RefreshCw, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { formatAuditTitle, type AuditLogRow } from "@/screens/dashboard/dashboardShared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type AuditFilters = {
  actorUsername: string;
  targetUsername: string;
  actionPrefix: string;
  from: string;
  to: string;
};

const EMPTY_FILTERS: AuditFilters = {
  actorUsername: "",
  targetUsername: "",
  actionPrefix: "",
  from: "",
  to: "",
};

async function fetchAudit(filters: AuditFilters): Promise<AuditLogRow[]> {
  const { data } = await apiClient.get("/audit", {
    params: {
      limit: 500,
      actorUsername: filters.actorUsername || undefined,
      targetUsername: filters.targetUsername || undefined,
      actionPrefix: filters.actionPrefix || undefined,
      from: filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : undefined,
      to: filters.to ? new Date(`${filters.to}T23:59:59.999`).toISOString() : undefined,
    },
  });
  return Array.isArray(data?.data) ? data.data : [];
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function AuditLogPage() {
  const { user } = useAuth();
  const hasAccess = can(user, "users.view");
  const [draft, setDraft] = useState<AuditFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<AuditFilters>(EMPTY_FILTERS);

  const query = useQuery({
    queryKey: ["audit", "global", filters],
    queryFn: () => fetchAudit(filters),
    enabled: hasAccess,
  });

  const rows = useMemo(
    () =>
      (query.data ?? []).map((entry) => {
        const meta = entry.meta && typeof entry.meta === "object" ? entry.meta : {};
        const actor = String(meta?.actor?.username ?? "system");
        const targets: string[] = Array.isArray(meta?.targets)
          ? meta.targets.map(String)
          : meta?.target?.username
            ? [String(meta.target.username)]
            : [];
        const action = String(entry.message ?? "").replace(/^audit\./, "") || "unknown";
        const formatted = formatAuditTitle(action, meta);
        return { entry, actor, targets, action, ...formatted };
      }),
    [query.data]
  );

  const applyFilters = (event?: FormEvent) => {
    event?.preventDefault();
    setFilters({
      actorUsername: draft.actorUsername.trim(),
      targetUsername: draft.targetUsername.trim(),
      actionPrefix: draft.actionPrefix.trim().replace(/^audit\./, ""),
      from: draft.from,
      to: draft.to,
    });
  };

  if (!hasAccess) {
    return (
      <div className="w-full space-y-6 p-6">
        <PageHeader title="Audit log" subtitle="Administrative activity and accountability" icon={History} />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You do not have permission to view the audit log.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        title="Audit log"
        subtitle="Search administrative actions by actor, customer, action, or date"
        icon={History}
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Results are ordered newest first and limited to the latest 500 matching events.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="audit-actor">Actor</Label>
              <Input
                id="audit-actor"
                value={draft.actorUsername}
                onChange={(e) => setDraft((current) => ({ ...current, actorUsername: e.target.value }))}
                placeholder="Staff username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-target">Customer</Label>
              <Input
                id="audit-target"
                value={draft.targetUsername}
                onChange={(e) => setDraft((current) => ({ ...current, targetUsername: e.target.value }))}
                placeholder="RADIUS username"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-action">Action prefix</Label>
              <Input
                id="audit-action"
                value={draft.actionPrefix}
                onChange={(e) => setDraft((current) => ({ ...current, actionPrefix: e.target.value }))}
                placeholder="users.bulk."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                type="date"
                value={draft.from}
                onChange={(e) => setDraft((current) => ({ ...current, from: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                type="date"
                value={draft.to}
                onChange={(e) => setDraft((current) => ({ ...current, to: e.target.value }))}
              />
            </div>
            <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
              <Button type="submit">
                <Search className="h-4 w-4" />
                Search
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY_FILTERS);
                  setFilters(EMPTY_FILTERS);
                }}
              >
                Clear
              </Button>
              <Button type="button" variant="ghost" onClick={() => query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>{query.isLoading ? "Loading…" : `${rows.length.toLocaleString()} matching events`}</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading audit events…
            </div>
          ) : query.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              Failed to load audit events.
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No audit events match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[900px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map(({ entry, actor, targets, action, title, detail }) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </TableCell>
                      <TableCell className="font-medium">{actor}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono font-normal">
                          {action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {targets.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {targets.slice(0, 3).map((target) => (
                              <Button key={target} variant="link" size="sm" className="h-auto p-0" asChild>
                                <Link href={`/users/${encodeURIComponent(target)}`}>{target}</Link>
                              </Button>
                            ))}
                            {targets.length > 3 ? <Badge variant="secondary">+{targets.length - 3}</Badge> : null}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-[360px]">
                        <div className="font-medium">{title}</div>
                        {detail ? <div className="truncate text-xs text-muted-foreground">{detail}</div> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
