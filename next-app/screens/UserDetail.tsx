import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";
import StatusPill from "@/components/StatusPill";
import UserSessionsPanel from "@/components/UserSessionsPanel";
import ConnectivityDiagnosisPanel from "@/components/ConnectivityDiagnosisPanel";
import { AIDiagnosticsCard } from "@/components/AIDiagnosticsCard";
import { Customer360Summary, CustomerBillingPanel, CustomerWalletPanel } from "@/components/Customer360";
import { LiveSessionCard } from "@/components/LiveSessionCard";
import { ClickHouseBandwidthChart } from "@/components/ClickHouseBandwidthChart";
import { useProfiles } from "@/hooks/useProfiles";
import { downloadTextFile, toCsv } from "@/lib/csv";
import { useAuth } from "@/context/AuthContext";
import { canAny } from "@/lib/permissions";

import type { User } from "@/types/api";
import type { DateRange } from "react-day-picker";
import { monthlyCycleSummary } from "@/lib/quotaCycle";
import { ArrowLeft, History, Settings, Trash2, KeyRound, Activity, Download, RefreshCw, FileText, Wallet } from "lucide-react";

type AuditLogRow = {
  id: number;
  level: string;
  message: string;
  meta: any;
  timestamp: string;
};

async function fetchUserByUsername(username: string): Promise<User | null> {
  if (!username) return null;
  // Reuse existing search endpoint and select exact match if present.
  const resp = await apiClient.get("/radius/users/search", { params: { query: username } });
  const users: User[] = resp?.data?.data?.users ?? resp?.data?.data ?? [];
  const exact = users.find((u) => String(u.username).toLowerCase() === username.toLowerCase());
  return exact ?? users[0] ?? null;
}

async function fetchAudit(params: {
  limit?: number;
  targetUsername?: string;
  actorUsername?: string;
  action?: string;
  from?: string;
  to?: string;
}): Promise<AuditLogRow[]> {
  const resp = await apiClient.get("/audit", { params });
  const rows = (resp?.data?.data ?? []) as AuditLogRow[];
  return Array.isArray(rows) ? rows : [];
}

export default function UserDetailPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user: authUser } = useAuth();
  const { username: usernameParam } = useParams();
  const username = String(usernameParam ?? "").trim();
  const canSeeBilling = canAny(authUser, [
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ]);
  const canSeeWallet = canAny(authUser, ["billing.externalInvoices.view", "billing.externalInvoices.pay"]);

  const userQuery = useQuery({
    queryKey: ["userDetail", username],
    queryFn: () => fetchUserByUsername(username),
    enabled: Boolean(username),
  });

  const liveSessionQuery = useQuery({
    queryKey: ["customer360", "liveSession", username],
    queryFn: async () => {
      try {
        const resp = await apiClient.get(`/sessions/live/${encodeURIComponent(username)}`);
        return resp?.data?.data ?? null;
      } catch (err: any) {
        return null;
      }
    },
    enabled: Boolean(username),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const rawUser = userQuery.data ?? null;
  const user = useMemo(() => {
    if (!rawUser) return null;
    const isLive = Boolean(liveSessionQuery.data);
    return {
      ...rawUser,
      isOnline: isLive || Boolean(rawUser.isOnline),
    };
  }, [rawUser, liveSessionQuery.data]);

  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data?.data ?? [];

  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [expiresAtLocal, setExpiresAtLocal] = useState("");
  const [expiryFramedIpLocal, setExpiryFramedIpLocal] = useState("");
  const [quotaResetDayLocal, setQuotaResetDayLocal] = useState("1");
  const [quotaCycleStartDateLocal, setQuotaCycleStartDateLocal] = useState("");

  const [activeTab, setActiveTab] = useState("overview");

  const [confirm, setConfirm] = useState<
    null | { kind: "reset-quota" | "reset-mac" | "disconnect" | "delete-user" }
  >(null);

  const resetQuotaMutation = useMutation({
    mutationFn: async () => apiClient.put(`/radius/users/resetQuota/${encodeURIComponent(username)}`),
    onSuccess: () => {
      notify.success("Success", "Daily quota reset.");
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["userDetail", username] });
    },
    onError: (e: any) => notify.error("Action failed", e?.message),
  });

  const resetMacMutation = useMutation({
    mutationFn: async () => apiClient.post(`/radius/users/resetAddress/${encodeURIComponent(username)}`),
    onSuccess: () => {
      notify.success("Success", "MAC address reset.");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["userDetail", username] });
    },
    onError: (e: any) => notify.error("Action failed", e?.message),
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => apiClient.delete(`/radius/users/${encodeURIComponent(username)}`),
    onSuccess: () => {
      notify.success("Deleted", "User deleted.");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      router.push("/users/list");
    },
    onError: (e: any) => notify.error("Delete failed", e?.message),
  });

  const updateUserMutation = useMutation({
    mutationFn: async (payload: {
      profileId?: number;
      accountStatus?: string;
      expiresAt?: string | null;
      expiryFramedIp?: string | null;
      quotaResetDay?: number;
      quotaCycleStartDate?: string | null;
    }) => apiClient.put(`/radius/users/${encodeURIComponent(username)}`, { username, ...payload }),
    onSuccess: () => {
      notify.success("Saved", "User updated.");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["userDetail", username] });
    },
    onError: (e: any) => notify.error("Save failed", e?.message),
  });

  const renewSubscriptionMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/radius/users/${encodeURIComponent(username)}/renew`, { months: 1 }),
    onSuccess: () => {
      notify.success("Renewed", "Added 1 month from today (or from current end date) and set account to active.");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["userDetail", username] });
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? "Request failed";
      notify.error("Renew failed", String(msg));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      // Backend will disconnect from MikroTik (PPPoE/Hotspot) and/or fall back to RADIUS DM if configured server-side.
      return apiClient.post(`/sessions/disconnect`, { username });
    },
    onSuccess: () => {
      notify.success("Success", "Disconnect sent.");
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["customer360", "liveSession", username] });
    },
    onError: (e: any) => notify.error("Disconnect failed", e?.message ?? "Failed to disconnect user."),
  });

  const derived = useMemo(() => {
    const fullName = user?.userDetails?.fullName ?? null;
    const profileName = user?.profile?.profileName ?? null;
    const mac = user?.macAddress?.macAddress ?? null;
    const status = user?.accountStatus ?? null;
    const online = Boolean(liveSessionQuery.data || user?.isOnline);
    const last = user?.lastTimeActive ?? null;
    return { fullName, profileName, mac, status, online, last };
  }, [user, liveSessionQuery.data]);

  const canRenewSubscription = useMemo(() => {
    if (!user) return false;
    const st = String(user.accountStatus ?? "").trim();
    if (st === "suspended" || st === "terminated") return false;
    if (st === "expired") return true;
    if (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) return true;
    return false;
  }, [user]);

  const [auditActor, setAuditActor] = useState<string>("");
  const [auditAction, setAuditAction] = useState<string>("");
  const [auditRange, setAuditRange] = useState<DateRange | undefined>(undefined);

  const auditParams = useMemo(() => {
    const from = auditRange?.from ? new Date(auditRange.from) : null;
    const to = auditRange?.to ? new Date(auditRange.to) : null;
    if (from) from.setHours(0, 0, 0, 0);
    if (to) to.setHours(23, 59, 59, 999);

    return {
      limit: 200,
      targetUsername: username,
      actorUsername: auditActor.trim() || undefined,
      action: auditAction.trim() || undefined,
      from: from ? from.toISOString() : undefined,
      to: to ? to.toISOString() : undefined,
    };
  }, [username, auditActor, auditAction, auditRange]);

  const auditQuery = useQuery({
    queryKey: ["audit", auditParams],
    queryFn: () => fetchAudit(auditParams),
    enabled: Boolean(username),
  });

  const auditForUser = useMemo(() => {
    const rows = (auditQuery.data ?? []) as AuditLogRow[];
    // Backend should already filter by targetUsername, but keep a safety filter.
    return rows.filter((r) => {
      const meta = (r as any)?.meta ?? {};
      const targets: unknown = meta?.targets;
      if (Array.isArray(targets)) return targets.map(String).includes(username);
      const targetUsername = meta?.target?.username;
      return targetUsername ? String(targetUsername) === username : false;
    });
  }, [auditQuery.data, username]);

  const exportAuditCsv = useCallback(() => {
    const rows = auditForUser.map((e) => {
      const meta = (e as any)?.meta ?? {};
      return {
        timestamp: e.timestamp ?? "",
        action: String(e.message ?? "").replace(/^audit\./, ""),
        actor: meta?.actor?.username ?? "",
        requestId: meta?.requestId ?? "",
        targets: Array.isArray(meta?.targets) ? meta.targets.join(",") : "",
      };
    });
    const cols = ["timestamp", "action", "actor", "requestId", "targets"];
    const csv = toCsv(rows, cols);
    const date = new Date().toISOString().split("T")[0];
    downloadTextFile(`user_${username}_activity_${date}.csv`, csv, "text/csv;charset=utf-8");
    notify.success("Exported", "Activity exported to CSV.");
  }, [auditForUser, username]);

  useEffect(() => {
    if (!user) return;
    setSelectedProfileId(String(user.profileId ?? ""));
    setSelectedStatus(String(user.accountStatus ?? ""));
  }, [user?.username, user?.profileId, user?.accountStatus]);

  useEffect(() => {
    if (!user) return;
    if (user.expiresAt) {
      const d = new Date(user.expiresAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      setExpiresAtLocal(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
      );
    } else {
      setExpiresAtLocal("");
    }
    setExpiryFramedIpLocal(user.expiryFramedIp ?? "");
    setQuotaResetDayLocal(String(user.quotaResetDay ?? 1));
    setQuotaCycleStartDateLocal(user.quotaCycleStartDate?.slice(0, 10) ?? "");
  }, [user?.expiresAt, user?.expiryFramedIp, user?.quotaResetDay, user?.quotaCycleStartDate, user?.username]);

  const cycle = user ? monthlyCycleSummary(user) : null;

  return (
    <div className="w-full space-y-5">
      <ActionConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={
          confirm?.kind === "delete-user"
            ? "Delete user?"
            : confirm?.kind === "disconnect"
              ? "Disconnect session?"
              : confirm?.kind === "reset-mac"
                ? "Reset MAC address?"
                : "Reset daily quota?"
        }
        description={
          confirm?.kind === "delete-user"
            ? `This will permanently delete ${username}.`
            : confirm?.kind === "disconnect"
              ? `This will send a CoA disconnect for ${username}.`
              : confirm?.kind === "reset-mac"
                ? `This will clear the stored MAC binding for ${username}.`
                : `This will reset daily quota counters for ${username}.`
        }
        confirmText={confirm?.kind === "delete-user" ? "Delete" : confirm?.kind === "disconnect" ? "Disconnect" : "Confirm"}
        confirmTone={confirm?.kind === "delete-user" || confirm?.kind === "disconnect" ? "destructive" : "default"}
        onConfirm={async () => {
          if (!confirm) return;
          if (confirm.kind === "reset-quota") return void (await resetQuotaMutation.mutateAsync());
          if (confirm.kind === "reset-mac") return void (await resetMacMutation.mutateAsync());
          if (confirm.kind === "disconnect") return void (await disconnectMutation.mutateAsync());
          if (confirm.kind === "delete-user") return void (await deleteUserMutation.mutateAsync());
        }}
      />

      <PageHeader
        title={username ? `User: ${username}` : "User"}
        subtitle={derived.fullName ? derived.fullName : "User details and session history"}
        icon={Settings}
        actions={
          <div className="flex flex-wrap gap-2">
            <IconActionButton
              label="Back to Users"
              onClick={() => router.push("/users/list")}
              icon={<ArrowLeft className="h-4 w-4" />}
            />
            <IconActionButton
              label="Full Sessions"
              onClick={() => router.push(`/users/${encodeURIComponent(username)}/sessions`)}
              icon={<History className="h-4 w-4" />}
            />
          </div>
        }
      />

      <Card className="border-border/60 shadow-none">
        <CardContent className="flex flex-wrap items-center gap-2 p-3">
          <StatusPill label={derived.online ? "Online" : "Offline"} tone={derived.online ? "info" : "default"} dot pulseDot={derived.online} />
          {derived.status ? (
            <StatusPill label={derived.status} tone={derived.status === "active" ? "success" : derived.status === "suspended" ? "danger" : "warning"} dot />
          ) : null}
          {derived.profileName ? <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary">Profile: {derived.profileName}</Badge> : null}
          {derived.mac ? <Badge variant="outline" className="font-mono text-xs">MAC: {derived.mac}</Badge> : null}
          {derived.last ? <span className="ml-auto text-xs text-muted-foreground">Last active {new Date(derived.last).toLocaleString()}</span> : null}
        </CardContent>
      </Card>

      <AIDiagnosticsCard username={username} />

      {user ? <Customer360Summary user={user} /> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="h-9 max-w-full justify-start overflow-x-auto rounded-lg border border-border/60 bg-muted/30 p-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="bandwidth" className="gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Bandwidth
          </TabsTrigger>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          {canSeeBilling ? (
            <TabsTrigger value="billing" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Billing
            </TabsTrigger>
          ) : null}
          {canSeeWallet ? (
            <TabsTrigger value="wallet" className="gap-1.5">
              <Wallet className="h-3.5 w-3.5" />
              Wallet
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {username ? (
            <ConnectivityDiagnosisPanel
              username={username}
              user={user}
              onNavigateTab={setActiveTab}
            />
          ) : null}

          {username ? <LiveSessionCard username={username} /> : null}
          {username ? <ClickHouseBandwidthChart username={username} /> : null}

          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Profile</Label>
                <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map((p) => (
                      <SelectItem key={String(p.id)} value={String(p.id)}>
                        {p.profileName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="mt-2"
                  disabled={!selectedProfileId || profilesQuery.isLoading}
                  onClick={() => updateUserMutation.mutate({ profileId: Number(selectedProfileId) })}
                >
                  Save profile
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="suspended">suspended</SelectItem>
                    <SelectItem value="blocked">blocked</SelectItem>
                    <SelectItem value="terminated">terminated</SelectItem>
                    <SelectItem value="expired">expired</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="mt-2" disabled={!selectedStatus} onClick={() => updateUserMutation.mutate({ accountStatus: selectedStatus })}>
                  Save status
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Monthly quota cycle</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {cycle ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Usage this cycle</div>
                    <div className="font-mono font-medium">{cycle.usageLabel}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Status</div>
                    <Badge variant="outline" className={cycle.exceeded ? "border-red-500 text-red-600" : "border-green-500 text-green-600"}>
                      {cycle.exceeded ? "Exceeded" : `${cycle.pct}% used`}
                    </Badge>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Resets on</div>
                    <div className="font-medium">{cycle.resetLabel}</div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                <div className="space-y-2">
                  <Label htmlFor="quotaResetDay">Reset day (1–31)</Label>
                  <Input
                    id="quotaResetDay"
                    type="number"
                    min={1}
                    max={31}
                    value={quotaResetDayLocal}
                    onChange={(e) => setQuotaResetDayLocal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Recurring day each month when the quota window rolls over (if no manual date is set).</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quotaCycleStartDate">Manual cycle start</Label>
                  <Input
                    id="quotaCycleStartDate"
                    type="date"
                    value={quotaCycleStartDateLocal}
                    onChange={(e) => setQuotaCycleStartDateLocal(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Optional override. Clear to use reset day only.</p>
                </div>
                <div className="md:col-span-2">
                  <Button
                    type="button"
                    disabled={updateUserMutation.isPending}
                    onClick={() =>
                      updateUserMutation.mutate({
                        quotaResetDay: parseInt(quotaResetDayLocal, 10),
                        quotaCycleStartDate: quotaCycleStartDateLocal.trim() ? quotaCycleStartDateLocal.trim() : null,
                      })
                    }
                  >
                    Save quota cycle
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Subscription expiry</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="expiresAt">Access expires</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={expiresAtLocal}
                  onChange={(e) => setExpiresAtLocal(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Clear the field and save to remove expiry.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiryFramedIp">Optional framed IP (legacy)</Label>
                <Input
                  id="expiryFramedIp"
                  value={expiryFramedIpLocal}
                  onChange={(e) => setExpiryFramedIpLocal(e.target.value)}
                  placeholder="Rarely needed"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Expired accounts cannot log in until staff renews or extends expiry below.
                </p>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2 items-center">
                <Button
                  type="button"
                  onClick={() =>
                    updateUserMutation.mutate({
                      expiresAt: expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null,
                      expiryFramedIp: expiryFramedIpLocal.trim() ? expiryFramedIpLocal.trim() : null,
                    })
                  }
                  disabled={updateUserMutation.isPending}
                >
                  Save expiry
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!canRenewSubscription || renewSubscriptionMutation.isPending}
                  onClick={() => renewSubscriptionMutation.mutate()}
                  title={
                    canRenewSubscription
                      ? "Add 1 calendar month from now or from current end date, set active, and request disconnect"
                      : "Only for expired or past-due subscriptions"
                  }
                >
                  Renew +1 month
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Quick links</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-4">
              <Button variant="outline" asChild>
                <Link href={`/users/${encodeURIComponent(username)}/sessions`}>View session history</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bandwidth" className="space-y-4">
          {username ? <ClickHouseBandwidthChart username={username} /> : null}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <UserSessionsPanel username={username} />
        </TabsContent>

        {canSeeBilling ? (
          <TabsContent value="billing" className="space-y-4">
            <CustomerBillingPanel username={username} />
          </TabsContent>
        ) : null}

        {canSeeWallet ? (
          <TabsContent value="wallet" className="space-y-4">
            <CustomerWalletPanel username={username} />
          </TabsContent>
        ) : null}

        <TabsContent value="activity" className="space-y-4">
          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Activity
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => auditQuery.refetch()}
                    disabled={auditQuery.isFetching}
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${auditQuery.isFetching ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportAuditCsv}
                    disabled={auditForUser.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-col lg:flex-row gap-2 lg:items-center lg:justify-between pb-4">
                <div className="flex flex-col md:flex-row gap-2 md:items-center">
                  <Input
                    value={auditActor}
                    onChange={(e) => setAuditActor(e.target.value)}
                    placeholder="Filter by actor username…"
                    className="md:w-[220px]"
                  />
                  <Input
                    value={auditAction}
                    onChange={(e) => setAuditAction(e.target.value)}
                    placeholder="Filter by action (e.g. users.bulk.delete)…"
                    className="md:w-[300px]"
                  />
                </div>
                <DateRangePicker dateRange={auditRange} onDateRangeChange={setAuditRange} />
              </div>

              {auditQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading activity…</div>
              ) : auditQuery.error ? (
                <div className="text-sm text-red-600">Failed to load activity.</div>
              ) : auditForUser.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity recorded for this user yet.</div>
              ) : (
                <div className="w-full overflow-auto rounded-lg border border-border/60">
                  <Table className="text-sm">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Time</TableHead>
                        <TableHead className="whitespace-nowrap">Action</TableHead>
                        <TableHead className="whitespace-nowrap">Actor</TableHead>
                        <TableHead className="whitespace-nowrap">Request</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditForUser.slice(0, 50).map((e) => {
                        const meta = (e as any)?.meta ?? {};
                        const actor = meta?.actor?.username ?? "—";
                        const requestId = meta?.requestId ?? "—";
                        const action = String(e.message ?? "").replace(/^audit\./, "") || "—";
                        const ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "—";
                        return (
                          <TableRow key={String(e.id)} className="hover:bg-primary/[0.03]">
                            <TableCell className="whitespace-nowrap py-2">{ts}</TableCell>
                            <TableCell className="whitespace-nowrap">{action}</TableCell>
                            <TableCell className="whitespace-nowrap">{actor}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">{requestId}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  {auditForUser.length > 50 ? (
                    <div className="pt-2 text-xs text-muted-foreground">Showing latest 50 events for this user.</div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card className="border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base">Operations</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-4">
              <Button variant="outline" onClick={() => setConfirm({ kind: "reset-quota" })} disabled={!username}>
                <KeyRound className="h-4 w-4 mr-2" />
                Reset daily quota
              </Button>
              <Button variant="outline" onClick={() => setConfirm({ kind: "reset-mac" })} disabled={!username}>
                Reset MAC
              </Button>
              <Button variant="destructive" onClick={() => setConfirm({ kind: "disconnect" })} disabled={!username}>
                Disconnect (CoA)
              </Button>
              <Button variant="destructive" onClick={() => setConfirm({ kind: "delete-user" })} disabled={!username}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete user
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

