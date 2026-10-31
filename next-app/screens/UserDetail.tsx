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
import { ArrowLeft, History, Settings, Trash2, KeyRound, Activity, Download, RefreshCw, FileText, Wallet, Loader2, Save, Undo2, UserX, User as UserIcon, Wifi, Shield, Calendar, Gauge, Check, Copy, Phone, Mail, MapPin, Clock, Eye, EyeOff, Lock, ScrollText } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

type AuditLogRow = {
  id: number;
  level: string;
  message: string;
  meta: any;
  timestamp: string;
};

/** Format an ISO timestamp as the local `YYYY-MM-DDTHH:mm` value a datetime-local input expects. */
function toLocalDateTimeInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Avatar initials — prefers the full name, falls back to the username. */
function initialsOf(...sources: Array<string | null | undefined>): string {
  const source = sources.map((s) => String(s ?? "").trim()).find((s) => s.length > 0) ?? "";
  if (!source) return "?";
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

/** Whole days from now until an ISO timestamp; negative when already past. */
function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - Date.now()) / 86_400_000);
}

/** Compact "2h ago" label for the activity timeline. */
function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return String(iso);
  const minutes = Math.round((Date.now() - time) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** Copy-to-clipboard affordance shared by the identity and credential panels. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify.error("Copy failed", "Clipboard access is unavailable in this browser.");
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** Labelled field row used by the identity panel. */
function InfoRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: ElementType;
  label: string;
  value?: string | null;
  href?: string;
}) {
  const text = String(value ?? "").trim();
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {text ? (
          href ? (
            <a href={href} className="block truncate text-sm font-medium text-primary hover:underline">
              {text}
            </a>
          ) : (
            <div className="truncate text-sm font-medium text-foreground" title={text}>
              {text}
            </div>
          )
        ) : (
          <div className="text-sm text-muted-foreground/60">Not provided</div>
        )}
      </div>
      {text ? <CopyButton value={text} label={label} /> : null}
    </div>
  );
}

/** Username + password with reveal and copy guards. */
function CredentialsCard({ username, password }: { username: string; password: string }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <Card className="glass-card border-l-[3px] border-l-violet-500/50">
      <CardHeader className="border-b border-border/50 p-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-violet-500" />
          Credentials
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4">
        <InfoRow icon={UserIcon} label="Username" value={username} />
        <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/25 px-3 py-2">
          <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Password</div>
            {password ? (
              <div className="truncate font-mono text-sm font-medium text-foreground">
                {revealed ? password : "••••••••••"}
              </div>
            ) : (
              <div className="text-sm text-muted-foreground/60">Not set</div>
            )}
          </div>
          {password ? (
            <>
              <button
                type="button"
                onClick={() => setRevealed((v) => !v)}
                aria-label={revealed ? "Hide password" : "Show password"}
                title={revealed ? "Hide password" : "Show password"}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
              <CopyButton value={password} label="password" />
            </>
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground">
          Share these with the subscriber over a trusted channel only.
        </p>
      </CardContent>
    </Card>
  );
}

async function fetchUserByUsername(username: string): Promise<User | null> {
  if (!username) return null;
  // Reuse existing search endpoint and select exact match if present.
  const resp = await apiClient.get("/radius/users/search", { params: { query: username } });
  const users: User[] = resp?.data?.data?.users ?? resp?.data?.data ?? [];
  // Only an exact username match is this page's user. Falling back to the first
  // fuzzy result used to render a different subscriber under the requested name.
  const exact = users.find((u) => String(u.username).toLowerCase() === username.toLowerCase());
  return exact ?? null;
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

function UserDetailSkeleton() {
  return (
    <div className="w-full space-y-5 animate-in fade-in-50 duration-300">
      <div className="relative overflow-hidden rounded-xl border border-primary/20 p-5">
        <div className="absolute inset-0 animated-mesh-bg opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-secondary/40 to-background/70 backdrop-blur-sm" />
        <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-primary via-indigo-500 to-purple-600 rounded-l-xl" />
        <div className="relative z-10 flex items-center gap-4 pl-2">
          <Skeleton className="h-14 w-14 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-[200px]" />
            <Skeleton className="h-4 w-[160px]" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-32 rounded-full" />
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-2xl rounded-lg" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
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
      } catch {
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
    null | { kind: "reset-quota" | "reset-mac" | "disconnect" | "apply-rate-limit" | "delete-user" }
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

  const applyRateLimitMutation = useMutation({
    mutationFn: async () =>
      apiClient.post(`/radius/users/${encodeURIComponent(username)}/apply-rate-limit`),
    onSuccess: () => {
      notify.success("Rate limit pushed", "Current profile queue was sent via CoA.");
      qc.invalidateQueries({ queryKey: ["onlineUsers"] });
      qc.invalidateQueries({ queryKey: ["userDetail", username] });
    },
    onError: (e: any) =>
      notify.error(
        "CoA failed",
        e?.response?.data?.message ?? e?.message ?? "Failed to apply rate-limit."
      ),
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

  const avatarInitials = useMemo(
    () => initialsOf(user?.userDetails?.fullName, username),
    [user?.userDetails?.fullName, username]
  );

  /* Expiry countdown — drives the urgency colour on the hero and status ribbon. */
  const expiryDays = useMemo(() => daysUntil(user?.expiresAt), [user?.expiresAt]);
  const expiryLabel =
    expiryDays === null
      ? null
      : expiryDays < 0
        ? `Expired ${Math.abs(expiryDays)}d ago`
        : expiryDays === 0
          ? "Expires today"
          : `Expires in ${expiryDays}d`;
  const expiryTextClass =
    expiryDays === null
      ? "text-muted-foreground"
      : expiryDays <= 3
        ? "text-rose-600 dark:text-rose-400"
        : expiryDays <= 7
          ? "text-amber-600 dark:text-amber-400"
          : "text-muted-foreground";
  const expiryBadgeClass =
    expiryDays === null
      ? "border-border/70"
      : expiryDays <= 3
        ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : expiryDays <= 7
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-border/70";

  const canRenewSubscription = useMemo(() => {
    if (!user) return false;
    const st = String(user.accountStatus ?? "").trim();
    if (st === "suspended" || st === "terminated") return false;
    if (st === "expired") return true;
    if (user.expiresAt && new Date(user.expiresAt).getTime() < Date.now()) return true;
    return false;
  }, [user]);

  const [auditActorInput, setAuditActorInput] = useState<string>("");
  const [auditActionInput, setAuditActionInput] = useState<string>("");
  const [auditActor, setAuditActor] = useState<string>("");
  const [auditAction, setAuditAction] = useState<string>("");
  const [auditRange, setAuditRange] = useState<DateRange | undefined>(undefined);

  // Debounce the activity filters so typing doesn't refetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setAuditActor(auditActorInput), 400);
    return () => clearTimeout(timer);
  }, [auditActorInput]);
  useEffect(() => {
    const timer = setTimeout(() => setAuditAction(auditActionInput), 400);
    return () => clearTimeout(timer);
  }, [auditActionInput]);

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
    setExpiresAtLocal(toLocalDateTimeInput(user.expiresAt));
    setExpiryFramedIpLocal(user.expiryFramedIp ?? "");
    setQuotaResetDayLocal(String(user.quotaResetDay ?? 1));
    setQuotaCycleStartDateLocal(user.quotaCycleStartDate?.slice(0, 10) ?? "");
  }, [user?.expiresAt, user?.expiryFramedIp, user?.quotaResetDay, user?.quotaCycleStartDate, user?.username]);

  /* ── unsaved changes ───────────────────────────────────────────────────── */
  const dirtyFields = useMemo(() => {
    if (!user) return [] as string[];
    const dirty: string[] = [];
    if (selectedProfileId && String(user.profileId ?? "") !== selectedProfileId) dirty.push("profileId");
    if (selectedStatus && String(user.accountStatus ?? "") !== selectedStatus) dirty.push("accountStatus");
    if (expiresAtLocal !== toLocalDateTimeInput(user.expiresAt)) dirty.push("expiresAt");
    if (expiryFramedIpLocal !== (user.expiryFramedIp ?? "")) dirty.push("expiryFramedIp");
    if (quotaResetDayLocal !== String(user.quotaResetDay ?? 1)) dirty.push("quotaResetDay");
    if (quotaCycleStartDateLocal !== (user.quotaCycleStartDate?.slice(0, 10) ?? "")) dirty.push("quotaCycleStartDate");
    return dirty;
  }, [user, selectedProfileId, selectedStatus, expiresAtLocal, expiryFramedIpLocal, quotaResetDayLocal, quotaCycleStartDateLocal]);
  const isDirty = dirtyFields.length > 0;
  const dirtyInputClass = (field: string) =>
    dirtyFields.includes(field) ? "ring-2 ring-amber-400/60 border-amber-400/70" : "";

  const discardChanges = useCallback(() => {
    if (!user) return;
    setSelectedProfileId(String(user.profileId ?? ""));
    setSelectedStatus(String(user.accountStatus ?? ""));
    setExpiresAtLocal(toLocalDateTimeInput(user.expiresAt));
    setExpiryFramedIpLocal(user.expiryFramedIp ?? "");
    setQuotaResetDayLocal(String(user.quotaResetDay ?? 1));
    setQuotaCycleStartDateLocal(user.quotaCycleStartDate?.slice(0, 10) ?? "");
  }, [user]);

  const saveChanges = useCallback(() => {
    if (!user || dirtyFields.length === 0) return;
    const payload: {
      profileId?: number;
      accountStatus?: string;
      expiresAt?: string | null;
      expiryFramedIp?: string | null;
      quotaResetDay?: number;
      quotaCycleStartDate?: string | null;
    } = {};
    if (dirtyFields.includes("profileId")) payload.profileId = Number(selectedProfileId);
    if (dirtyFields.includes("accountStatus")) payload.accountStatus = selectedStatus;
    if (dirtyFields.includes("expiresAt")) {
      payload.expiresAt = expiresAtLocal ? new Date(expiresAtLocal).toISOString() : null;
    }
    if (dirtyFields.includes("expiryFramedIp")) {
      payload.expiryFramedIp = expiryFramedIpLocal.trim() ? expiryFramedIpLocal.trim() : null;
    }
    if (dirtyFields.includes("quotaResetDay")) payload.quotaResetDay = parseInt(quotaResetDayLocal, 10);
    if (dirtyFields.includes("quotaCycleStartDate")) {
      payload.quotaCycleStartDate = quotaCycleStartDateLocal.trim() ? quotaCycleStartDateLocal.trim() : null;
    }
    updateUserMutation.mutate(payload);
  }, [user, dirtyFields, selectedProfileId, selectedStatus, expiresAtLocal, expiryFramedIpLocal, quotaResetDayLocal, quotaCycleStartDateLocal, updateUserMutation]);

  if (userQuery.isLoading) {
    return <UserDetailSkeleton />;
  }

  if (userQuery.error || !user) {
    return (
      <div className="w-full space-y-5">
        <PageHeader
          title={username ? `User: ${username}` : "User"}
          subtitle="User details and session history"
          icon={Settings}
          actions={
            <IconActionButton
              label="Back to Users"
              onClick={() => router.push("/users/list")}
              icon={<ArrowLeft className="h-4 w-4" />}
            />
          }
        />
        <EmptyState
          icon={UserX}
          title="User not found"
          description={
            username
              ? `No subscriber named "${username}" exists. It may have been deleted or renamed.`
              : "No username was provided."
          }
          actionLabel="Back to users"
          actionTo="/users/list"
        />
      </div>
    );
  }

  const cycle = user ? monthlyCycleSummary(user) : null;

  return (
    <div className="w-full space-y-5 animate-in fade-in-50 duration-300">
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
              : confirm?.kind === "apply-rate-limit"
                ? "Push current rate-limit?"
              : confirm?.kind === "reset-mac"
                ? "Reset MAC address?"
                : "Reset daily quota?"
        }
        description={
          confirm?.kind === "delete-user"
            ? `This will permanently delete ${username}.`
            : confirm?.kind === "disconnect"
              ? `This will send a CoA disconnect for ${username}.`
              : confirm?.kind === "apply-rate-limit"
                ? `This will send a CoA Change-of-Authorization with the current profile queue for ${username}.`
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
          if (confirm.kind === "apply-rate-limit") return void (await applyRateLimitMutation.mutateAsync());
          if (confirm.kind === "disconnect") return void (await disconnectMutation.mutateAsync());
          if (confirm.kind === "delete-user") return void (await deleteUserMutation.mutateAsync());
        }}
      />

      {/* ── Hero Header ─────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border border-primary/20 p-5 shadow-[var(--shop-shadow)]">
        <div className="absolute inset-0 animated-mesh-bg opacity-80" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/8 via-secondary/40 to-background/70 backdrop-blur-sm" />
        <div className="absolute inset-y-0 left-0 w-1.5 rounded-l-xl bg-gradient-to-b from-primary via-indigo-500 to-purple-600" />
        <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative z-10 flex flex-col gap-4 pl-2 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {/* Gradient initials avatar with presence ring */}
            <div className="relative shrink-0">
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-primary to-sky-500 text-lg font-bold tracking-tight text-white shadow-lg",
                  derived.online && "ring-2 ring-emerald-400/70 ring-offset-2 ring-offset-background"
                )}
              >
                {avatarInitials}
              </div>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-background",
                  derived.online ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{username}</h1>
                <StatusPill
                  label={derived.online ? "Online" : "Offline"}
                  tone={derived.online ? "info" : "default"}
                  dot
                  pulseDot={derived.online}
                />
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {derived.fullName || "No name on file"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {derived.profileName ? (
                  <span className="inline-flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    {derived.profileName}
                  </span>
                ) : null}
                {expiryLabel ? (
                  <span className={cn("inline-flex items-center gap-1 font-medium", expiryTextClass)}>
                    <Clock className="h-3 w-3" />
                    {expiryLabel}
                  </span>
                ) : null}
                {derived.last ? (
                  <span className="inline-flex items-center gap-1">
                    <History className="h-3 w-3" />
                    Active {relativeTime(derived.last)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
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
            {canAny(authUser, ["users.online.view", "reseller.users.view"]) ? (
              <IconActionButton
                label="Packet Audit"
                to={`/radius-packet-audit?user=${encodeURIComponent(username)}`}
                icon={<ScrollText className="h-4 w-4" />}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Status Ribbon ─────────────────────────────────────────────────── */}
      <Card className="glass-card">
        <CardContent className="flex flex-wrap items-center gap-2.5 p-3">
          {derived.status ? (
            <StatusPill label={derived.status} tone={derived.status === "active" ? "success" : derived.status === "suspended" ? "danger" : "warning"} dot />
          ) : null}
          {expiryLabel ? (
            <Badge variant="outline" className={cn("gap-1.5 text-xs", expiryBadgeClass)}>
              <Calendar className="h-3 w-3" />
              {expiryLabel}
            </Badge>
          ) : null}
          {derived.mac ? (
            <Badge variant="outline" className="gap-1.5 font-mono text-xs">
              <Wifi className="h-3 w-3" />
              {derived.mac}
            </Badge>
          ) : null}
          {user.quotaResetDay ? (
            <Badge variant="outline" className="gap-1.5 text-xs">
              <Gauge className="h-3 w-3" />
              Resets day {user.quotaResetDay}
            </Badge>
          ) : null}
          {derived.last ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Last active {new Date(derived.last).toLocaleString()}
            </span>
          ) : null}
        </CardContent>
      </Card>

      <AIDiagnosticsCard username={username} />

      {user ? <Customer360Summary user={user} /> : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="sticky top-[4.5rem] z-20 h-10 max-w-full justify-start overflow-x-auto rounded-xl border border-border/60 bg-card/85 p-1 shadow-sm backdrop-blur-xl">
          <TabsTrigger value="overview" className="gap-1.5">
            <UserIcon className="h-3.5 w-3.5" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="bandwidth" className="gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-500" />
            Bandwidth
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5">
            <History className="h-3.5 w-3.5" />
            Sessions
          </TabsTrigger>
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
          <TabsTrigger value="activity" className="gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Activity
          </TabsTrigger>
          <TabsTrigger value="actions" className="gap-1.5">
            <Settings className="h-3.5 w-3.5" />
            Actions
          </TabsTrigger>
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

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="glass-card border-l-[3px] border-l-primary/50">
              <CardHeader className="border-b border-border/50 p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Profile</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger className={dirtyInputClass("profileId")}>
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
                  <p className="text-xs text-muted-foreground">Changes are saved from the bar at the bottom of the page.</p>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className={dirtyInputClass("accountStatus")}>
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
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-[3px] border-l-sky-500/50">
              <CardHeader className="border-b border-border/50 p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <UserIcon className="h-4 w-4 text-sky-500" />
                  Contact &amp; identity
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 p-4">
                <InfoRow icon={UserIcon} label="Full name" value={user.userDetails?.fullName} />
                <InfoRow
                  icon={Phone}
                  label="Phone"
                  value={user.userDetails?.phoneNumber}
                  href={
                    user.userDetails?.phoneNumber
                      ? `tel:${String(user.userDetails.phoneNumber).replace(/\s+/g, "")}`
                      : undefined
                  }
                />
                <InfoRow
                  icon={Mail}
                  label="Email"
                  value={user.userDetails?.email}
                  href={user.userDetails?.email ? `mailto:${user.userDetails.email}` : undefined}
                />
                <InfoRow icon={MapPin} label="Address" value={user.userDetails?.address} />
              </CardContent>
            </Card>

            <Card className="glass-card border-l-[3px] border-l-emerald-500/50">
              <CardHeader className="border-b border-border/50 p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-emerald-500" />
                  Monthly quota cycle
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 p-4">
                {cycle ? (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <div className="text-xs text-muted-foreground">Usage this cycle</div>
                        <div className="font-mono text-lg font-semibold tracking-tight">{cycle.usageLabel}</div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          cycle.exceeded
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {cycle.exceeded ? "Exceeded" : `${cycle.pct}% used`}
                      </Badge>
                    </div>
                    <Progress
                      value={Math.min(100, cycle.pct)}
                      indicatorClassName={
                        cycle.exceeded || cycle.pct >= 100
                          ? "bg-rose-500"
                          : cycle.pct >= 75
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>Cycle resets {cycle.resetLabel}</span>
                      <span className="tabular-nums">{cycle.pct}%</span>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 border-t border-border/60 pt-2 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quotaResetDay">Reset day (1–31)</Label>
                    <Input
                      id="quotaResetDay"
                      type="number"
                      min={1}
                      max={31}
                      value={quotaResetDayLocal}
                      onChange={(e) => setQuotaResetDayLocal(e.target.value)}
                      className={dirtyInputClass("quotaResetDay")}
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
                      className={dirtyInputClass("quotaCycleStartDate")}
                    />
                    <p className="text-xs text-muted-foreground">Optional override. Clear to use reset day only.</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-l-[3px] border-l-amber-500/50">
              <CardHeader className="border-b border-border/50 p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-amber-500" />
                  Subscription expiry
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="expiresAt">Access expires</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAtLocal}
                    onChange={(e) => setExpiresAtLocal(e.target.value)}
                    className={dirtyInputClass("expiresAt")}
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
                    className={`font-mono ${dirtyInputClass("expiryFramedIp")}`}
                  />
                  <p className="text-xs text-muted-foreground">
                    Expired accounts cannot log in until staff renews or extends expiry below.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:col-span-2">
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

            <CredentialsCard username={username} password={String(user.password?.value ?? "")} />

            <Card className="glass-card">
              <CardHeader className="border-b border-border/50 p-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Quick links
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 p-4">
                <Button variant="outline" asChild>
                  <Link href={`/users/${encodeURIComponent(username)}/sessions`}>View session history</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
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
          <Card className="glass-card border-l-[3px] border-l-indigo-500/50">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-indigo-500" />
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
                    value={auditActorInput}
                    onChange={(e) => setAuditActorInput(e.target.value)}
                    aria-label="Filter by actor username"
                    placeholder="Filter by actor username…"
                    className="md:w-[220px]"
                  />
                  <Input
                    value={auditActionInput}
                    onChange={(e) => setAuditActionInput(e.target.value)}
                    aria-label="Filter by action"
                    placeholder="Filter by action (e.g. users.bulk.delete)…"
                    className="md:w-[300px]"
                  />
                </div>
                <DateRangePicker dateRange={auditRange} onDateRangeChange={setAuditRange} />
              </div>

              {auditQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading activity…</div>
              ) : auditQuery.error ? (
                <div className="text-sm text-destructive">Failed to load activity.</div>
              ) : auditForUser.length === 0 ? (
                <div className="text-sm text-muted-foreground">No activity recorded for this user yet.</div>
              ) : (
                <div className="space-y-3">
                  <ol className="relative space-y-4 border-l border-border/60 pl-7">
                    {auditForUser.slice(0, 50).map((e) => {
                      const meta = (e as any)?.meta ?? {};
                      const actor = meta?.actor?.username ?? "—";
                      const requestId = meta?.requestId ?? "—";
                      const action = String(e.message ?? "").replace(/^audit\./, "") || "—";
                      const absolute = e.timestamp ? new Date(e.timestamp).toLocaleString() : undefined;
                      return (
                        <li key={String(e.id)} className="relative">
                          <span className="absolute -left-[2.5rem] flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card shadow-sm">
                            <Activity className="h-3 w-3 text-primary" />
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{action}</span>
                            <Badge variant="outline" className="text-[10px] font-medium">
                              {actor}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                            <span title={absolute}>{relativeTime(e.timestamp)}</span>
                            <span className="text-muted-foreground/40" aria-hidden="true">·</span>
                            <span className="font-mono">{requestId}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                  {auditForUser.length > 50 ? (
                    <div className="text-xs text-muted-foreground">Showing latest 50 events for this user.</div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-4">
          <Card className="glass-card border-l-[3px] border-l-rose-500/50">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4 text-rose-500" />
                Operations
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 p-4">
              <Button variant="outline" onClick={() => setConfirm({ kind: "reset-quota" })} disabled={!username}>
                <KeyRound className="h-4 w-4 mr-2" />
                Reset daily quota
              </Button>
              <Button variant="outline" onClick={() => setConfirm({ kind: "reset-mac" })} disabled={!username}>
                Reset MAC
              </Button>
              <Button variant="outline" onClick={() => setConfirm({ kind: "apply-rate-limit" })} disabled={!username}>
                Apply rate-limit now
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

      {/* Unsaved-changes bar: one place to review and commit edits made across the tabs. */}
      {isDirty ? (
        <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/60 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-md animate-in slide-in-from-bottom-3 duration-300">
          <div className="flex items-center gap-2 text-sm">
            <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-medium">
              {dirtyFields.length} unsaved {dirtyFields.length === 1 ? "change" : "changes"}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {dirtyFields.join(", ")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={discardChanges}
              disabled={updateUserMutation.isPending}
            >
              <Undo2 className="h-4 w-4 mr-2" />
              Discard
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveChanges}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {updateUserMutation.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

