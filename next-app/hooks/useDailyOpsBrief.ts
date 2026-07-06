import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type OpsBriefSeverity = "ok" | "warning" | "critical";

export type DailyOpsBrief = {
  generatedAt: string;
  severity: OpsBriefSeverity;
  summary: string;
  aiEnhanced: boolean;
  metrics: {
    usersWithRecentRejects: number;
    offlineWithRecentRejects: number;
    quotaExceeded: number;
    accountIssues: number;
    overdueInvoices: number;
    overdueInvoiceAmount: number;
    missingPayDueInvoices: number;
    authAttempts24h: number;
    authRejected24h: number;
    authRejectRate24h: number;
  };
  highlights: Array<{ code: string; severity: "info" | "warning" | "critical"; message: string; count?: number }>;
  usersWithRecentRejects: Array<{
    username: string;
    rejectCount: number;
    lastRejectAt: string | null;
    isOnline: boolean;
  }>;
  topNasAuthFailures: Array<{ nasIp: string; nasLabel: string; failures: number }>;
  recentRejectUsernames: Record<string, number>;
};

async function fetchDailyOpsBrief(): Promise<DailyOpsBrief> {
  const resp = await apiClient.get("/ai/ops/daily-brief");
  return resp?.data?.data as DailyOpsBrief;
}

export function useDailyOpsBrief(enabled = true) {
  return useQuery({
    queryKey: ["dailyOpsBrief"],
    queryFn: fetchDailyOpsBrief,
    enabled,
    refetchInterval: 120000,
    staleTime: 60000,
  });
}

async function fetchRecentRejectUsers(hours = 24): Promise<Record<string, number>> {
  const resp = await apiClient.get("/ai/ops/recent-reject-users", { params: { hours } });
  return (resp?.data?.data?.recentRejectUsernames ?? {}) as Record<string, number>;
}

export function useRecentRejectUsers(enabled = true, hours = 24) {
  return useQuery({
    queryKey: ["recentRejectUsers", hours],
    queryFn: () => fetchRecentRejectUsers(hours),
    enabled,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}
