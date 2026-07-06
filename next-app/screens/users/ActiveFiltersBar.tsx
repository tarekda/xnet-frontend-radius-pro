import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import IconActionButton from "@/components/IconActionButton";
import { X } from "lucide-react";
import type { AdvancedFiltersState } from "./usersPageReducer";

export type RemovableFilterKey =
  | "search"
  | "account"
  | "status"
  | "profile"
  | "quotaExceeded"
  | "hasMacAddress"
  | "hasContactInfo";

export function hasActiveFilters(
  searchQuery: string,
  displayAccountFilter: string,
  statusFilter: string,
  filters: AdvancedFiltersState
): boolean {
  return Boolean(
    searchQuery ||
      displayAccountFilter ||
      (statusFilter && !["active", "suspended"].includes(statusFilter)) ||
      filters.profile !== "all" ||
      filters.quotaExceeded ||
      filters.hasMacAddress ||
      filters.hasContactInfo
  );
}

const FilterBadge = ({
  label,
  ariaLabel,
  onRemove,
}: {
  label: React.ReactNode;
  ariaLabel: string;
  onRemove: () => void;
}) => (
  <Badge variant="secondary" className="gap-1">
    {label}
    <button type="button" onClick={onRemove} className="inline-flex items-center" aria-label={ariaLabel}>
      <X className="h-3 w-3" />
    </button>
  </Badge>
);

export const ActiveFiltersBar = ({
  searchQuery,
  displayAccountFilter,
  statusFilter,
  filters,
  onRemove,
  onClearAll,
}: {
  searchQuery: string;
  displayAccountFilter: string;
  statusFilter: string;
  filters: AdvancedFiltersState;
  onRemove: (key: RemovableFilterKey) => void;
  onClearAll: () => void;
}) => {
  if (!hasActiveFilters(searchQuery, displayAccountFilter, statusFilter, filters)) return null;

  return (
    <Card className="border bg-card/60">
      <CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Active filters</span>
          {searchQuery ? (
            <FilterBadge
              label={<>Search: {searchQuery}</>}
              ariaLabel="Remove search filter"
              onRemove={() => onRemove("search")}
            />
          ) : null}
          {displayAccountFilter ? (
            <FilterBadge
              label={
                <>
                  Account:{" "}
                  {displayAccountFilter === "inactive"
                    ? "Inactive"
                    : displayAccountFilter.charAt(0).toUpperCase() + displayAccountFilter.slice(1)}
                </>
              }
              ariaLabel="Remove account status filter"
              onRemove={() => onRemove("account")}
            />
          ) : null}
          {statusFilter && !["active", "suspended"].includes(statusFilter) ? (
            <FilterBadge
              label={<>Status: {statusFilter}</>}
              ariaLabel="Remove status filter"
              onRemove={() => onRemove("status")}
            />
          ) : null}
          {filters.profile !== "all" ? (
            <FilterBadge
              label={<>Profile: {filters.profile}</>}
              ariaLabel="Remove profile filter"
              onRemove={() => onRemove("profile")}
            />
          ) : null}
          {filters.quotaExceeded ? (
            <FilterBadge
              label="Quota exceeded"
              ariaLabel="Remove quota exceeded filter"
              onRemove={() => onRemove("quotaExceeded")}
            />
          ) : null}
          {filters.hasMacAddress ? (
            <FilterBadge label="Has MAC" ariaLabel="Remove has MAC filter" onRemove={() => onRemove("hasMacAddress")} />
          ) : null}
          {filters.hasContactInfo ? (
            <FilterBadge
              label="Has contact"
              ariaLabel="Remove has contact filter"
              onRemove={() => onRemove("hasContactInfo")}
            />
          ) : null}
          <IconActionButton label="Clear all filters" onClick={onClearAll} icon={<X className="h-4 w-4" />} size="sm" />
        </div>
      </CardContent>
    </Card>
  );
};
