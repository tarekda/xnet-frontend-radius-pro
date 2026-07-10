import { useEffect, useState } from "react";
import { fetchResellerMe } from "@/api/resellers";
import { apiClient } from "@/api/client";

/** Reseller dashboard data: wallet balance plus scoped user/online counts. */
export function useResellerSummary(isReseller: boolean) {
  const [balance, setBalance] = useState<number | null>(null);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isReseller) return;

    (async () => {
      try {
        const me = await fetchResellerMe();
        if (cancelled) return;
        setBalance(Number(me.balance ?? 0));
      } catch {
        // ignore; backend will enforce anyway
      }

      try {
        const resp = await apiClient.get('/radius/users', { params: { page: 1, pageSize: 1 } });
        const total = resp?.data?.data?.totalUsers ?? resp?.data?.data?.total ?? 0;
        if (cancelled) return;
        setUserCount(Number(total) || 0);
      } catch {
        // ignore
      }

      try {
        const resp = await apiClient.get('/online-users-metrics');
        if (cancelled) return;
        const d = resp?.data?.data;
        const n = Number(d?.totalOnlineUsers ?? 0);
        setOnlineCount(Number.isFinite(n) ? n : 0);
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReseller]);

  return { balance, userCount, onlineCount };
}
