import type { AuthUser } from "@/types/api";
import { can } from "@/lib/permissions";

export type DashboardPersona = "noc" | "billing" | "reseller" | "general";

/** Order mini-widgets by what each persona cares about most (permissions still gate visibility). */
const WIDGET_ORDER: Record<DashboardPersona, string[]> = {
  reseller: [
    "reseller-balance",
    "reseller-users",
    "live-sessions",
    "active-users",
    "fup-users",
    "auth-requests",
    "active-alerts",
    "expenses-month",
    "total-invoices-collected",
    "total-cash-collected",
  ],
  noc: [
    "company-wallet",
    "live-sessions",
    "active-users",
    "auth-requests",
    "active-alerts",
    "fup-users",
    "total-invoices-collected",
    "total-cash-collected",
    "expenses-month",
    "reseller-balance",
    "reseller-users",
  ],
  billing: [
    "company-wallet",
    "total-invoices-collected",
    "total-cash-collected",
    "expenses-month",
    "auth-requests",
    "live-sessions",
    "active-users",
    "active-alerts",
    "fup-users",
    "reseller-balance",
    "reseller-users",
  ],
  general: [],
};

export function getDashboardPersona(user: AuthUser | null | undefined): DashboardPersona {
  if (!user) return "general";
  if (user.role === "reseller") return "reseller";

  const nocHeavy = can(user, "users.online.view");
  const billingHeavy =
    can(user, "billing.collections.view") ||
    can(user, "dashboard.widget.invoiceCounts") ||
    can(user, "dashboard.widget.totalAmount");

  if (nocHeavy && !billingHeavy) return "noc";
  if (billingHeavy && !nocHeavy) return "billing";
  if (billingHeavy) return "billing";
  return "general";
}

export function sortDashboardWidgets<T extends { key: string }>(widgets: T[], persona: DashboardPersona): T[] {
  const ord = WIDGET_ORDER[persona];
  if (!ord.length) return widgets;
  const rank = (k: string) => {
    const i = ord.indexOf(k);
    return i === -1 ? 1000 : i;
  };
  return [...widgets].sort((a, b) => rank(a.key) - rank(b.key));
}
