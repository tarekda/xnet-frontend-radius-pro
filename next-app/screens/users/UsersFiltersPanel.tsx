import React, { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import SearchBar from "@/components/SearchBar";
import FilterPills from "@/components/FilterPills";
import SavedViews from "@/components/SavedViews";
import { Filter } from "lucide-react";
import type { SavedViewState } from "@/lib/savedViews";

export const UsersFiltersPanel = ({
  searchQuery,
  onSearch,
  quickFilterValue,
  onQuickFilter,
  profileFilterValue,
  onProfileFilter,
  attributeFilterValue,
  onAttributeFilter,
  onOpenAccountStatusDialog,
  savedViewsKeys,
  getSavedViewState,
  applySavedViewState,
  onViewSaved,
  onViewDeleted,
}: {
  searchQuery: string;
  onSearch: (term: string) => void;
  quickFilterValue: string;
  onQuickFilter: (value: string) => void;
  profileFilterValue: string;
  onProfileFilter: (value: string) => void;
  attributeFilterValue: string;
  onAttributeFilter: (value: string) => void;
  onOpenAccountStatusDialog: () => void;
  savedViewsKeys: string[];
  getSavedViewState: () => SavedViewState;
  applySavedViewState: (state: SavedViewState) => void;
  onViewSaved: (name: string) => void;
  onViewDeleted: (name: string) => void;
}) => {
  // Press "/" anywhere to jump to the search box.
  const searchBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || target?.isContentEditable) return;
      const input = searchBoxRef.current?.querySelector("input");
      if (input) {
        e.preventDefault();
        (input as HTMLInputElement).focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <Card className="border-border/80 shadow-none lg:col-span-12">
        <CardContent className="p-3">
          <div className="flex flex-wrap items-center gap-3">
            <div ref={searchBoxRef} className="order-1 w-full md:w-[70%]">
              <SearchBar
                currentSearchTerm={searchQuery}
                onSearch={onSearch}
                placeholder="Search by username, status, or profile… (press / to focus)"
                className="w-full"
                autoSearch={false}
                showButton
              />
            </div>
            <div className="order-3 w-full min-w-0 border-t border-border/60 pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <div className="flex items-center gap-2 whitespace-nowrap text-xs text-muted-foreground">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Filters</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-xs text-muted-foreground">Status</span>
                  <FilterPills
                    name="users-quick-filter"
                    value={quickFilterValue}
                    onChange={onQuickFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "online", label: "Online" },
                      { value: "offline", label: "Offline" },
                      { value: "suspended", label: "Suspended" },
                      { value: "risk", label: "Risk" },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-xs text-muted-foreground">Profile</span>
                  <FilterPills
                    name="users-profile-filter"
                    value={profileFilterValue}
                    onChange={onProfileFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "premium", label: "Premium" },
                      { value: "basic", label: "Basic" },
                      { value: "business", label: "Business" },
                    ]}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="whitespace-nowrap text-xs text-muted-foreground">Type</span>
                  <FilterPills
                    name="users-attribute-filter"
                    value={attributeFilterValue}
                    onChange={onAttributeFilter}
                    options={[
                      { value: "all", label: "All" },
                      { value: "quota", label: "Quota" },
                      { value: "mac", label: "MAC" },
                      { value: "contact", label: "Contact" },
                    ]}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={onOpenAccountStatusDialog}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Account status
                </Button>
              </div>
            </div>
            <div className="order-2 hidden min-w-0 flex-1 items-center justify-end md:flex">
              <div>
                <SavedViews
                  storageKey="users.views"
                  keys={savedViewsKeys}
                  getState={getSavedViewState}
                  applyState={applySavedViewState}
                  onSaved={onViewSaved}
                  onDeleted={onViewDeleted}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
