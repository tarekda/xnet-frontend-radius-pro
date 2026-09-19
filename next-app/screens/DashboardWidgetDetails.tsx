import React, { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bell,
  Clock,
  DollarSign,
  Receipt,
  Shield,
  UserCheck,
  Users,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useOnlineMetrics } from "@/hooks/useOnlineMetrics";
import { useExpenseMonthlyTotals } from "@/hooks/useExpenses";
import { useAuthMetrics } from "@/hooks/useAuthMetrics";
import { useAlerts } from "@/hooks/useAlerts";
import { apiClient } from "@/api/client";
import { fetchResellerMe } from "@/api/resellers";

type WidgetKey =
  | "reseller-balance"
  | "reseller-users"
  | "live-sessions"
  | "active-users"
  | "expenses-month"
  | "auth-requests"
  | "fup-users"
  | "active-alerts";

const WIDGETS: Record<WidgetKey, { title: string; subtitle: string; icon: React.ElementType; ctaTo: string; ctaLabel: string; valueClassName: string }> = {
  "reseller-balance": {
    title: "Reseller Balance",
    subtitle: "Wallet and credit visibility for this reseller account.",
    icon: Receipt,
    ctaTo: "/users/list",
    ctaLabel: "Open Users",
    valueClassName: "text-emerald-600",
  },
  "reseller-users": {
    title: "Reseller Users",
    subtitle: "Accounts owned by this reseller.",
    icon: Users,
    ctaTo: "/users/list",
    ctaLabel: "Open Users",
    valueClassName: "text-blue-600",
  },
  "live-sessions": {
    title: "Live Sessions",
    subtitle: "Current online sessions snapshot.",
    icon: Activity,
    ctaTo: "/online-users",
    ctaLabel: "Open Live Sessions",
    valueClassName: "text-blue-600",
  },
  "active-users": {
    title: "Active Users",
    subtitle: "Currently active user footprint.",
    icon: UserCheck,
    ctaTo: "/users/list",
    ctaLabel: "Open Users",
    valueClassName: "text-green-600",
  },
  "expenses-month": {
    title: "Expenses (This Month)",
    subtitle: "Monthly spend with growth context.",
    icon: DollarSign,
    ctaTo: "/expenses",
    ctaLabel: "Open Expenses",
    valueClassName: "text-indigo-600",
  },
  "auth-requests": {
    title: "Auth Requests (24h)",
    subtitle: "Authentication traffic volume and quality.",
    icon: Shield,
    ctaTo: "/auth-failures",
    ctaLabel: "Open Auth Failures",
    valueClassName: "text-purple-600",
  },
  "fup-users": {
    title: "Users in FUP",
    subtitle: "Users currently constrained by quota policy.",
    icon: AlertTriangle,
    ctaTo: "/users/list",
    ctaLabel: "Open Users",
    valueClassName: "text-amber-600",
  },
  "active-alerts": {
    title: "Active Alerts",
    subtitle: "Open alerts requiring operational attention.",
    icon: Bell,
    ctaTo: "/alerts",
    ctaLabel: "Open Alerts",
    valueClassName: "text-red-600",
  },
};

const DetailsMiniWidget = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "text-foreground",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  valueClassName?: string;
}) => (
  <div className="rounded-lg border p-3">
    <div className="flex items-center justify-between">
      <span className="text-[11px] sm:text-xs text-muted-foreground">{title}</span>
      <Icon className={`h-4 w-4 ${valueClassName}`} />
    </div>
    <div className={`mt-1 text-base sm:text-lg font-semibold ${valueClassName}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
  </div>
);

export default function DashboardWidgetDetailsPage() {
  const { widgetKey } = useParams<{ widgetKey: WidgetKey }>();
  const cfg = widgetKey ? WIDGETS[widgetKey as WidgetKey] : undefined;
  const { user } = useAuth();
  const isReseller = user?.role === "reseller";

  const onlineMetrics = useOnlineMetrics();
  const authMetrics = useAuthMetrics(86400);
  const { data: alerts } = useAlerts();
  const expenseMonthlyTotals = useExpenseMonthlyTotals();

  const resellerMeQuery = useQuery({
    queryKey: ["reseller", "me", "widget-details"],
    queryFn: fetchResellerMe,
    enabled: isReseller,
  });
  const resellerUsersQuery = useQuery({
    queryKey: ["reseller", "users-count", "widget-details"],
    queryFn: async () => {
      const resp = await apiClient.get("/radius/users", { params: { page: 1, pageSize: 1 } });
      return Number(resp?.data?.data?.totalUsers ?? 0);
    },
    enabled: isReseller,
  });
  const quotaExceededQuery = useQuery({
    queryKey: ["users", "quota-exceeded", "widget-details"],
    queryFn: async () => {
      const resp = await apiClient.get("/radius/users/quota-exceeded");
      return resp?.data?.data as { totalUsers: number; monthlyCount: number; dailyCount: number };
    },
  });

  const alertsList = Array.isArray(alerts) ? alerts : [];
  const unresolvedAlerts = alertsList.filter((a: any) => !a.resolved);
  const unacknowledgedAlerts = unresolvedAlerts.filter((a: any) => !a.acknowledged);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const mt = expenseMonthlyTotals.data?.data || [];
  const thisMonth = mt.find((m) => m.month === thisMonthKey);
  const prevMonth = mt.find((m) => m.month === prevMonthKey);
  const spendThis = thisMonth?.totalAmount ?? 0;
  const spendPrev = prevMonth?.totalAmount ?? 0;
  const spendCurrency = thisMonth?.currency || mt[0]?.currency || "USD";
  const spendGrowth = spendPrev > 0 ? ((spendThis - spendPrev) / spendPrev) * 100 : (spendThis > 0 ? 100 : 0);

  const details = useMemo(() => {
    if (!widgetKey || !cfg) return null;
    switch (widgetKey as WidgetKey) {
      case "reseller-balance":
        return {
          value: resellerMeQuery.isLoading ? "…" : Number(resellerMeQuery.data?.balance ?? 0).toFixed(2),
          rows: [
            { label: "Currency", value: "USD" },
            { label: "Role", value: "Reseller" },
            { label: "Status", value: resellerMeQuery.isLoading ? "Loading" : "Ready" },
          ],
        };
      case "reseller-users":
        return {
          value: resellerUsersQuery.isLoading ? "…" : String(resellerUsersQuery.data ?? 0),
          rows: [
            { label: "Scope", value: "Owned users" },
            { label: "Source", value: "Radius users" },
            { label: "Status", value: resellerUsersQuery.isLoading ? "Loading" : "Ready" },
          ],
        };
      case "live-sessions":
        return {
          value: String(onlineMetrics.totalOnlineUsers ?? 0),
          rows: [
            { label: "Online users", value: String(onlineMetrics.totalOnlineUsers ?? 0) },
            { label: "Active users", value: String(onlineMetrics.totalActiveUsers ?? 0) },
            { label: "Refresh cadence", value: "Near real-time" },
          ],
        };
      case "active-users":
        return {
          value: String(onlineMetrics.totalActiveUsers ?? 0),
          rows: [
            { label: "Active users", value: String(onlineMetrics.totalActiveUsers ?? 0) },
            { label: "Online users", value: String(onlineMetrics.totalOnlineUsers ?? 0) },
            { label: "Source", value: "Online metrics" },
          ],
        };
      case "expenses-month":
        return {
          value: `${spendThis.toFixed(2)} ${spendCurrency}`,
          rows: [
            { label: "Month", value: thisMonthKey },
            { label: "Previous month", value: `${spendPrev.toFixed(2)} ${spendCurrency}` },
            { label: "Growth", value: `${Math.abs(spendGrowth).toFixed(1)}%` },
          ],
        };
      case "auth-requests":
        return {
          value: authMetrics.isLoading
            ? "…"
            : new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(authMetrics.data?.current.attempts ?? 0),
          rows: [
            { label: "Attempts", value: String(authMetrics.data?.current.attempts ?? 0) },
            { label: "Accepted", value: String(authMetrics.data?.current.accepted ?? 0) },
            { label: "Rejected", value: String(authMetrics.data?.current.rejected ?? 0) },
          ],
        };
      case "fup-users":
        return {
          value: String((quotaExceededQuery.data?.dailyCount ?? 0) + (quotaExceededQuery.data?.monthlyCount ?? 0)),
          rows: [
            { label: "Daily exceeded", value: String(quotaExceededQuery.data?.dailyCount ?? 0) },
            { label: "Monthly exceeded", value: String(quotaExceededQuery.data?.monthlyCount ?? 0) },
            { label: "Total users scanned", value: String(quotaExceededQuery.data?.totalUsers ?? 0) },
          ],
        };
      case "active-alerts":
        return {
          value: String(unresolvedAlerts.length),
          rows: [
            { label: "Unacknowledged", value: String(unacknowledgedAlerts.length) },
            { label: "Resolved hidden", value: String(alertsList.length - unresolvedAlerts.length) },
            { label: "Source", value: "Alerts service" },
          ],
        };
      default:
        return null;
    }
  }, [
    alertsList.length,
    authMetrics.data?.current.accepted,
    authMetrics.data?.current.attempts,
    authMetrics.data?.current.rejected,
    authMetrics.isLoading,
    cfg,
    quotaExceededQuery.data?.dailyCount,
    quotaExceededQuery.data?.monthlyCount,
    quotaExceededQuery.data?.totalUsers,
    resellerMeQuery.data?.balance,
    resellerMeQuery.isLoading,
    resellerUsersQuery.data,
    resellerUsersQuery.isLoading,
    spendCurrency,
    spendGrowth,
    spendPrev,
    spendThis,
    thisMonthKey,
    unacknowledgedAlerts.length,
    unresolvedAlerts.length,
    widgetKey,
    onlineMetrics.totalActiveUsers,
    onlineMetrics.totalOnlineUsers,
  ]);

  if (!cfg || !details) {
    return (
      <div className="w-full space-y-4 py-2 sm:py-2 px-2 sm:px-0">
        <PageHeader
          title="Widget Not Found"
          subtitle="This dashboard widget detail does not exist."
          icon={AlertCircle}
          actions={(
            <IconActionButton
              label="Back to Dashboard"
              to="/dashboard"
              icon={<ArrowLeft className="h-4 w-4" />}
            />
          )}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-2 sm:py-2 px-2 sm:px-0 animate-in fade-in-50">
      <PageHeader
        title={cfg.title}
        subtitle={cfg.subtitle}
        icon={cfg.icon}
        actions={(
          <div className="flex items-center gap-2">
            <IconActionButton
              label="Back to Dashboard"
              to="/dashboard"
              icon={<ArrowLeft className="h-4 w-4" />}
            />
            <IconActionButton
              label={cfg.ctaLabel}
              to={cfg.ctaTo}
              variant="default"
              icon={<ArrowRight className="h-4 w-4" />}
            />
          </div>
        )}
      />

      <Card className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground uppercase tracking-wide">Widget Snapshot</div>
          <Badge variant="outline" className="text-xs">
            {isReseller ? "Reseller scope" : "Global scope"}
          </Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <DetailsMiniWidget
            title="Current Value"
            value={details.value}
            subtitle={cfg.title}
            icon={cfg.icon}
            valueClassName={cfg.valueClassName}
          />
          {details.rows.map((row) => (
            <DetailsMiniWidget
              key={row.label}
              title={row.label}
              value={row.value}
              subtitle="Current context"
              icon={Clock}
              valueClassName="text-foreground"
            />
          ))}
        </div>
        {widgetKey === "active-alerts" && unresolvedAlerts.length > 0 ? (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
                <Bell className="h-3.5 w-3.5 text-red-600" />
                Recent unresolved alerts
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {unresolvedAlerts.length}
              </Badge>
            </div>
            <div className="space-y-1.5">
              {unresolvedAlerts.slice(0, 5).map((a: any) => (
                <div key={String(a.id)} className="rounded-md border px-2.5 py-1.5 flex items-center justify-between text-xs">
                  <span className="truncate pr-2">{a.title || a.message || "Alert"}</span>
                  <Badge variant="outline">{a.severity || "info"}</Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {widgetKey === "auth-requests" ? (
          <div className="rounded-lg border p-3 flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 text-purple-600 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Tip: use Auth Failures page filters to inspect rejected windows in detail.
            </p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

