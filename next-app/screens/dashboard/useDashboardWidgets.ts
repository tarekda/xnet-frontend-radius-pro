import { useMemo } from "react";
import {
  Users,
  UserCheck,
  Shield,
  AlertTriangle,
  Activity,
  Bell,
  Receipt,
  DollarSign,
  Landmark,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getDashboardPersona, sortDashboardWidgets } from "@/lib/dashboardPersona";
import type { DashboardWidgetItem } from "./DashboardMiniWidget";

type WidgetInputs = {
  isReseller: boolean;
  canSeeOnline: boolean;
  canSeeExpenses: boolean;
  canSeeTotals: boolean;
  canSeeInvoiceCounts: boolean;
  canSeeCollections: boolean;
  canSeeQuotaExceeded: boolean;
  canSeeAlerts: boolean;
  canSeeCompanyWallet: boolean;
  resellerBalance: number | null;
  resellerCommissionPending: number | null;
  companyWalletBalance: number | null;
  companyWalletLoading: boolean;
  resellerUserCount: number | null;
  totalOnlineUsers: number;
  totalActiveUsers: number;
  expensesLoading: boolean;
  spendThis: number;
  spendCurrency: string;
  spendGrowth: number;
  thisMonthKey: string;
  authMetricsLoading: boolean;
  authAttempts: number;
  collectedMetricsLoading: boolean;
  totalCollectedInvoices: number;
  totalCollectedCash: number;
  fupUsersCount: number;
  quotaDailyCount: number;
  quotaMonthlyCount: number;
  alertsLoading: boolean;
  unresolvedAlertsCount: number;
  unacknowledgedAlertsCount: number;
};

/** Builds the permission-gated KPI widget list, ordered by the user's dashboard persona. */
export function useDashboardWidgets(inputs: WidgetInputs): DashboardWidgetItem[] {
  const { user } = useAuth();
  const {
    isReseller,
    canSeeOnline,
    canSeeExpenses,
    canSeeTotals,
    canSeeInvoiceCounts,
    canSeeCollections,
    canSeeQuotaExceeded,
    canSeeAlerts,
    canSeeCompanyWallet,
    resellerBalance,
    resellerCommissionPending,
    companyWalletBalance,
    companyWalletLoading,
    resellerUserCount,
    totalOnlineUsers,
    totalActiveUsers,
    expensesLoading,
    spendThis,
    spendCurrency,
    spendGrowth,
    thisMonthKey,
    authMetricsLoading,
    authAttempts,
    collectedMetricsLoading,
    totalCollectedInvoices,
    totalCollectedCash,
    fupUsersCount,
    quotaDailyCount,
    quotaMonthlyCount,
    alertsLoading,
    unresolvedAlertsCount,
    unacknowledgedAlertsCount,
  } = inputs;

  const dashboardWidgets = useMemo(() => {
    const items: DashboardWidgetItem[] = [];

    if (canSeeCompanyWallet) {
      items.push({
        key: "company-wallet",
        title: "Company wallet",
        value: companyWalletLoading || companyWalletBalance === null ? "…" : companyWalletBalance.toFixed(2),
        subtitle: "Operator treasury",
        to: "/admin/company-wallet",
        icon: Landmark,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
    }

    if (isReseller) {
      items.push({
        key: "reseller-balance",
        title: "Balance",
        value: resellerBalance === null ? "…" : `${resellerBalance.toFixed(2)}`,
        subtitle: "Reseller wallet",
        to: "/dashboard/widgets/reseller-balance",
        icon: Receipt,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
      items.push({
        key: "reseller-users",
        title: "My Users",
        value: resellerUserCount === null ? "…" : String(resellerUserCount),
        subtitle: "Owned users",
        to: "/dashboard/widgets/reseller-users",
        icon: Users,
        accentClass: "text-blue-600 dark:text-blue-400",
        glowClass: "bg-blue-500",
      });
      items.push({
        key: "reseller-commission",
        title: "Commission",
        value: resellerCommissionPending === null ? "…" : resellerCommissionPending.toFixed(2),
        subtitle: "Pending payout",
        to: "/dashboard",
        icon: DollarSign,
        accentClass: "text-amber-600 dark:text-amber-400",
        glowClass: "bg-amber-500",
      });
    }

    if ((!isReseller && canSeeOnline) || isReseller) {
      items.push({
        key: "live-sessions",
        title: "Live Sessions",
        value: String(totalOnlineUsers),
        subtitle: "Current online users",
        to: "/dashboard/widgets/live-sessions",
        icon: Activity,
        accentClass: "text-sky-600 dark:text-sky-400",
        glowClass: "bg-sky-500",
      });
      items.push({
        key: "active-users",
        title: "Active Users",
        value: String(totalActiveUsers),
        subtitle: "Real-time active accounts",
        to: "/dashboard/widgets/active-users",
        icon: UserCheck,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
    }

    if (canSeeExpenses && canSeeTotals) {
      items.push({
        key: "expenses-month",
        title: "Expenses",
        value: expensesLoading ? "…" : `${spendThis.toFixed(2)} ${spendCurrency}`,
        subtitle: `${thisMonthKey} (${Math.abs(spendGrowth).toFixed(1)}%)`,
        to: "/dashboard/widgets/expenses-month",
        icon: Receipt,
        accentClass: "text-indigo-600 dark:text-indigo-400",
        glowClass: "bg-indigo-500",
      });
    }

    if (canSeeInvoiceCounts) {
      items.push({
        key: "auth-requests",
        title: "Auth Requests",
        value: authMetricsLoading
          ? "…"
          : new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(authAttempts),
        subtitle: "Past 24h attempts",
        to: "/dashboard/widgets/auth-requests",
        icon: Shield,
        accentClass: "text-violet-600 dark:text-violet-400",
        glowClass: "bg-violet-500",
      });
    }

    if (canSeeCollections) {
      items.push({
        key: "total-invoices-collected",
        title: "Invoices Collected",
        value: collectedMetricsLoading ? "…" : totalCollectedInvoices.toLocaleString(),
        subtitle: "Per-collector breakdown",
        to: "/collections?view=breakdown",
        icon: Receipt,
        accentClass: "text-blue-600 dark:text-blue-400",
        glowClass: "bg-blue-500",
      });
      items.push({
        key: "total-cash-collected",
        title: "Cash Collected",
        value: collectedMetricsLoading ? "…" : totalCollectedCash.toFixed(2),
        subtitle: "Collected invoices list",
        to: "/collections?view=list",
        icon: DollarSign,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
      });
    }

    if (canSeeQuotaExceeded) {
      items.push({
        key: "fup-users",
        title: "Users in FUP",
        value: String(fupUsersCount),
        subtitle: `${quotaDailyCount} daily / ${quotaMonthlyCount} monthly`,
        to: "/dashboard/widgets/fup-users",
        icon: AlertTriangle,
        accentClass: "text-amber-600 dark:text-amber-400",
        glowClass: "bg-amber-500",
      });
    }

    if (canSeeAlerts) {
      items.push({
        key: "active-alerts",
        title: "Active Alerts",
        value: alertsLoading ? "…" : String(unresolvedAlertsCount),
        subtitle: `${unacknowledgedAlertsCount} unacknowledged`,
        to: "/dashboard/widgets/active-alerts",
        icon: Bell,
        accentClass: "text-red-600 dark:text-red-400",
        glowClass: "bg-red-500",
      });
    }

    return items;
  }, [
    alertsLoading,
    authAttempts,
    authMetricsLoading,
    canSeeAlerts,
    canSeeCollections,
    canSeeCompanyWallet,
    canSeeExpenses,
    canSeeInvoiceCounts,
    canSeeOnline,
    canSeeQuotaExceeded,
    canSeeTotals,
    collectedMetricsLoading,
    companyWalletBalance,
    companyWalletLoading,
    expensesLoading,
    fupUsersCount,
    isReseller,
    quotaDailyCount,
    quotaMonthlyCount,
    resellerBalance,
    resellerCommissionPending,
    resellerUserCount,
    spendCurrency,
    spendGrowth,
    spendThis,
    thisMonthKey,
    totalCollectedCash,
    totalCollectedInvoices,
    totalActiveUsers,
    totalOnlineUsers,
    unacknowledgedAlertsCount,
    unresolvedAlertsCount,
  ]);

  const dashboardPersona = useMemo(() => getDashboardPersona(user), [user]);
  return useMemo(
    () => sortDashboardWidgets(dashboardWidgets, dashboardPersona),
    [dashboardPersona, dashboardWidgets]
  );
}
