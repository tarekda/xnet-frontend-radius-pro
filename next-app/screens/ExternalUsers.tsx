"use client";
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  ChevronRight,
  CloudDownload,
  Copy,
  Download,
  ExternalLink,
  Layers,
  RefreshCw,
  Search,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import PageHeader from "@/components/PageHeader";
import { notify } from "@/lib/notify";
import {
  fetchExternalUsers,
  fetchExternalUserProviders,
  runExternalUserCommand,
  type ExternalUser,
  type ExternalUserCommand,
  type ExternalUserProvider,
  type ProviderResult,
} from "@/api/externalUsers";

// ─── Provider color map ───────────────────────────────────────────────────────
const PROVIDER_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  myisp:  { bg: "bg-violet-500/10 border-violet-400/30",  text: "text-violet-400",  dot: "bg-violet-500" },
  myisp2: { bg: "bg-indigo-500/10 border-indigo-400/30",  text: "text-indigo-400",  dot: "bg-indigo-500" },
  idm:    { bg: "bg-sky-500/10 border-sky-400/30",        text: "text-sky-400",     dot: "bg-sky-500"    },
  terra:  { bg: "bg-emerald-500/10 border-emerald-400/30",text: "text-emerald-400", dot: "bg-emerald-500"},
  terra2: { bg: "bg-teal-500/10 border-teal-400/30",      text: "text-teal-400",    dot: "bg-teal-500"   },
  misp:   { bg: "bg-cyan-500/10 border-cyan-400/30",      text: "text-cyan-400",    dot: "bg-cyan-500"   },
};

function ProviderBadge({ provider, label }: { provider: string; label: string }) {
  const colors = PROVIDER_COLORS[provider] ?? { bg: "bg-muted/40 border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${colors.bg} ${colors.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
      {label}
    </span>
  );
}

function AccountStatusBadge({ status }: { status?: ExternalUser["accountStatus"] }) {
  if (status === "inactive") {
    return (
      <span className="inline-flex items-center rounded-full border border-amber-400/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
        Inactive
      </span>
    );
  }
  if (status === "expired") {
    return (
      <span className="inline-flex items-center rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-red-400">
        Expired
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-sky-400/30 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-sky-400">
      Active
    </span>
  );
}

function OnlineBadge({ online }: { online: boolean }) {
  if (online) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
      Offline
    </span>
  );
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────
function UserDetailSheet({
  user,
  commands,
  onClose,
}: {
  user: ExternalUser | null;
  commands: ExternalUserCommand[];
  onClose: () => void;
}) {
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => notify.success(`Copied ${label}`)).catch(() => {});
  };

  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-[480px] overflow-y-auto">
        {user && (
          <>
            <SheetHeader className="pb-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white font-bold text-lg shadow-lg">
                  {(user.fullName || user.username || "?")[0].toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-base leading-tight truncate">{user.username}</SheetTitle>
                  {user.fullName && (
                    <p className="text-sm text-muted-foreground truncate">{user.fullName}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <AccountStatusBadge status={user.accountStatus} />
                <OnlineBadge online={user.online} />
                <ProviderBadge provider={user.provider} label={user.providerLabel} />
              </div>
            </SheetHeader>

            <div className="mt-5 space-y-5">
              {/* Session */}
              {user.online && (
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                    <Wifi className="h-4 w-4" />
                    Live Session
                  </div>
                  {user.sessionIp && (
                    <DetailRow label="IP Address" value={user.sessionIp} onCopy={() => copyToClipboard(user.sessionIp!, "IP")} />
                  )}
                  {user.sessionStarted && (
                    <DetailRow label="Started" value={new Date(user.sessionStarted).toLocaleString()} />
                  )}
                </div>
              )}

              {/* Subscriber info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Subscriber Info</h3>
                <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
                  {user.plan && <DetailRow label="Plan" value={user.plan} />}
                  {user.expiryDate && (
                    <DetailRow
                      label="Expiry Date"
                      value={user.expiryDate}
                      highlight={new Date(user.expiryDate) < new Date() ? "expired" : undefined}
                    />
                  )}
                  {user.email && <DetailRow label="Email" value={user.email} onCopy={() => copyToClipboard(user.email, "email")} />}
                  {user.phoneNumber && <DetailRow label="Phone" value={user.phoneNumber} onCopy={() => copyToClipboard(user.phoneNumber, "phone")} />}
                  {user.address && <DetailRow label="Address" value={user.address} />}
                  {user.macAddress && <DetailRow label="MAC Address" value={user.macAddress} mono onCopy={() => copyToClipboard(user.macAddress!, "MAC")} />}
                </div>
              </div>

              {commands.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Provider commands</h3>
                  <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
                    {commands.map((command) => (
                      <div key={command.command} className="px-4 py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium capitalize">{command.command}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!command.wired || pendingCommand !== null}
                            onClick={() => {
                              if (!user || !command.wired) return;
                              setPendingCommand(command.command);
                              runExternalUserCommand(user.provider, user.username, command.command)
                                .then(() => notify.success(`${command.command} sent`, command.upstream))
                                .catch((err: unknown) => {
                                  const message =
                                    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                                    (err instanceof Error ? err.message : "Command failed");
                                  notify.error(`${command.command} failed`, message);
                                })
                                .finally(() => setPendingCommand(null));
                            }}
                          >
                            {command.wired ? "Run" : "Not connected"}
                          </Button>
                        </div>
                        <p className="font-mono text-[11px] text-muted-foreground break-all">{command.upstream}</p>
                        <p className="text-xs text-muted-foreground">
                          {command.description}
                          {command.localSession === "disconnect"
                            ? " Our RADIUS then disconnects any open session."
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                  <a href={`/users/list?q=${encodeURIComponent(user.username)}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Search in RADIUS Users
                  </a>
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                  <a href={`/online-users?search=${encodeURIComponent(user.username)}`} target="_blank" rel="noreferrer">
                    <Activity className="h-4 w-4" />
                    View Live Sessions
                  </a>
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  mono,
  highlight,
  onCopy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "expired";
  onCopy?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="shrink-0 text-xs text-muted-foreground w-28">{label}</span>
      <span
        className={`min-w-0 flex-1 text-sm truncate text-right ${mono ? "font-mono" : ""} ${
          highlight === "expired" ? "text-red-400" : "text-foreground"
        }`}
        title={value}
      >
        {value}
      </span>
      {onCopy && (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
          className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ExternalUsersPage() {
  const [search, setSearch] = useState("");
  const [onlineFilter, setOnlineFilter] = useState<"all" | "online" | "offline">("all");
  const [selectedProviders, setSelectedProviders] = useState<ExternalUserProvider[]>([]);
  const [selectedUser, setSelectedUser] = useState<ExternalUser | null>(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Load configured providers first (fast)
  const providersQuery = useQuery({
    queryKey: ["external-users-providers"],
    queryFn: fetchExternalUserProviders,
    staleTime: 60_000,
  });
  const allProvidersList = useMemo(
    () => providersQuery.data ?? [],
    [providersQuery.data]
  );
  const configuredProviders = useMemo(
    () => allProvidersList.filter((p) => p.configured),
    [allProvidersList]
  );

  const [accumulatedData, setAccumulatedData] = useState<{
    providers: ProviderResult[];
    totalUsers: number;
    totalOnline: number;
    fetchedAt: string;
  }>({ providers: [], totalUsers: 0, totalOnline: 0, fetchedAt: new Date().toISOString() });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProviderKey, setLoadingProviderKey] = useState<string | null>(null);

  // Main data query (sequential progressive loading)
  useEffect(() => {
    if (configuredProviders.length === 0) return;
    let isCancelled = false;
    
    const loadSequentially = async () => {
      setIsLoading(true);
      setAccumulatedData({ providers: [], totalUsers: 0, totalOnline: 0, fetchedAt: new Date().toISOString() });
      
      for (const provider of configuredProviders) {
        if (isCancelled) break;
        setLoadingProviderKey(provider.key);
        try {
          const res = await fetchExternalUsers({ providers: [provider.key as ExternalUserProvider] });
          if (!isCancelled) {
            setAccumulatedData((prev) => ({
              providers: [...prev.providers, ...res.providers],
              totalUsers: prev.totalUsers + res.totalUsers,
              totalOnline: prev.totalOnline + res.totalOnline,
              fetchedAt: res.fetchedAt,
            }));
            const failed = res.providers.find((p) => p.error);
            if (failed?.error) {
              notify.error(`${provider.label} failed`, failed.error);
            }
          }
        } catch (err) {
          const message =
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
            (err instanceof Error ? err.message : "Request failed");
          if (!isCancelled) {
            setAccumulatedData((prev) => ({
              ...prev,
              providers: [
                ...prev.providers,
                {
                  provider: provider.key as ExternalUserProvider,
                  label: provider.label,
                  users: [],
                  error: message,
                  fetchedAt: new Date().toISOString(),
                },
              ],
            }));
            notify.error(`${provider.label} failed`, message);
          }
        }
      }
      
      if (!isCancelled) {
        setLoadingProviderKey(null);
        setIsLoading(false);
      }
    };
    
    loadSequentially();
    
    return () => {
      isCancelled = true;
    };
  }, [configuredProviders, fetchKey]);

  const [showDuplicatesSheet, setShowDuplicatesSheet] = useState(false);

  const allUsers = useMemo(() => {
    const users: ExternalUser[] = [];
    for (const p of accumulatedData.providers) {
      users.push(...p.users);
    }
    return users;
  }, [accumulatedData]);

  const duplicates = useMemo(() => {
    const map = new Map<string, ExternalUser[]>();
    for (const u of allUsers) {
      const key = (u.phoneNumber?.trim() || u.email?.trim() || (u.macAddress ? u.macAddress.toLowerCase().trim() : ""));
      if (!key || key.length < 3) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(u);
    }
    return Array.from(map.entries())
      .filter(([, users]) => {
        const providers = new Set(users.map(x => x.provider));
        return providers.size > 1;
      })
      .map(([matchKey, users]) => ({ matchKey, users }));
  }, [allUsers]);

  const filteredUsers = useMemo(() => {
    let result = allUsers;
    if (selectedProviders.length > 0) {
      result = result.filter((u) => selectedProviders.includes(u.provider));
    }
    if (onlineFilter === "online") result = result.filter((u) => u.online);
    if (onlineFilter === "offline") result = result.filter((u) => !u.online);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          u.fullName.toLowerCase().includes(q) ||
          u.phoneNumber.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allUsers, selectedProviders, onlineFilter, search]);

  const onlineCount = useMemo(() => filteredUsers.filter((u) => u.online).length, [filteredUsers]);
  const offlineCount = filteredUsers.length - onlineCount;

  const handleRefresh = useCallback(() => {
    setFetchKey((k) => k + 1);
    notify.success("Refreshing external users…", "Fetching from all providers");
  }, []);

  const toggleProvider = (key: ExternalUserProvider) => {
    setSelectedProviders((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const exportCsv = () => {
    const headers = ["Username", "Full Name", "Provider", "Plan", "Expiry", "Phone", "MAC", "Account", "Session", "Session IP"];
    const rows = filteredUsers.map((u) => [
      u.username,
      u.fullName,
      u.providerLabel,
      u.plan ?? "",
      u.expiryDate ?? "",
      u.phoneNumber,
      u.macAddress ?? "",
      u.accountStatus ?? "active",
      u.online ? "Online" : "Offline",
      u.sessionIp ?? "",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `external-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalOnline = accumulatedData.totalOnline ?? 0;
  const totalUsers = accumulatedData.totalUsers ?? 0;

  return (
    <div className="w-full space-y-5 animate-in fade-in-50">
      <PageHeader
        title="External Users"
        subtitle="Live subscriber list from all connected RADIUS providers, with online status"
        icon={CloudDownload}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {accumulatedData.providers.length > 0 && (
              <Badge variant="outline" className="h-6 text-[10px] text-muted-foreground">
                Updated {new Date(accumulatedData.fetchedAt).toLocaleTimeString()}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
              onClick={() => setShowDuplicatesSheet(true)}
            >
              <Layers className="h-4 w-4" />
              Duplicate Finder ({duplicates.length})
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={filteredUsers.length === 0}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2 min-w-[110px]" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              {isLoading && loadingProviderKey
                ? `Loading ${configuredProviders.find(p => p.key === loadingProviderKey)?.label || "..."}`
                : "Refresh"}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total External", value: totalUsers, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Online Now", value: totalOnline, icon: Wifi, color: "text-emerald-400", bg: "bg-emerald-500/10", pulse: true },
          { label: "Offline", value: totalUsers - totalOnline, icon: WifiOff, color: "text-muted-foreground", bg: "bg-muted/30" },
          { label: "Providers", value: configuredProviders.length, icon: Activity, color: "text-violet-400", bg: "bg-violet-500/10" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60 shadow-none">
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {isLoading ? <Skeleton className="h-7 w-12" /> : stat.value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">{stat.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Provider Live Health & Latency Monitor */}
      <Card className="border-border/60 bg-muted/20 shadow-none">
        <CardContent className="p-3.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Activity className="h-3.5 w-3.5 text-violet-400" />
              Provider Live API Health & Connection Monitor
            </div>
            <span className="text-[11px] text-muted-foreground font-mono">
              {configuredProviders.length} active provider connection(s)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-6">
            {allProvidersList.map((prov) => {
              const loadedData = accumulatedData.providers.find((p) => p.provider === prov.key);
              const isConfigured = Boolean(prov.configured);
              const isCurrentlyLoading = loadingProviderKey === prov.key;
              const providerError = loadedData?.error || null;
              const totalCount = loadedData?.users?.length ?? 0;
              const onlineCount = loadedData?.users?.filter((u) => u.online).length ?? 0;

              return (
                <div
                  key={prov.key}
                  title={providerError || undefined}
                  className={`rounded-xl border p-2.5 transition-all ${
                    providerError
                      ? "border-red-500/40 bg-red-500/5"
                      : isConfigured
                        ? "border-border/60 bg-card hover:border-primary/40 shadow-xs"
                        : "border-border/40 bg-muted/40 opacity-60"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold truncate">{prov.label}</span>
                    <span className="flex h-2 w-2 relative shrink-0">
                      {isCurrentlyLoading ? (
                        <span className="animate-spin h-2 w-2 rounded-full border-2 border-violet-500 border-t-transparent" />
                      ) : providerError ? (
                        <span className="inline-flex rounded-full h-2 w-2 bg-red-500" />
                      ) : isConfigured ? (
                        <>
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                        </>
                      ) : (
                        <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/40" />
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px]">
                    <span className={`font-medium ${providerError ? "text-red-400" : "text-muted-foreground"}`}>
                      {!isConfigured ? "Disabled" : providerError ? "Failed" : `${totalCount} sub(s)`}
                    </span>
                    {isConfigured && !providerError && (
                      <span className="font-mono text-emerald-400 font-semibold">
                        {onlineCount} online
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {accumulatedData.providers.some((p) => p.error) && (
            <div className="mt-2.5 space-y-1">
              {accumulatedData.providers
                .filter((p) => p.error)
                .map((p) => (
                  <p key={p.provider} className="flex items-start gap-1.5 text-[11px] text-red-400">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                    <span>
                      <span className="font-semibold">{p.label}:</span> {p.error}
                    </span>
                  </p>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              aria-label="Search external users by username, name, or phone"
              className="pl-9 pr-9 h-10"
              placeholder="Search by username, name, phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Provider filter pills */}
            <span className="text-xs text-muted-foreground shrink-0">Provider:</span>
            <button
              type="button"
              onClick={() => setSelectedProviders([])}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                selectedProviders.length === 0
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              All
            </button>
            {configuredProviders.map((p) => {
              const colors = PROVIDER_COLORS[p.key] ?? { bg: "bg-muted/40 border-border", text: "text-muted-foreground", dot: "bg-muted-foreground" };
              const isActive = selectedProviders.includes(p.key as ExternalUserProvider);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => toggleProvider(p.key as ExternalUserProvider)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${
                    isActive ? `${colors.bg} ${colors.text}` : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${isActive ? colors.dot : "bg-muted-foreground/50"}`} />
                  {p.label}
                </button>
              );
            })}

            <div className="h-4 w-px bg-border/60 mx-1" />

            {/* Online status filter */}
            <span className="text-xs text-muted-foreground shrink-0">Status:</span>
            {(["all", "online", "offline"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setOnlineFilter(f)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                  onlineFilter === f
                    ? f === "online"
                      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-400"
                      : f === "offline"
                        ? "border-border bg-muted text-muted-foreground"
                        : "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {f === "all" ? "All" : f === "online" ? "🟢 Online" : "⚫ Offline"}
              </button>
            ))}

            {/* Result count */}
            <span className="ml-auto text-xs text-muted-foreground">
              {filteredUsers.length.toLocaleString()} users · {onlineCount.toLocaleString()} online
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Error banners */}
      {accumulatedData.providers
        .filter((p) => p.error)
        .map((p) => (
          <div key={p.provider} className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-500/5 p-4 text-sm text-amber-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <span className="font-semibold">{p.label}</span> — {p.error}
            </div>
          </div>
        ))}

      {/* Loading skeleton */}
      {isLoading && filteredUsers.length === 0 && (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && filteredUsers.length === 0 && accumulatedData.providers.length > 0 && (
        <Card className="border-border/60 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <Users className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No external users found</p>
            <p className="text-xs">
              {search || selectedProviders.length > 0 || onlineFilter !== "all"
                ? "Try adjusting your filters"
                : "Click Refresh to fetch from providers"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      {filteredUsers.length > 0 && (
        <Card className="border-border/60 shadow-none overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">User</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden md:table-cell">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Plan</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden xl:table-cell">Expiry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden lg:table-cell">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hidden xl:table-cell">MAC</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredUsers.map((user, idx) => {
                  const isExpired = user.expiryDate && new Date(user.expiryDate) < new Date();
                  return (
                    <tr
                      key={`${user.provider}-${user.username}-${idx}`}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                      onClick={() => setSelectedUser(user)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedUser(user);
                        }
                      }}
                    >
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-600/20 text-xs font-bold text-violet-400 ring-1 ring-violet-500/20">
                            {(user.fullName || user.username || "?")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[140px]">{user.username}</div>
                            {user.fullName && (
                              <div className="text-xs text-muted-foreground truncate max-w-[140px]">{user.fullName}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Provider */}
                      <td className="px-4 py-3 hidden md:table-cell">
                        <ProviderBadge provider={user.provider} label={user.providerLabel} />
                      </td>

                      {/* Plan */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-foreground/80 truncate max-w-[120px] block">{user.plan ?? "—"}</span>
                      </td>

                      {/* Expiry */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className={`text-sm font-mono ${isExpired ? "text-red-400" : "text-foreground/80"}`}>
                          {user.expiryDate ?? "—"}
                        </span>
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm text-muted-foreground">{user.phoneNumber || "—"}</span>
                      </td>

                      {/* MAC */}
                      <td className="px-4 py-3 hidden xl:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">{user.macAddress ?? "—"}</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <AccountStatusBadge status={user.accountStatus} />
                          <OnlineBadge online={user.online} />
                        </div>
                      </td>

                      {/* Chevron */}
                      <td className="px-2 py-3">
                        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-border/60 px-4 py-3 text-xs text-muted-foreground bg-muted/10">
            {filteredUsers.length.toLocaleString()} users · {onlineCount.toLocaleString()} online · {offlineCount.toLocaleString()} offline
            {isLoading && <span className="ml-2 text-primary">· Refreshing…</span>}
          </div>
        </Card>
      )}

      <UserDetailSheet
        user={selectedUser}
        commands={
          allProvidersList.find((provider) => provider.key === selectedUser?.provider)?.commands ?? []
        }
        onClose={() => setSelectedUser(null)}
      />

      {/* Duplicate Finder Drawer */}
      <Sheet open={showDuplicatesSheet} onOpenChange={setShowDuplicatesSheet}>
        <SheetContent className="w-full sm:max-w-[560px] overflow-y-auto">
          <SheetHeader className="pb-4 border-b border-border/60">
            <div className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-violet-400" />
              <SheetTitle className="text-base">Cross-Provider Duplicate Matches</SheetTitle>
            </div>
            <p className="text-xs text-muted-foreground">
              Subscribers with matching phone numbers, emails, or MAC addresses registered across multiple external providers.
            </p>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {duplicates.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground border rounded-xl bg-muted/20">
                No cross-provider duplicate subscribers found across all loaded providers.
              </div>
            ) : (
              duplicates.map((dup, idx) => (
                <div key={idx} className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-violet-400 font-mono">
                      Match Key: {dup.matchKey}
                    </span>
                    <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400">
                      {dup.users.length} Provider Accounts
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {dup.users.map((u, i) => (
                      <div key={i} className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-2.5 text-xs">
                        <div className="min-w-0 flex-1">
                          <div className="font-bold">{u.username} ({u.fullName || "No Name"})</div>
                          <div className="text-muted-foreground text-[11px]">Plan: {u.plan || "—"} · Expiry: {u.expiryDate || "—"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <ProviderBadge provider={u.provider} label={u.providerLabel} />
                          <OnlineBadge online={u.online} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
