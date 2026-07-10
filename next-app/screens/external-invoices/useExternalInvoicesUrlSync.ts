import { useEffect, useMemo, useRef } from "react";
import type { SetURLSearchParams } from "@/navigation/urlSearchParams";
import type { DateRange } from "react-day-picker";

type UseExternalInvoicesUrlSyncParams = {
  defaultPageSize: number;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
  searchTerm: string;
  pageSize: number;
  setSearchTerm: (value: string) => void;
  setSearchInput: (value: string) => void;
  setPageSize: (value: number) => void;
  setCurrentPage: (value: number) => void;
};

export function useExternalInvoicesUrlSync({
  defaultPageSize,
  searchParams,
  setSearchParams,
  searchTerm,
  pageSize,
  setSearchTerm,
  setSearchInput,
  setPageSize,
  setCurrentPage,
}: UseExternalInvoicesUrlSyncParams): { dateRange: DateRange | undefined } {
  const latestStateRef = useRef({ searchTerm, pageSize });

  useEffect(() => {
    latestStateRef.current = { searchTerm, pageSize };
  }, [searchTerm, pageSize]);

  const dateRange = useMemo(() => {
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");
    if (!fromStr || !toStr) return undefined;
    const from = new Date(`${fromStr}T00:00:00`);
    const to = new Date(`${toStr}T00:00:00`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined;
    return { from, to };
  }, [searchParams]);

  // Initialize state from URL/localStorage.
  useEffect(() => {
    const q = searchParams.get("q") ?? localStorage.getItem("externalInvoices.search") ?? "";
    const psStr = searchParams.get("ps") ?? localStorage.getItem("externalInvoices.pageSize") ?? String(defaultPageSize);
    const ps = parseInt(psStr, 10) || defaultPageSize;
    setSearchTerm(q);
    setSearchInput(q);
    setPageSize(ps);

    // Restore from/to/status from localStorage if missing in URL.
    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const urlStatus = searchParams.get("status");
    const lsFrom = localStorage.getItem("externalInvoices.from") || undefined;
    const lsTo = localStorage.getItem("externalInvoices.to") || undefined;
    const lsStatus = localStorage.getItem("externalInvoices.status") || undefined;
    if ((!urlFrom && lsFrom) || (!urlTo && lsTo) || (!urlStatus && lsStatus)) {
      const next = new URLSearchParams(searchParams);
      if (!urlFrom && lsFrom) next.set("from", lsFrom);
      if (!urlTo && lsTo) next.set("to", lsTo);
      if (!urlStatus && lsStatus) next.set("status", lsStatus);
      setSearchParams(next, { replace: true } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist search + page size into URL/localStorage.
  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (searchTerm) next.set("q", searchTerm);
        else next.delete("q");
        if (pageSize) next.set("ps", String(pageSize));
        else next.delete("ps");
        return next;
      },
      { replace: true } as any
    );
    localStorage.setItem("externalInvoices.search", searchTerm);
    localStorage.setItem("externalInvoices.pageSize", String(pageSize));
  }, [searchTerm, pageSize, setSearchParams]);

  // Persist URL filters to localStorage.
  useEffect(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    if (from) localStorage.setItem("externalInvoices.from", from);
    else localStorage.removeItem("externalInvoices.from");
    if (to) localStorage.setItem("externalInvoices.to", to);
    else localStorage.removeItem("externalInvoices.to");
    if (status) localStorage.setItem("externalInvoices.status", status);
    else localStorage.removeItem("externalInvoices.status");
  }, [searchParams]);

  // Sync local state from URL (e.g. when applying saved views).
  useEffect(() => {
    const qParam = searchParams.get("q") ?? "";
    if (qParam !== latestStateRef.current.searchTerm) {
      setSearchInput(qParam);
      setSearchTerm(qParam);
      setCurrentPage(1);
    }
    const psParam = searchParams.get("ps");
    if (psParam) {
      const psNum = parseInt(psParam, 10);
      if (!Number.isNaN(psNum) && psNum !== latestStateRef.current.pageSize) {
        setPageSize(psNum);
        setCurrentPage(1);
      }
    }
  }, [searchParams, setCurrentPage, setPageSize, setSearchInput, setSearchTerm]);

  return { dateRange };
}
