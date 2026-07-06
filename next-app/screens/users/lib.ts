import { isUserAtRisk } from "@/lib/userHealth";
import type { User } from "@/types/api";
import type { AdvancedFiltersState } from "./usersPageReducer";

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

export type LocalUsersMetrics = {
  total: number;
  active: number;
  suspended: number;
  online: number;
  offline: number;
  quotaExceeded: number;
  riskUsers: number;
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
  };
}
