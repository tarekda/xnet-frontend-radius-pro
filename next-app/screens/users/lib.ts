import { isUserAtRisk } from "@/lib/userHealth";
import type { User } from "@/types/api";
import type { SortingState } from "@tanstack/react-table";
import type { AdvancedFiltersState } from "./usersPageReducer";

/**
 * Maps a table column id to the backend `sortBy` value.
 * Only columns backed by a server-side sort are listed; any other column is
 * sorted client-side over the current page.
 */
export const USERS_SERVER_SORT_BY: Record<string, string> = {
  id: "id",
  username: "username",
  expiresAt: "expiresAt",
  accountStatus: "accountStatus",
  "profile.profileName": "profileName",
  "macAddress.macAddress": "macAddress",
};

/** True when the active sorting column is sorted by the server. */
export function isServerSortColumn(sorting: SortingState): boolean {
  const id = sorting[0]?.id;
  return Boolean(id && USERS_SERVER_SORT_BY[id]);
}

/** Backend sort params for the active column, or `{}` for client-only columns. */
export function toServerSortParams(sorting: SortingState): { sortBy?: string; sortDir?: "asc" | "desc" } {
  const first = sorting[0];
  const sortBy = first ? USERS_SERVER_SORT_BY[first.id] : undefined;
  if (!sortBy) return {};
  return { sortBy, sortDir: first.desc ? "desc" : "asc" };
}

export const STATUS_SEGMENTS: Array<{
  key: string;
  label: string;
  barClass: string;
  dotClass: string;
}> = [
  { key: "active", label: "Active", barClass: "bg-emerald-500/85 hover:bg-emerald-500", dotClass: "bg-emerald-500" },
  { key: "suspended", label: "Suspended", barClass: "bg-red-500/85 hover:bg-red-500", dotClass: "bg-red-500" },
  { key: "inactive", label: "Inactive", barClass: "bg-slate-400/85 hover:bg-slate-400", dotClass: "bg-slate-400" },
  { key: "expired", label: "Expired", barClass: "bg-amber-500/85 hover:bg-amber-500", dotClass: "bg-amber-500" },
  { key: "terminated", label: "Terminated", barClass: "bg-zinc-600/85 hover:bg-zinc-600", dotClass: "bg-zinc-600" },
];

/** Account status implied by the combined quick-filter + advanced-filter state. */
export function effectiveAccountStatus(statusFilter: string, filters: AdvancedFiltersState): string {
  return (
    filters.accountStatus ||
    (statusFilter === "active" || statusFilter === "suspended" ? statusFilter : "")
  );
}

export function filterUsers(
  users: User[],
  statusFilter: string,
  filters: AdvancedFiltersState
): User[] {
  let filtered = users;

  const account = effectiveAccountStatus(statusFilter, filters);
  if (account) {
    const want = account.toLowerCase();
    filtered = filtered.filter((user) => String(user.accountStatus ?? "").toLowerCase() === want);
  }

  // Connectivity / risk / profile quick filters (not account status)
  if (statusFilter && !["active", "suspended"].includes(statusFilter)) {
    filtered = filtered.filter((user) => {
      switch (statusFilter) {
        case "risk":
          return isUserAtRisk(user);
        case "expiring_soon": {
          if (!user.expiresAt) return false;
          const exp = new Date(user.expiresAt).getTime();
          return exp <= Date.now() + 3 * 24 * 60 * 60 * 1000;
        }
        case "online":
          return user.isOnline === true;
        case "offline":
          return user.isOnline === false;
        case "profile:premium":
          return user.profile.profileName.toLowerCase() === "premium";
        case "profile:basic":
          return user.profile.profileName.toLowerCase() === "basic";
        default:
          return true;
      }
    });
  }

  if (filters.profile && filters.profile !== "all") {
    filtered = filtered.filter(
      (user) => user.profile.profileName.toLowerCase() === filters.profile.toLowerCase()
    );
  }
  if (filters.quotaExceeded) {
    filtered = filtered.filter((user) => user.isMonthlyExceeded);
  }
  if (filters.hasMacAddress) {
    filtered = filtered.filter((user) => user.macAddress?.macAddress);
  }
  if (filters.hasContactInfo) {
    filtered = filtered.filter((user) => user.userDetails?.email || user.userDetails?.phoneNumber);
  }

  return filtered;
}

export type ExpiryInfo = {
  status: "expired" | "expiring_today" | "expiring_soon" | "active" | "no_expiry";
  label: string;
  sublabel: string;
  badgeTone: "danger" | "warning" | "success" | "neutral";
  daysRemaining: number | null;
};

export function getExpiryInfo(expiresAt?: string | null): ExpiryInfo {
  if (!expiresAt) {
    return {
      status: "no_expiry",
      label: "No Expiry",
      sublabel: "Unlimited duration",
      badgeTone: "neutral",
      daysRemaining: null,
    };
  }

  const expDate = new Date(expiresAt);
  if (Number.isNaN(expDate.getTime())) {
    return {
      status: "no_expiry",
      label: "Invalid Date",
      sublabel: String(expiresAt),
      badgeTone: "neutral",
      daysRemaining: null,
    };
  }

  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const formattedDate = expDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (diffDays < 0) {
    const pastDays = Math.abs(diffDays);
    return {
      status: "expired",
      label: pastDays === 0 ? "Expired today" : `Expired ${pastDays}d ago`,
      sublabel: formattedDate,
      badgeTone: "danger",
      daysRemaining: diffDays,
    };
  }

  if (diffDays === 0) {
    return {
      status: "expiring_today",
      label: "Expires today",
      sublabel: formattedDate,
      badgeTone: "warning",
      daysRemaining: 0,
    };
  }

  if (diffDays <= 3) {
    return {
      status: "expiring_soon",
      label: `Expires in ${diffDays}d`,
      sublabel: formattedDate,
      badgeTone: "warning",
      daysRemaining: diffDays,
    };
  }

  return {
    status: "active",
    label: `${diffDays}d remaining`,
    sublabel: formattedDate,
    badgeTone: "success",
    daysRemaining: diffDays,
  };
}

export type LocalUsersMetrics = {
  total: number;
  active: number;
  suspended: number;
  online: number;
  offline: number;
  quotaExceeded: number;
  riskUsers: number;
  expiringSoon: number;
};

/** Metrics for the currently loaded page (fallback when fleet metrics are unavailable). */
export function computeLocalMetrics(allUsers: User[], filteredUsers: User[]): LocalUsersMetrics {
  return {
    total: allUsers.length,
    active: filteredUsers.filter((u) => u.accountStatus === "active").length,
    suspended: filteredUsers.filter((u) => u.accountStatus === "suspended").length,
    online: filteredUsers.filter((u) => u.isOnline).length,
    offline: filteredUsers.filter((u) => !u.isOnline).length,
    quotaExceeded: filteredUsers.filter((u) => u.isMonthlyExceeded).length,
    riskUsers: filteredUsers.filter(isUserAtRisk).length,
    expiringSoon: filteredUsers.filter((u) => {
      if (!u.expiresAt) return false;
      const exp = new Date(u.expiresAt).getTime();
      return exp <= Date.now() + 3 * 24 * 60 * 60 * 1000;
    }).length,
  };
}
