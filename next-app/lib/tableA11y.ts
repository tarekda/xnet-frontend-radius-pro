import type { Header } from "@tanstack/react-table";

/**
 * aria-sort value for a TanStack table header cell so screen readers announce
 * the current sort state. Returns undefined for non-sortable columns.
 */
export function ariaSortFor<TData, TValue>(
  header: Header<TData, TValue>
): "ascending" | "descending" | "none" | undefined {
  if (!header.column.getCanSort()) return undefined;
  const sorted = header.column.getIsSorted();
  if (sorted === "asc") return "ascending";
  if (sorted === "desc") return "descending";
  return "none";
}
