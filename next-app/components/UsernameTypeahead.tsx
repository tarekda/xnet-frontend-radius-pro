"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, X } from "lucide-react";
import { apiClient } from "@/api/client";
import type { User, UsersApiResponse } from "@/types/api";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (username: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

async function searchUsers(query: string): Promise<User[]> {
  const response = await apiClient.get<UsersApiResponse>("/radius/users/search", {
    params: { query },
  });
  return response.data?.data?.users ?? [];
}

export default function UsernameTypeahead({
  value,
  onChange,
  onSelect,
  placeholder = "Search subscriber…",
  ariaLabel = "Search subscriber",
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState(value);
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value.trim()), 250);
    return () => window.clearTimeout(id);
  }, [value]);

  const enabled = debounced.length >= 2;
  const searchQuery = useQuery({
    queryKey: ["username-typeahead", debounced],
    queryFn: () => searchUsers(debounced),
    enabled,
  });

  const suggestions = useMemo(() => searchQuery.data ?? [], [searchQuery.data]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (username: string) => {
    onChange(username);
    onSelect?.(username);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open && enabled}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setHighlight((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const selected = suggestions[highlight];
            pick(selected?.username || value.trim());
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="pl-10 pr-8"
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear subscriber"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => {
            onChange("");
            onSelect?.("");
            setOpen(false);
          }}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      {open && enabled ? (
        <div
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-sm shadow-md"
        >
          {searchQuery.isFetching ? (
            <div className="flex items-center gap-2 px-2 py-2 text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching subscribers…
            </div>
          ) : suggestions.length === 0 ? (
            <button
              type="button"
              className="w-full rounded-sm px-2 py-2 text-left text-muted-foreground hover:bg-muted"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(value.trim())}
            >
              Search for <span className="font-medium text-foreground">{value.trim()}</span>
            </button>
          ) : (
            suggestions.map((user, index) => {
              const name = user.userDetails?.fullName || "";
              return (
                <button
                  key={user.username}
                  type="button"
                  role="option"
                  aria-selected={index === highlight}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left",
                    index === highlight ? "bg-muted" : "hover:bg-muted/70"
                  )}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(user.username)}
                >
                  <span className="truncate font-medium">{user.username}</span>
                  {name ? <span className="ml-3 truncate text-xs text-muted-foreground">{name}</span> : null}
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
