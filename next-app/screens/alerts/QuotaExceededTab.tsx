import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import QueryState from "@/components/QueryState";
import { apiClient } from "@/api/client";
import { QuotaExceededAlert, type FupAccountRow } from "@/components/ui/Alert";
import LoadingSpinner from "./LoadingSpinner";

type Props = {
  /** Only fetch while the tab is visible. */
  active: boolean;
};

/** "Quota Exceeded" tab: FUP accounts that ran over their daily or monthly quota. Owns its own query. */
const QuotaExceededTab: React.FC<Props> = ({ active }) => {
  const now = useMemo(() => new Date(), []);
  const monthLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dayLabel = now.toISOString().slice(0, 10);

  const quotaExceededQuery = useQuery({
    queryKey: ["users", "quota-exceeded", "rows"],
    queryFn: async () => {
      const resp = await apiClient.get("/radius/users/quota-exceeded", { params: { includeRows: 1 } });
      return resp?.data?.data as {
        totalUsers: number;
        monthlyCount: number;
        dailyCount: number;
        monthlyAccounts?: FupAccountRow[];
        dailyAccounts?: FupAccountRow[];
      };
    },
    enabled: active,
    refetchInterval: 60000,
  });

  return (
    <QueryState
      isLoading={quotaExceededQuery.isLoading}
      error={quotaExceededQuery.error as any}
      isEmpty={
        !quotaExceededQuery.isLoading &&
        !quotaExceededQuery.error &&
        ((quotaExceededQuery.data?.monthlyAccounts?.length ?? 0) + (quotaExceededQuery.data?.dailyAccounts?.length ?? 0) === 0)
      }
      onRetry={() => quotaExceededQuery.refetch()}
      loading={<LoadingSpinner />}
      errorTitle="Failed to load quota exceeded users"
      emptyTitle="No quota exceeded users"
      emptyDescription="No users exceeded their daily or monthly quota."
    >
      <QuotaExceededAlert
        monthLabel={monthLabel}
        dayLabel={dayLabel}
        monthlyAccounts={quotaExceededQuery.data?.monthlyAccounts ?? []}
        dailyAccounts={quotaExceededQuery.data?.dailyAccounts ?? []}
        totalUsers={quotaExceededQuery.data?.totalUsers}
        className="rounded-md"
      />
    </QueryState>
  );
};

export default QuotaExceededTab;
