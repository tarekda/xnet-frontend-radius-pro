import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type DiagnosisSeverity = "ok" | "warning" | "critical";

export type DiagnosisFinding = {
  code: string;
  severity: "info" | "warning" | "critical";
  message: string;
  evidence?: string;
};

export type DiagnosisAction = {
  action: string;
  description: string;
  priority: number;
  tabHint?: "actions" | "sessions" | "overview";
};

export type ConnectivityDiagnosisResult = {
  username: string;
  generatedAt: string;
  severity: DiagnosisSeverity;
  summary: string;
  findings: DiagnosisFinding[];
  recommendedActions: DiagnosisAction[];
  context: {
    accountStatus: string | null;
    profileName: string | null;
    isOnline: boolean;
    macAddress: string | null;
    expiresAt: string | null;
    isMonthlyExceeded: boolean;
    monthlyUsagePct: number | null;
    recentRejectCount: number;
    lastRejectAt: string | null;
    liveSession: {
      nasIpAddress: string | null;
      framedIpAddress: string | null;
      sessionTimeSeconds: number | null;
    } | null;
  };
  aiEnhanced: boolean;
};

async function diagnoseConnectivity(username: string): Promise<ConnectivityDiagnosisResult> {
  const resp = await apiClient.post(`/ai/ops/diagnose/${encodeURIComponent(username)}`);
  return resp?.data?.data as ConnectivityDiagnosisResult;
}

export function useConnectivityDiagnosis(username: string) {
  return useMutation({
    mutationFn: () => diagnoseConnectivity(username),
  });
}
