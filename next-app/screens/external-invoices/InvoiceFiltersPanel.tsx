import React, { useEffect, useMemo, useRef } from "react";
import { Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import FilterPills from "@/components/FilterPills";
import IconActionButton from "@/components/IconActionButton";
import SavedViews from "@/components/SavedViews";
import SearchBar from "@/components/SearchBar";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { useSearchParams } from "@/navigation/urlSearchParams";
import type { ReconciliationFlag } from "@/lib/externalInvoiceInsights";

type FilterOption = { value: string; label: string };

type Props = {
  isReconciliationMode: boolean;
  searchInput: string;
  searchTerm: string;
  onSearch: (term: string) => void;
  onClearSearch: () => void;
  onOpenDateFilter: () => void;
  statusFilterOptions: FilterOption[];
  onStatusFilter: (value: string) => void;
  onPayDueFilter: (value: string) => void;
  onMissingFilter: (value: string) => void;
  ageFilterOptions: FilterOption[];
  onAgeBucketFilter: (value: string) => void;
  reconciliationFilter: "all" | ReconciliationFlag;
  onReconciliationFilterChange: (value: "all" | ReconciliationFlag) => void;
  flaggedCount: number;
  savedViewsKeys: string[];
  onApplySavedView: (state: Record<string, string>) => void;
  hasActiveFilters: boolean;
  onClearAllFilters: () => void;
  /** Removes the given URL params and resets pagination to page 1. */
  onRemoveParams: (keys: string[]) => void;
  lastRefreshedAt: Date | null;
};

export const InvoiceFiltersPanel = ({
  isReconciliationMode,
  searchInput,
  searchTerm,
  onSearch,
  onClearSearch,
  onOpenDateFilter,
  statusFilterOptions,
  onStatusFilter,
  onPayDueFilter,
  onMissingFilter,
  ageFilterOptions,
  onAgeBucketFilter,
  reconciliationFilter,
  onReconciliationFilterChange,
  flaggedCount,
  savedViewsKeys,
  onApplySavedView,
  hasActiveFilters,
  onClearAllFilters,
  onRemoveParams,
  lastRefreshedAt,
}: Props) => {
  const [searchParams] = useSearchParams();
  const statusFilterValue = searchParams.get("status") || "all";
  const ageFilterValue = searchParams.get("age") || "all";
  const missingFilterValue = searchParams.get("missing") || "all";
  const payDueFilterValue = searchParams.get("payDue") || "all";

  const payDueFilterLabel = useMemo(() => {
    switch (payDueFilterValue) {
      case "today":
        return "Due today";
      case "overdue":
        return "Pay due overdue";
      case "this_week":
        return "Due in 7 days";
      case "this_month":
        return "Due this month";
      case "upcoming":
        return "Due later";
      default:
        return payDueFilterValue;
    }
  }, [payDueFilterValue]);

  // "/" focuses search from anywhere on the page
  const searchBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const input = searchBoxRef.current?.querySelector("input");
      if (input) {
        e.preventDefault();
        input.focus();
        input.select();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div ref={searchBoxRef} className="relative w-full flex-1">
            <SearchBar
              currentSearchTerm={searchInput}
              onSearch={onSearch}
              placeholder="Search invoice ID, username, name, address, status, or amount… (press / to focus)"
              className="w-full"
              autoSearch={false}
              showButton
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <IconActionButton
              label="Date range"
              onClick={onOpenDateFilter}
              icon={<Calendar className="h-4 w-4" />}
              className={(searchParams.get("from") || searchParams.get("to")) ? "ring-2 ring-primary/30" : ""}
            />
            <div className="hidden lg:block">
              <SavedViews
                storageKey="externalInvoices.views"
                keys={savedViewsKeys}
                getState={() => ({
                  q: searchParams.get("q") || "",
                  from: searchParams.get("from") || "",
                  to: searchParams.get("to") || "",
                  status: searchParams.get("status") || "",
                  age: isReconciliationMode ? (searchParams.get("age") || "") : "",
                  payDue: searchParams.get("payDue") || "",
                  ps: searchParams.get("ps") || "",
                  sort: searchParams.get("sort") || "",
                })}
                applyState={onApplySavedView}
                onSaved={(name) => notify.success(MESSAGES.externalInvoices.viewSavedTitle, `Saved “${name}”.`)}
                onDeleted={(name) => notify.success("View deleted", `Deleted “${name}”.`)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
            <FilterPills
              value={statusFilterValue}
              onChange={onStatusFilter}
              options={statusFilterOptions}
              name="external-invoices-status"
              className="min-w-0"
            />
          </div>

          {!isReconciliationMode ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Pay due</span>
                <FilterPills
                  value={payDueFilterValue}
                  onChange={onPayDueFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "today", label: "Due today" },
                    { value: "overdue", label: "Overdue" },
                    { value: "this_week", label: "Next 7 days" },
                    { value: "this_month", label: "This month" },
                  ]}
                  name="external-invoices-pay-due"
                  className="min-w-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Data quality</span>
                <FilterPills
                  value={missingFilterValue}
                  onChange={onMissingFilter}
                  options={[
                    { value: "all", label: "All" },
                    { value: "no_address", label: "Missing address" },
                    { value: "no_pay_due", label: "Missing pay due" },
                  ]}
                  name="external-invoices-missing"
                  className="min-w-0"
                />
              </div>
            </>
          ) : null}

          {isReconciliationMode ? (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Aging bucket</span>
                <FilterPills
                  value={ageFilterValue}
                  onChange={onAgeBucketFilter}
                  options={ageFilterOptions}
                  name="external-invoices-age"
                  className="min-w-0"
                />
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="whitespace-nowrap text-xs font-medium uppercase tracking-wide text-muted-foreground">Reconciliation flags</span>
                <FilterPills
                  value={reconciliationFilter}
                  onChange={(value) => onReconciliationFilterChange(value as ReconciliationFlag | "all")}
                  name="reconciliation-flags"
                  options={[
                    { value: "all", label: `All flags (${flaggedCount})` },
                    { value: "missing_payment", label: "Missing payment" },
                    { value: "duplicate", label: "Duplicate" },
                    { value: "amount_mismatch", label: "Amount mismatch" },
                  ]}
                />
              </div>
            </>
          ) : null}
        </div>

        {(hasActiveFilters || lastRefreshedAt) && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
            {lastRefreshedAt ? (
              <span className="text-xs text-muted-foreground">
                Updated {lastRefreshedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ) : null}
            {(searchParams.get("from") || searchParams.get("to")) && (
              <Badge variant="secondary" className="flex max-w-full items-center gap-2">
                Date: {searchParams.get("from") || "…"} → {searchParams.get("to") || "…"}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onRemoveParams(["from", "to"])}
                >
                  ×
                </Button>
              </Badge>
            )}
            {searchParams.get("status") && (
              <Badge variant="secondary" className="flex items-center gap-2">
                Status: {searchParams.get("status")}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onRemoveParams(["status"])}
                >
                  ×
                </Button>
              </Badge>
            )}
            {searchParams.get("age") && (
              <Badge variant="secondary" className="flex items-center gap-2">
                Aging: {searchParams.get("age")}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onRemoveParams(["age"])}
                >
                  ×
                </Button>
              </Badge>
            )}
            {searchParams.get("payDue") && (
              <Badge variant="secondary" className="flex items-center gap-2">
                Pay due: {payDueFilterLabel}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => onRemoveParams(["payDue"])}
                >
                  ×
                </Button>
              </Badge>
            )}
            {searchTerm && (
              <Badge variant="secondary" className="flex items-center gap-2">
                Search: “{searchTerm}”
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={onClearSearch}>
                  ×
                </Button>
              </Badge>
            )}
            {hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={onClearAllFilters}>
                Clear all filters
              </Button>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
