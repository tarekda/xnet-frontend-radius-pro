import React, { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSearch: (term: string) => void;
  currentSearchTerm: string;
  className?: string;
  placeholder?: string;
  /** Default: true. Debounce search while typing. */
  autoSearch?: boolean;
  /** Debounce delay (ms) when autoSearch is enabled. Default: 350 */
  debounceMs?: number;
  /** Default: false. Show a Search button on the right. */
  showButton?: boolean;
  /** Accessible name for the search input. Default: "Search". */
  ariaLabel?: string;
}

const SearchBar: React.FC<Props> = React.memo(({ 
  onSearch, 
  currentSearchTerm,
  className,
  placeholder = "Search users...",
  autoSearch = true,
  debounceMs = 350,
  showButton = false,
  ariaLabel = "Search",
}) => {
  const [value, setValue] = useState(currentSearchTerm || "");
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(currentSearchTerm || "");
  }, [currentSearchTerm]);

  const trimmed = useMemo(() => value.trim(), [value]);

  useEffect(() => {
    if (!autoSearch) return;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onSearch(trimmed);
    }, debounceMs);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoSearch, debounceMs, onSearch, trimmed]);

  const runSearch = () => onSearch(trimmed);

  const clear = () => {
    setValue("");
    onSearch("");
  };

  return (
    <div className={cn(
      "w-full transition-all duration-200",
      isFocused && "scale-[1.01]",
      className
    )}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          aria-label={ariaLabel}
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn("pl-10", showButton ? "pr-28" : "pr-8")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              runSearch();
            }
          }}
        />

        {/* right-side actions */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {value ? (
            <button
              onClick={clear}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              type="button"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}

          {showButton ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={runSearch}
              disabled={!trimmed}
              className="h-8"
            >
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
});

export default SearchBar;