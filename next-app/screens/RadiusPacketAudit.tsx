"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "@/navigation/urlSearchParams";
import {
  Copy,
  Download,
  ExternalLink,
  Filter,
  Radio,
  RefreshCw,
  ScrollText,
  Server,
  Users,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { canAny } from "@/lib/permissions";
import TablePager from "@/components/TablePager";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import SavedViews from "@/components/SavedViews";
import type { SavedViewState } from "@/lib/savedViews";
import FilterPills from "@/components/FilterPills";
import StatCard from "@/components/StatCard";
import QueryState from "@/components/QueryState";
import UsernameTypeahead from "@/components/UsernameTypeahead";
import EmptyState from "@/components/EmptyState";
import { downloadTextFile, toCsv } from "@/lib/csv";
import { useRadiusPacketAudit } from "@/hooks/useRadiusPacketAudit";
import type { PacketAuditRow } from "@/api/radiusPacketAudit";

function toDateTimeLocalValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatTs(row: PacketAuditRow): string {
  if (row.tsMs) return new Date(row.tsMs).toLocaleString();
  return row.ts || "-";
}

function endpoint(ip: string, port: string): string {
  if (!ip && !port) return "-";
  if (!port || port === "-") return ip || "-";
  return `${ip}:${port}`;
}

function codeBadgeVariant(code: string): "default" | "secondary" | "destructive" | "outline" | "success" {
  const c = code.toLowerCase();
  if (c.includes("reject") || c.includes("nak")) return "destructive";
  if (c.includes("accept") || c.includes("ack") || c === "accounting-response") return "success";
  if (c.includes("coa")) return "secondary";
  return "outline";
}

const KIND_OPTIONS = [
  { value: "auth", label: "Auth (login)" },
  { value: "acct", label: "Accounting" },
  { value: "coa", label: "CoA" },
  { value: "all", label: "All packets" },
];

export default function RadiusPacketAuditPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const router = useRouter();
  const canOpenUsers = canAny(user, ["users.view", "reseller.users.view"]);
  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const defaultTo = toDateTimeLocalValue(now);
  const defaultFrom = toDateTimeLocalValue(new Date(now.getTime() - 24 * 60 * 60 * 1000));

  const [from, setFrom] = useState(searchParams.get("from") || defaultFrom);
  const [to, setTo] = useState(searchParams.get("to") || defaultTo);
  const [username, setUsername] = useState(searchParams.get("user") || "");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [dir, setDir] = useState(searchParams.get("dir") || "all");
  const [kind, setKind] = useState(searchParams.get("kind") || "auth");
  const [code, setCode] = useState(searchParams.get("code") || "all");
  const [srcIp, setSrcIp] = useState(searchParams.get("srcIp") || "");
  const [dstIp, setDstIp] = useState(searchParams.get("dstIp") || "");
  const [framed, setFramed] = useState(searchParams.get("framed") || "");
  const [mac, setMac] = useState(searchParams.get("mac") || "");
  const [nas, setNas] = useState(searchParams.get("nas") || "");
  const [page, setPage] = useState(() => {
    const n = Number(searchParams.get("page") || 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  });
  const [pageSize, setPageSize] = useState(() => {
    const n = Number(searchParams.get("pageSize") || 50);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 50;
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const [appliedFrom, setAppliedFrom] = useState(from);
  const [appliedTo, setAppliedTo] = useState(to);
  const [appliedUser, setAppliedUser] = useState(username);
  const [appliedQuery, setAppliedQuery] = useState(query);
  const [appliedDir, setAppliedDir] = useState(dir);
  const [appliedKind, setAppliedKind] = useState(kind);
  const [appliedCode, setAppliedCode] = useState(code);
  const [appliedSrcIp, setAppliedSrcIp] = useState(srcIp);
  const [appliedDstIp, setAppliedDstIp] = useState(dstIp);
  const [appliedFramed, setAppliedFramed] = useState(framed);
  const [appliedMac, setAppliedMac] = useState(mac);
  const [appliedNas, setAppliedNas] = useState(nas);

  const savedViewKeys = useMemo(
    () => ["from", "to", "user", "q", "dir", "kind", "code", "srcIp", "dstIp", "framed", "mac", "nas", "pageSize"],
    []
  );

  const auditQuery = useRadiusPacketAudit(
    {
      from: new Date(appliedFrom).toISOString(),
      to: new Date(appliedTo).toISOString(),
      user: appliedUser || undefined,
      q: appliedQuery || undefined,
      dir: appliedDir,
      kind: appliedKind,
      code: appliedCode,
      srcIp: appliedSrcIp || undefined,
      dstIp: appliedDstIp || undefined,
      framed: appliedFramed || undefined,
      mac: appliedMac || undefined,
      nas: appliedNas || undefined,
      page,
      pageSize,
    },
    Boolean(appliedFrom && appliedTo)
  );

  const rows = auditQuery.data?.rows ?? [];
  const total = auditQuery.data?.total ?? 0;
  const totalPages = auditQuery.data?.totalPages ?? 1;
  const uniqueUsers = useMemo(() => new Set(rows.map((r) => r.user).filter(Boolean)).size, [rows]);

  const applyFiltersToUrl = (overrides?: { user?: string; kind?: string }) => {
    const nextUser = overrides?.user ?? username;
    const nextKind = overrides?.kind ?? kind;
    setAppliedFrom(from);
    setAppliedTo(to);
    setAppliedUser(nextUser.trim());
    setAppliedQuery(query.trim());
    setAppliedDir(dir);
    setKind(nextKind);
    setAppliedKind(nextKind);
    setAppliedCode(code);
    setAppliedSrcIp(srcIp.trim());
    setAppliedDstIp(dstIp.trim());
    setAppliedFramed(framed.trim());
    setAppliedMac(mac.trim());
    setAppliedNas(nas.trim());
    setPage(1);

    const next = new URLSearchParams(searchParams);
    next.set("from", from);
    next.set("to", to);
    const setOrDelete = (key: string, value: string, skipAll = false) => {
      if (!value || (skipAll && value === "all")) next.delete(key);
      else next.set(key, value);
    };
    setOrDelete("user", nextUser.trim());
    setOrDelete("q", query.trim());
    setOrDelete("dir", dir, true);
    if (nextKind && nextKind !== "auth") next.set("kind", nextKind);
    else next.delete("kind");
    setOrDelete("code", code, true);
    setOrDelete("srcIp", srcIp.trim());
    setOrDelete("dstIp", dstIp.trim());
    setOrDelete("framed", framed.trim());
    setOrDelete("mac", mac.trim());
    setOrDelete("nas", nas.trim());
    next.set("page", "1");
    next.set("pageSize", String(pageSize));
    setSearchParams(next);
  };

  const applyQuickRange = (kind: "1h" | "24h" | "7d") => {
    const end = new Date();
    const start = new Date(
      kind === "1h" ? end.getTime() - 60 * 60 * 1000 : kind === "24h" ? end.getTime() - 24 * 60 * 60 * 1000 : end.getTime() - 7 * 24 * 60 * 60 * 1000
    );
    setFrom(toDateTimeLocalValue(start));
    setTo(toDateTimeLocalValue(end));
  };

  const getViewState = (): SavedViewState => ({
    from,
    to,
    user: username,
    q: query,
    dir,
    kind,
    code,
    srcIp,
    dstIp,
    framed,
    mac,
    nas,
    pageSize: String(pageSize),
  });

  const applyViewState = (state: SavedViewState) => {
    if (state.from) setFrom(String(state.from));
    if (state.to) setTo(String(state.to));
    setUsername(String(state.user ?? ""));
    setQuery(String(state.q ?? ""));
    setDir(String(state.dir ?? "all"));
    setKind(String(state.kind ?? "auth"));
    setCode(String(state.code ?? "all"));
    setSrcIp(String(state.srcIp ?? ""));
    setDstIp(String(state.dstIp ?? ""));
    setFramed(String(state.framed ?? ""));
    setMac(String(state.mac ?? ""));
    setNas(String(state.nas ?? ""));
    if (state.pageSize) {
      const n = Number(state.pageSize);
      if (Number.isFinite(n) && n > 0) setPageSize(Math.floor(n));
    }
  };

  const exportCsv = () => {
    const csv = toCsv(
      rows.map((r) => ({
        ts: formatTs(r),
        dir: r.dir,
        proto: r.proto,
        code: r.code,
        user: r.user,
        src: endpoint(r.srcIp, r.srcPort),
        dst: endpoint(r.dstIp, r.dstPort),
        framed: r.framed,
        nas: r.nas,
        mac: r.mac,
        sess: r.sess,
        rate: r.rate,
        result: r.result,
      })),
      ["ts", "dir", "proto", "code", "user", "src", "dst", "framed", "nas", "mac", "sess", "rate", "result"]
    );
    downloadTextFile(`radius-packet-audit.csv`, csv);
    notify.success("Exported current page");
  };

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title={t("packetAudit.title")}
        subtitle={t("packetAudit.subtitle")}
        icon={ScrollText}
        actions={
          <div className="flex items-center gap-2">
            <IconActionButton
              label="Refresh"
              onClick={() => auditQuery.refetch()}
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <IconActionButton label="Export CSV" onClick={exportCsv} icon={<Download className="h-4 w-4" />} />
          </div>
        }
      />

      <Card className="border-border/80 shadow-none">
        <CardContent className="p-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Quick ranges</span>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("1h")}>
              Last Hour
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("24h")}>
              Last 24h
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyQuickRange("7d")}>
              Last 7d
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <UsernameTypeahead
              value={username}
              onChange={setUsername}
              onSelect={(picked) => {
                setUsername(picked);
                if (picked) applyFiltersToUrl({ user: picked });
              }}
              placeholder="Search user (name or username)"
              ariaLabel="Search RADIUS packets by subscriber"
            />
            <Input
              placeholder="Also match IP / MAC / session / code"
              aria-label="Additional text search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applyFiltersToUrl();
              }}
            />
            <Input type="datetime-local" aria-label="From date and time" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="datetime-local" aria-label="To date and time" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <FilterPills
              name="packet-audit-kind"
              value={kind}
              onChange={(value) => applyFiltersToUrl({ kind: value })}
              options={KIND_OPTIONS}
            />
            <FilterPills
              name="packet-audit-dir"
              value={dir}
              onChange={setDir}
              options={[
                { value: "all", label: "Both" },
                { value: "recv", label: "Received" },
                { value: "send", label: "Sent" },
              ]}
            />
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input placeholder="Src IP" aria-label="Source IP" value={srcIp} onChange={(e) => setSrcIp(e.target.value)} />
            <Input placeholder="Dst IP" aria-label="Destination IP" value={dstIp} onChange={(e) => setDstIp(e.target.value)} />
            <Input placeholder="Framed IP" aria-label="Framed IP" value={framed} onChange={(e) => setFramed(e.target.value)} />
            <Input placeholder="MAC" aria-label="MAC address" value={mac} onChange={(e) => setMac(e.target.value)} />
            <Input placeholder="NAS IP / id" aria-label="NAS" value={nas} onChange={(e) => setNas(e.target.value)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button onClick={() => applyFiltersToUrl()} className="gap-2">
              <Filter className="h-4 w-4" />
              Search packets
            </Button>
            <SavedViews
              storageKey="savedViews:radiusPacketAudit"
              keys={savedViewKeys}
              getState={getViewState}
              applyState={applyViewState}
              compact
              onSaved={() => notify.success("View saved")}
              onDeleted={() => notify.success("View deleted")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2.5 md:grid-cols-3">
        <StatCard label="Packets" value={total} icon={<Radio className="h-4 w-4" />} />
        <StatCard label="Users on this page" value={uniqueUsers} icon={<Users className="h-4 w-4" />} />
        <StatCard
          label="Files scanned"
          value={auditQuery.data?.filesScanned ?? 0}
          icon={<Server className="h-4 w-4" />}
        />
      </div>

      {auditQuery.data?.truncated ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Showing the newest matching packets (scan cap reached). Narrow by username or time range for a complete user trail.
        </div>
      ) : null}

      <Card className="overflow-hidden border-border/80 shadow-none">
        <CardContent className="p-0">
          <QueryState
            isLoading={auditQuery.isLoading}
            error={auditQuery.error}
            onRetry={() => auditQuery.refetch()}
            loading={
              <div className="space-y-2 p-4">
                {[...Array(8)].map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            }
            errorTitle="Failed to load packet audit"
          >
            {auditQuery.data && auditQuery.data.available === false ? (
              <EmptyState
                icon={ScrollText}
                title="Packet audit log not available"
                description="Mount the FreeRADIUS logs volume on the backend (packets-audit.log) and rebuild the RADIUS image so packet lines are written."
              />
            ) : (
              <>
                <div className="max-h-[620px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted/55">
                      <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        <th className="px-3 py-2">Time</th>
                        <th className="px-3 py-2">Dir</th>
                        <th className="px-3 py-2">Code</th>
                        <th className="px-3 py-2">Proto</th>
                        <th className="px-3 py-2">User</th>
                        <th className="px-3 py-2">Src</th>
                        <th className="px-3 py-2">Dst</th>
                        <th className="px-3 py-2">Framed</th>
                        <th className="px-3 py-2">NAS</th>
                        <th className="px-3 py-2">MAC</th>
                        <th className="px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td className="px-3 py-6 text-muted-foreground" colSpan={11}>
                            No packets found for this filter. Auth is the default view — switch to Accounting or All packets to see interim updates.
                          </td>
                        </tr>
                      ) : (
                        rows.map((r, idx) => {
                          const rowKey = `${r.ts}-${r.dir}-${r.code}-${r.user}-${r.sess}-${idx}`;
                          const open = expanded === rowKey;
                          return (
                            <tr key={rowKey} className="border-t align-top">
                              <td className="px-3 py-2 whitespace-nowrap">{formatTs(r)}</td>
                              <td className="px-3 py-2">
                                <Badge variant={r.dir === "send" ? "default" : "secondary"}>{r.dir || "-"}</Badge>
                              </td>
                              <td className="px-3 py-2">
                                <Badge variant={codeBadgeVariant(r.code)}>{r.code || "-"}</Badge>
                                {r.result ? <div className="mt-1 text-[11px] text-muted-foreground">{r.result}</div> : null}
                              </td>
                              <td className="px-3 py-2">
                                <div>{r.proto || "-"}</div>
                                {r.framedProto ? (
                                  <div className="text-[11px] text-muted-foreground">{r.framedProto}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2">
                                {r.user && canOpenUsers ? (
                                  <Link className="underline" href={`/users/${encodeURIComponent(r.user)}`}>
                                    {r.user}
                                  </Link>
                                ) : (
                                  r.user || "-"
                                )}
                              </td>
                              <td className="px-3 py-2 font-mono text-xs">{endpoint(r.srcIp, r.srcPort)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{endpoint(r.dstIp, r.dstPort)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{r.framed || "-"}</td>
                              <td className="px-3 py-2">{r.nas || r.nasid || "-"}</td>
                              <td className="px-3 py-2 font-mono text-xs">{r.mac || "-"}</td>
                              <td className="px-3 py-2">
                                <div className="flex justify-end gap-1">
                                  <IconActionButton
                                    size="sm"
                                    label={open ? "Hide raw line" : "Show raw line"}
                                    onClick={() => setExpanded(open ? null : rowKey)}
                                    icon={<ScrollText className="h-3.5 w-3.5" />}
                                  />
                                  {r.user && canOpenUsers ? (
                                    <IconActionButton
                                      size="sm"
                                      label="Open user"
                                      onClick={() => router.push(`/users/${encodeURIComponent(r.user)}`)}
                                      icon={<ExternalLink className="h-3.5 w-3.5" />}
                                    />
                                  ) : null}
                                  {r.raw ? (
                                    <IconActionButton
                                      size="sm"
                                      label="Copy raw line"
                                      onClick={() => {
                                        void navigator.clipboard.writeText(r.raw);
                                        notify.success("Copied");
                                      }}
                                      icon={<Copy className="h-3.5 w-3.5" />}
                                    />
                                  ) : null}
                                </div>
                                {open ? (
                                  <pre className="mt-2 max-w-[28rem] overflow-auto whitespace-pre-wrap rounded bg-muted/60 p-2 text-[11px] text-muted-foreground">
                                    {r.raw}
                                  </pre>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <TablePager
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={(nextPage) => {
                    setPage(nextPage);
                    const next = new URLSearchParams(searchParams);
                    next.set("page", String(nextPage));
                    setSearchParams(next);
                  }}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                    const next = new URLSearchParams(searchParams);
                    next.set("page", "1");
                    next.set("pageSize", String(size));
                    setSearchParams(next);
                  }}
                  isDisabled={auditQuery.isFetching}
                  noun="packets"
                />
              </>
            )}
          </QueryState>
        </CardContent>
      </Card>
    </div>
  );
}
