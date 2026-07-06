import { apiClient } from "@/api/client";
import type { User } from "@/types/api";

export type UsersFleetMetrics = {
  total: number;
  online: number;
  monthlyExceeded: number;
  byStatus: Record<string, number>;
  trends: {
    onlineDaily: Array<{ day: string; count: number }>;
    newUsersWeekly: Array<{ week: string; count: number }>;
  };
};

export type AuditLogRow = {
  id: number;
  message: string;
  meta: unknown;
  timestamp: string;
};

export type BulkCreateUserInput = {
  username: string;
  password: string;
  profileId: number;
  accountStatus?: string;
  fullName?: string;
  address?: string;
  phoneNumber?: string;
  email?: string;
};

export type BulkCreateResult = {
  created: number;
  failed: number;
  results?: Array<{ username: string; ok: boolean; error?: string }>;
};

/** Fleet-wide metrics (all pages, reseller-scoped server side). */
export async function fetchFleetMetrics(): Promise<UsersFleetMetrics | null> {
  const resp = await apiClient.get("/radius/users/metrics");
  return (resp?.data?.data ?? null) as UsersFleetMetrics | null;
}

/** Recent audit-log entries for user actions. */
export async function fetchRecentUsersAudit(limit = 8): Promise<AuditLogRow[]> {
  const resp = await apiClient.get("/audit", { params: { limit, actionPrefix: "users." } });
  const rows = (resp?.data?.data ?? []) as AuditLogRow[];
  return Array.isArray(rows) ? rows : [];
}

/** Walk every page of the users list (used for full exports). */
export async function fetchAllUsers(pageSize = 500): Promise<User[]> {
  let page = 1;
  let totalPages = 1;
  const all: User[] = [];

  while (page <= totalPages) {
    const resp = await apiClient.get("/radius/users", { params: { page, pageSize } });
    const payload = resp?.data?.data;
    const users = (payload?.users ?? []) as User[];
    all.push(...users);
    totalPages = Number(payload?.totalPages ?? 1);
    page += 1;
  }

  return all;
}

export async function bulkCreateUsers(users: BulkCreateUserInput[]): Promise<BulkCreateResult> {
  const resp = await apiClient.post("/radius/users/bulk/create", { users });
  return {
    created: Number(resp?.data?.data?.created ?? 0),
    failed: Number(resp?.data?.data?.failed ?? 0),
    results: resp?.data?.data?.results as BulkCreateResult["results"],
  };
}

/** Returns the number of users updated. */
export async function bulkSetStatus(
  usernames: string[],
  accountStatus: "active" | "suspended"
): Promise<number> {
  const resp = await apiClient.post("/radius/users/bulk/set-status", {
    usernames,
    accountStatus,
    dryRun: false,
  });
  return Number(resp?.data?.data?.updated ?? usernames.length);
}

/** Returns the number of MAC bindings deleted. */
export async function bulkResetMac(usernames: string[]): Promise<number> {
  const resp = await apiClient.post("/radius/users/bulk/reset-mac", {
    usernames,
    dryRun: false,
  });
  return Number(resp?.data?.data?.deleted ?? resp?.data?.data?.willDelete ?? 0);
}

/** Returns the number of users updated. */
export async function bulkAssignProfile(usernames: string[], profileId: number): Promise<number> {
  const resp = await apiClient.post("/radius/users/bulk/assign-profile", {
    usernames,
    profileId,
    dryRun: false,
  });
  return Number(resp?.data?.data?.updated ?? usernames.length);
}

/** Returns the number of users deleted. */
export async function bulkDeleteUsers(usernames: string[]): Promise<number> {
  const resp = await apiClient.post("/radius/users/bulk/delete", {
    usernames,
    dryRun: false,
  });
  return Number(resp?.data?.data?.deleted ?? 0);
}

export async function resetDailyQuota(username: string): Promise<void> {
  await apiClient.put(`/radius/users/resetQuota/${encodeURIComponent(username)}`);
}

export async function resetMonthlyQuota(username: string): Promise<void> {
  await apiClient.put(`/radius/users/resetMonthlyQuota/${encodeURIComponent(username)}`);
}
