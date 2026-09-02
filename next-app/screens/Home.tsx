import React, { useMemo } from 'react';
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  BarChart3,
  Shield,
  Activity,
  Wifi,
  ArrowRight,
  CheckCircle,
  Bell,
  Clock,
  AlertTriangle,
  Layers,
  Server,
  FileText,
  Settings,
  Gauge,
  Database,
  Zap,
} from 'lucide-react';
import { useOnlineMetrics } from '@/hooks/useOnlineMetrics';
import { useAuthMetrics } from "@/hooks/useAuthMetrics";
import { useAuth } from "@/context/AuthContext";
import { useTranslation } from "react-i18next";
import { can, canAny } from "@/lib/permissions";
import { apiClient } from "@/api/client";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import IconActionButton from "@/components/IconActionButton";
import { CountUpNumber } from "@/components/viz";
import { AIDailyOpsBriefWidget } from "@/components/AIDailyOpsBriefWidget";
import { cn } from "@/lib/utils";

type AuditLogRow = {
  id: number;
  message: string;
  meta: any;
  timestamp: string;
};

type UsersFleetMetrics = {
  total: number;
  online: number;
  monthlyExceeded: number;
  byStatus: Record<string, number>;
};

type NocHealth = {
  generatedAt: string | null;
  dbLatencyMs: number;
  serverProcessingMs: number;
  activeSessions: number;
  clientRttMs?: number;
};

const getGreetingKey = (hour: number) => {
  if (hour < 12) return "home.greeting_morning";
  if (hour < 18) return "home.greeting_afternoon";
  return "home.greeting_evening";
};

const formatAgo = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "—";
  const sec = Math.max(Math.floor((Date.now() - t) / 1000), 0);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

// ─── Module accent colors by category ────────────────────────────────────────
const moduleAccents: Record<string, { bar: string; icon: string; ring: string }> = {
  users:    { bar: "from-blue-500 to-sky-400",    icon: "text-blue-600 dark:text-blue-400",    ring: "bg-blue-500/10 border-blue-500/20" },
  online:   { bar: "from-emerald-500 to-teal-400", icon: "text-emerald-600 dark:text-emerald-400", ring: "bg-emerald-500/10 border-emerald-500/20" },
  invoices: { bar: "from-amber-500 to-orange-400", icon: "text-amber-600 dark:text-amber-400", ring: "bg-amber-500/10 border-amber-500/20" },
  profiles: { bar: "from-violet-500 to-purple-400", icon: "text-violet-600 dark:text-violet-400", ring: "bg-violet-500/10 border-violet-500/20" },
  nas:      { bar: "from-sky-500 to-cyan-400",     icon: "text-sky-600 dark:text-sky-400",     ring: "bg-sky-500/10 border-sky-500/20" },
  analytics:{ bar: "from-indigo-500 to-blue-400",  icon: "text-indigo-600 dark:text-indigo-400", ring: "bg-indigo-500/10 border-indigo-500/20" },
  alerts:   { bar: "from-rose-500 to-pink-400",    icon: "text-rose-600 dark:text-rose-400",   ring: "bg-rose-500/10 border-rose-500/20" },
  settings: { bar: "from-slate-500 to-gray-400",   icon: "text-slate-600 dark:text-slate-400", ring: "bg-slate-500/10 border-slate-500/20" },
};

const ModuleCard = ({
  title,
  description,
  icon: Icon,
  linkTo,
  linkText,
  badge,
  stats,
  accentKey = "settings",
  delay = 0,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  linkTo: string;
  linkText: string;
  badge?: string;
  stats?: { label: string; value: string | number }[];
  accentKey?: string;
  delay?: number;
}) => {
  const accent = moduleAccents[accentKey] ?? moduleAccents.settings;

  return (
    <Card
      className="group flex flex-col overflow-hidden border-border/60 shadow-sm card-hover-lift animate-slide-up gradient-border"
      style={{ animationDelay: `${delay}s` }}
    >
      {/* Accent top bar — always visible at low opacity, fully visible on hover */}
      <div className={cn("h-[3px] bg-gradient-to-r opacity-50 transition-opacity duration-300 group-hover:opacity-100", accent.bar)} />

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className={cn("rounded-xl p-2.5 border transition-all duration-300 group-hover:scale-110 group-hover:shadow-md", accent.ring)}>
            <Icon className={cn("h-5 w-5", accent.icon)} />
          </div>
          {badge && (
            <Badge variant="secondary" className="group-hover:bg-primary/10 text-[10px] font-mono">
              {badge}
            </Badge>
          )}
        </div>
        <CardTitle className="mt-3 text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      {stats && stats.length > 0 ? (
        <CardContent className="pb-3">
          <div className="grid grid-cols-2 gap-3">
            {stats.map((stat, index) => (
              <div key={index} className="rounded-lg border bg-muted/30 px-3 py-2 transition-colors group-hover:bg-muted/50">
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className="text-base font-semibold tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      ) : null}

      <CardFooter className="mt-auto">
        <Button className="w-full group/btn transition-all" variant="outline" asChild>
          <Link href={linkTo}>
            {linkText}
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

// ─── System Pulse Row ─────────────────────────────────────────────────────────
const SystemPulseRow = () => {
  const q = useQuery({
    queryKey: ["noc-health", "home-pulse"],
    queryFn: async () => {
      const started = performance.now();
      const resp = await apiClient.get("/noc-health");
      const clientRttMs = Math.max(0, Math.round(performance.now() - started));
      const data = (resp?.data?.data ?? { dbLatencyMs: 0, serverProcessingMs: 0, activeSessions: 0 }) as NocHealth;
      return { ...data, clientRttMs };
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  if (!q.data && !q.isLoading) return null;

  const noc = q.data;

  const dbTone = !noc ? "" : noc.dbLatencyMs <= 120 ? "text-emerald-600 dark:text-emerald-400" : noc.dbLatencyMs <= 400 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";
  const rttTone = !noc ? "" : noc.clientRttMs <= 800 ? "text-sky-600 dark:text-sky-400" : noc.clientRttMs <= 2000 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400";

  return (
    <div className="flex flex-wrap items-center gap-2 animate-slide-up stagger-1">
      {/* DB Latency */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs backdrop-blur-sm">
        <Database className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">DB</span>
        {q.isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          <span className={cn("font-bold tabular-nums font-mono", dbTone)}>
            <CountUpNumber value={noc!.dbLatencyMs} suffix="ms" />
          </span>
        )}
      </div>

      {/* Active Sessions */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs backdrop-blur-sm">
        <Zap className="h-3 w-3 text-indigo-500" />
        <span className="text-muted-foreground">Sessions</span>
        {q.isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          <span className="font-bold tabular-nums font-mono text-indigo-600 dark:text-indigo-400">
            <CountUpNumber value={noc!.activeSessions} />
          </span>
        )}
      </div>

      {/* Client RTT */}
      <div className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs backdrop-blur-sm">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">RTT</span>
        {q.isLoading ? (
          <span className="text-muted-foreground">…</span>
        ) : (
          <span className={cn("font-bold tabular-nums font-mono", rttTone)}>
            <CountUpNumber value={noc!.clientRttMs} suffix="ms" />
          </span>
        )}
      </div>
    </div>
  );
};

const AuthHealthCard = ({
  attempts,
  accepted,
  rejected,
  isLoading,
}: {
  attempts: number;
  accepted: number;
  rejected: number;
  isLoading: boolean;
}) => {
  const successRate = attempts > 0 ? (accepted / attempts) * 100 : 0;
  const rejectRate = attempts > 0 ? (rejected / attempts) * 100 : 0;
  const tone =
    rejectRate >= 25 ? "text-red-600 dark:text-red-400" : rejectRate >= 10 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";
  const highRejects = rejectRate >= 25;

  return (
    <Card className="border-border/60 shadow-sm card-hover-lift animate-slide-up stagger-2">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-lg font-semibold">Authentication health</CardTitle>
            <CardDescription>RADIUS auth results over the past 24 hours</CardDescription>
          </div>
          <Badge variant="outline" className={tone}>
            {isLoading ? "…" : `${rejectRate.toFixed(1)}% rejects`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Success rate
            </span>
            <span className="tabular-nums">{isLoading ? "…" : `${successRate.toFixed(1)}%`}</span>
          </div>
          <div className="relative overflow-hidden rounded-full">
            <Progress value={successRate} className="h-2" />
            {highRejects && !isLoading && (
              <div className="absolute inset-0 rounded-full progress-striped opacity-30 pointer-events-none" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Attempts</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">
              {isLoading ? "…" : <CountUpNumber value={attempts} />}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Accepted</div>
            <div className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              {isLoading ? "…" : <CountUpNumber value={accepted} />}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">Rejected</div>
            <div className={cn("mt-1 text-lg font-semibold tabular-nums", highRejects ? "text-rose-600 dark:text-rose-400 animate-pulse" : "text-red-600 dark:text-red-400")}>
              {isLoading ? "…" : <CountUpNumber value={rejected} />}
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="ghost" className="w-full" asChild>
          <Link href="/auth-failures">
            Inspect failed authentications
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

const RecentActivityCard = ({ enabled }: { enabled: boolean }) => {
  const auditQuery = useQuery({
    queryKey: ["audit", "home", "recent"],
    queryFn: async () => {
      const resp = await apiClient.get("/audit", { params: { limit: 6 } });
      const rows = (resp?.data?.data ?? []) as AuditLogRow[];
      return Array.isArray(rows) ? rows : [];
    },
    enabled,
    refetchInterval: 60000,
    staleTime: 15000,
  });

  const items = useMemo(() => {
    return (auditQuery.data ?? []).map((e) => {
      const meta = (e as any)?.meta ?? {};
      const actor = meta?.actor?.username ?? "system";
      const action = String(e.message ?? "").replace(/^audit\./, "") || "activity";
      return { id: e.id, actor, action, timestamp: e.timestamp };
    });
  }, [auditQuery.data]);

  return (
    <Card className="border-border/60 shadow-sm card-hover-lift animate-slide-up stagger-3">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Recent activity</CardTitle>
            <CardDescription>Latest administrative actions</CardDescription>
          </div>
          <div className="rounded-xl bg-primary/10 p-2 border border-primary/15">
            <Bell className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!enabled ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            You don&apos;t have permission to view the activity log.
          </p>
        ) : auditQuery.isLoading ? (
          <div className="space-y-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-10 rounded-lg animate-shimmer" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity recorded.</p>
        ) : (
          <div className="space-y-1.5">
            {items.map((item, idx) => (
              <div
                key={String(item.id)}
                className="flex items-center gap-3 rounded-lg border border-transparent p-2.5 transition-colors hover:border-border hover:bg-accent/40 animate-slide-up"
                style={{ animationDelay: `${idx * 0.04}s` }}
              >
                <div className="relative shrink-0">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 status-dot-pulse text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.action}</p>
                  <p className="truncate text-xs text-muted-foreground">by {item.actor}</p>
                </div>
                <span className="flex items-center gap-1 whitespace-nowrap text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatAgo(item.timestamp)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Home: React.FC = () => {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const { totalOnlineUsers, totalActiveUsers } = useOnlineMetrics();
  const authMetrics = useAuthMetrics(86400);

  const canSeeUsers = canAny(user, ["users.view", "reseller.users.view"]);
  const canSeeOnline = canAny(user, ["users.online.view", "reseller.users.view"]);
  const canSeeProfiles = can(user, "radius.profiles.view");
  const canSeeNas = can(user, "radius.nas.view");
  const canSeeInvoices = can(user, "billing.externalInvoices.view");
  const canSeeAnalytics = can(user, "admin.analytics.view");
  const canSeeAlerts = can(user, "admin.alerts.view");
  const canSeeAudit = canSeeUsers;

  const fleetQuery = useQuery({
    queryKey: ["users", "fleet-metrics"],
    queryFn: async () => {
      const resp = await apiClient.get("/radius/users/metrics");
      return (resp?.data?.data ?? null) as UsersFleetMetrics | null;
    },
    enabled: canSeeUsers,
    staleTime: 30000,
  });
  const fleet = fleetQuery.data;

  const greeting = t(getGreetingKey(new Date().getHours()));
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const attempts = authMetrics.data?.current.attempts ?? 0;
  const accepted = authMetrics.data?.current.accepted ?? 0;
  const rejected = authMetrics.data?.current.rejected ?? 0;
  const successRate = attempts > 0 ? (accepted / attempts) * 100 : 0;
  const rejectRate = attempts > 0 ? (rejected / attempts) * 100 : 0;

  const modules = [
    canSeeUsers
      ? {
          title: "User Management",
          description: "Create, search, and bulk-manage RADIUS subscriber accounts.",
          icon: Users,
          linkTo: "/users/list",
          linkText: "Manage users",
          badge: "Core",
          accentKey: "users",
          stats: [
            { label: "Total users", value: (fleet?.total ?? 0).toLocaleString() },
            { label: "Online now", value: (fleet?.online ?? totalOnlineUsers ?? 0).toLocaleString() },
          ],
        }
      : null,
    canSeeOnline
      ? {
          title: "Live Sessions",
          description: "Watch active sessions in real time with per-session bandwidth and NAS details.",
          icon: Wifi,
          linkTo: "/online-users",
          linkText: "Open live sessions",
          badge: "Live",
          accentKey: "online",
          stats: [
            { label: "Online", value: (totalOnlineUsers ?? 0).toLocaleString() },
            { label: "Active", value: (totalActiveUsers ?? 0).toLocaleString() },
          ],
        }
      : null,
    canSeeInvoices
      ? {
          title: "External Invoices",
          description: "Track billing, send WhatsApp reminders, and run dunning workflows.",
          icon: FileText,
          linkTo: "/external-invoices",
          linkText: "Open invoices",
          accentKey: "invoices",
        }
      : null,
    canSeeProfiles
      ? {
          title: "Network Profiles",
          description: "Configure speed plans, quotas, night windows, and pricing.",
          icon: Layers,
          linkTo: "/profiles/list",
          linkText: "Manage profiles",
          accentKey: "profiles",
        }
      : null,
    canSeeNas
      ? {
          title: "NAS Devices",
          description: "Register and maintain your network access servers and shared secrets.",
          icon: Server,
          linkTo: "/nas",
          linkText: "Manage NAS",
          accentKey: "nas",
        }
      : null,
    canSeeAnalytics
      ? {
          title: "Analytics & Reports",
          description: "Bandwidth trends, authentication analytics, and usage patterns.",
          icon: BarChart3,
          linkTo: "/analytics",
          linkText: "View analytics",
          badge: "Pro",
          accentKey: "analytics",
        }
      : null,
    canSeeAlerts
      ? {
          title: "Alerts",
          description: "Operational alerts with acknowledgement and resolution tracking.",
          icon: Bell,
          linkTo: "/alerts",
          linkText: "Review alerts",
          accentKey: "alerts",
        }
      : null,
    {
      title: "Settings",
      description: "System configuration, backups, access control, and preferences.",
      icon: Settings,
      linkTo: "/settings",
      linkText: "Open settings",
      accentKey: "settings",
    },
  ].filter(Boolean) as Array<React.ComponentProps<typeof ModuleCard>>;

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      {/* Page Header with live clock */}
      <div className="animate-slide-up">
        <PageHeader
          variant="gradient"
          liveTime
          title={`${greeting}${user?.username ? `, ${user.username}` : ""}`}
          subtitle={t("home.subtitle", { date: today })}
          icon={Shield}
          actions={(
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <IconActionButton
                label="Open Dashboard"
                to="/dashboard"
                className="border-white/25 bg-white text-slate-900 shadow-sm hover:bg-white/90"
                icon={<Activity className="h-4 w-4" />}
              />
              {canSeeAlerts ? (
                <IconActionButton
                  label="Alerts"
                  to="/alerts"
                  className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
                  icon={<Bell className="h-4 w-4" />}
                />
              ) : null}
            </div>
          )}
        />
      </div>

      {/* System Pulse Row */}
      <SystemPulseRow />

      {/* AI Daily Brief */}
      <AIDailyOpsBriefWidget />

      {/* Live KPIs — staggered */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="animate-slide-up stagger-1">
          <StatCard
            label="Online now"
            value={<CountUpNumber value={totalOnlineUsers ?? 0} />}
            sublabel="Connected sessions"
            accentColor="blue"
            icon={<Wifi className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
          />
        </div>
        <div className="animate-slide-up stagger-2">
          <StatCard
            label="Active users"
            value={<CountUpNumber value={totalActiveUsers ?? 0} />}
            sublabel="Accounts in good standing"
            accentColor="emerald"
            icon={<Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          />
        </div>
        <div className="animate-slide-up stagger-3">
          <StatCard
            label="Auth requests"
            value={authMetrics.isLoading ? "…" : <CountUpNumber value={attempts} />}
            sublabel="Past 24 hours"
            accentColor="violet"
            icon={<Shield className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
          />
        </div>
        <div className="animate-slide-up stagger-4">
          <StatCard
            label="Auth success"
            value={authMetrics.isLoading ? "…" : `${successRate.toFixed(1)}%`}
            sublabel={attempts > 0 ? `${rejected.toLocaleString()} rejected in 24h` : "No attempts recorded yet"}
            accentColor="orange"
            trend={!authMetrics.isLoading && attempts > 0 ? (rejectRate >= 25 ? "down" : rejectRate >= 10 ? "neutral" : "up") : undefined}
            trendLabel={!authMetrics.isLoading && attempts > 0 ? `${rejectRate.toFixed(1)}% reject rate` : undefined}
            icon={<Gauge className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          />
        </div>
      </div>

      {/* Health + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AuthHealthCard
          attempts={attempts}
          accepted={accepted}
          rejected={rejected}
          isLoading={authMetrics.isLoading}
        />
        <RecentActivityCard enabled={Boolean(canSeeAudit)} />
      </div>

      {/* FUP heads-up for users over quota */}
      {fleet && fleet.monthlyExceeded > 0 ? (
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/25 animate-scale-in">
          <CardContent className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/15 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {fleet.monthlyExceeded.toLocaleString()} user{fleet.monthlyExceeded !== 1 ? "s" : ""} exceeded their monthly quota
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/70">
                  They are throttled under your fair-use policy until the next cycle reset.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/users/list?quotaExceeded=true">Review affected users</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Modules */}
      <div className="animate-slide-up stagger-4">
        <h2 className="mb-3 text-lg font-semibold">Your workspace</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {modules.map((m, i) => (
            <ModuleCard key={m.title} {...m} delay={i * 0.055} />
          ))}
        </div>
      </div>

      {/* About */}
      <Card className="border-none bg-primary/5 animate-slide-up stagger-5">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">New to RADIUS Pro?</p>
            <p className="text-sm text-muted-foreground">
              Learn about the system, version details, and what each module does.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/about">
              About &amp; documentation
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Home;
