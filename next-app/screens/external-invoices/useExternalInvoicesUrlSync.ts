import { useEffect, useMemo, useRef } from "react";
import type { SetURLSearchParams } from "@/navigation/urlSearchParams";
import type { DateRange } from "react-day-picker";
import { getCurrentMonthDateRange } from "@/lib/externalInvoiceDateUtils";
import { EXTERNAL_INVOICE_MAX_PAGE_SIZE } from "@/components/DesktopTable";

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

  // Initialize state from the URL only. Filters used to be restored from
  // localStorage, which silently re-applied a status/date/search filter the
  // operator had forgotten about — the list then looked unfiltered while rows
  // were quietly being excluded. A fresh visit now always starts from the
  // current billing month with no status filter.
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const psStr = searchParams.get("ps") ?? localStorage.getItem("externalInvoices.pageSize") ?? String(defaultPageSize);
    // Never restore a page size above the supported cap (older sessions may have stored 200/500).
    const ps = Math.min(parseInt(psStr, 10) || defaultPageSize, EXTERNAL_INVOICE_MAX_PAGE_SIZE);
    setSearchTerm(q);
    setSearchInput(q);
    setPageSize(ps);

    const urlFrom = searchParams.get("from");
    const urlTo = searchParams.get("to");
    const isAllTime = searchParams.get("all") === "true" || urlFrom === "all";

    if (!isAllTime && (!urlFrom || !urlTo)) {
      const currentMonth = getCurrentMonthDateRange();
      const next = new URLSearchParams(searchParams);
      if (!urlFrom && currentMonth.from) next.set("from", currentMonth.from);
      if (!urlTo && currentMonth.to) next.set("to", currentMonth.to);
      setSearchParams(next, { replace: true } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the search term + page size into URL/localStorage.
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
    localStorage.setItem("externalInvoices.pageSize", String(pageSize));
  }, [searchTerm, pageSize, setSearchParams]);

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
      const psNum = Math.min(parseInt(psParam, 10), EXTERNAL_INVOICE_MAX_PAGE_SIZE);
      if (!Number.isNaN(psNum) && psNum !== latestStateRef.current.pageSize) {
        setPageSize(psNum);
        setCurrentPage(1);
      }
    }
  }, [searchParams, setCurrentPage, setPageSize, setSearchInput, setSearchTerm]);

  return { dateRange };
}
