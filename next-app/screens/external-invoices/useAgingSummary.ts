import { useQuery } from "@tanstack/react-query";
import { fetchExternalAgingSummary } from "@/api/invoices";

export type AgingSummaryFilters = {
  searchTerm: string;
  from: string | null;
  to: string | null;
  status?: string;
  graceDays: number;
};

/**
 * Shared aging-summary query. Both the metrics panel and the reconciliation
 * banner mount it; the identical query key makes React Query dedupe the fetch.
 */
export function useAgingSummary({ searchTerm, from, to, status, graceDays }: AgingSummaryFilters) {
  return useQuery({
    queryKey: ["externalAgingSummary", searchTerm, from, to, status, graceDays],
    queryFn: () =>
      fetchExternalAgingSummary({
        search: searchTerm || undefined,
        from: from || undefined,
        to: to || undefined,
        status,
        graceDays,
      }),
  });
}
