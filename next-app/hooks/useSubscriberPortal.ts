"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import {
  fetchSubscriberInvoiceClaims,
  fetchSubscriberInvoices,
  fetchSubscriberMe,
  fetchSubscriberPaymentProvider,
  fetchSubscriberSessions,
  fetchSubscriberUsage,
  fetchSubscriberWalletLedger,
  restoreSubscriberSession,
  subscriberLogin,
  subscriberLogout,
  type PaymentClaim,
} from "@/api/subscriber";

const PORTAL_KEYS = {
  me: ["subscriber", "me"] as const,
  usage: ["subscriber", "usage"] as const,
  invoices: ["subscriber", "invoices"] as const,
  sessions: ["subscriber", "sessions"] as const,
  provider: ["subscriber", "payment-provider"] as const,
  ledger: ["subscriber", "wallet-ledger"] as const,
};

export function useSubscriberPortal() {
  const qc = useQueryClient();
  const [authed, setAuthed] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    restoreSubscriberSession()
      .then((ok) => {
        if (!cancelled) setAuthed(ok);
      })
      .finally(() => {
        if (!cancelled) setBootstrapping(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meQuery = useQuery({
    queryKey: PORTAL_KEYS.me,
    queryFn: fetchSubscriberMe,
    enabled: authed,
    retry: false,
  });
  const usageQuery = useQuery({
    queryKey: PORTAL_KEYS.usage,
    queryFn: fetchSubscriberUsage,
    enabled: authed,
    retry: 1,
  });
  const invoicesQuery = useQuery({
    queryKey: PORTAL_KEYS.invoices,
    queryFn: fetchSubscriberInvoices,
    enabled: authed,
    retry: 1,
  });
  const sessionsQuery = useQuery({
    queryKey: PORTAL_KEYS.sessions,
    queryFn: () => fetchSubscriberSessions(5),
    enabled: authed,
    retry: 1,
  });
  const providerQuery = useQuery({
    queryKey: PORTAL_KEYS.provider,
    queryFn: fetchSubscriberPaymentProvider,
    enabled: authed,
    retry: 1,
  });
  const ledgerQuery = useQuery({
    queryKey: PORTAL_KEYS.ledger,
    queryFn: () => fetchSubscriberWalletLedger(20),
    enabled: authed,
    retry: 1,
  });

  useEffect(() => {
    if (meQuery.isError) setAuthed(false);
  }, [meQuery.isError]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.me }),
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.usage }),
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.invoices }),
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.sessions }),
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.provider }),
      qc.invalidateQueries({ queryKey: PORTAL_KEYS.ledger }),
    ]);
  }, [qc]);

  const login = useCallback(async (username: string, password: string) => {
    const data = await subscriberLogin(username.trim(), password);
    if (!data?.success) throw new Error(data?.message || "Login failed");
    setAuthed(true);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await subscriberLogout();
    } catch {
      /* ignore */
    }
    setAuthed(false);
    qc.removeQueries({ queryKey: ["subscriber"] });
  }, [qc]);

  const loading =
    bootstrapping ||
    (authed &&
      (meQuery.isLoading ||
        usageQuery.isLoading ||
        invoicesQuery.isLoading));

  return {
    authed,
    bootstrapping,
    loading,
    me: meQuery.data ?? null,
    usage: usageQuery.data ?? null,
    invoices: invoicesQuery.data ?? [],
    sessions: sessionsQuery.data ?? [],
    provider: providerQuery.data ?? null,
    walletLedger: ledgerQuery.data ?? [],
    login,
    logout,
    refreshAll,
  };
}

export function useSubscriberInvoiceClaims(invoiceId: number | null, enabled: boolean) {
  return useQuery<PaymentClaim[]>({
    queryKey: ["subscriber", "invoice-claims", invoiceId],
    queryFn: () => fetchSubscriberInvoiceClaims(invoiceId as number),
    enabled: enabled && invoiceId != null,
    staleTime: 15_000,
  });
}
