"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Command,
  FileText,
  Gauge,
  HeartPulse,
  History,
  Loader2,
  Search,
  Server,
  Settings,
  Shield,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";
import type { ExternalInvoice, User, UsersApiResponse } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PaletteItem = {
  key: string;
  group: "Pages" | "Subscribers" | "Invoices";
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const PAGE_ITEMS: Array<
  Omit<PaletteItem, "group" | "key"> & { permissions?: string[] }
> = [
  { label: "Dashboard", description: "Network operations overview", href: "/dashboard", icon: Gauge },
  { label: "Subscribers", description: "Manage RADIUS users", href: "/users/list", icon: Users, permissions: ["users.view", "reseller.users.view"] },
  { label: "Live Sessions", description: "Online subscribers and disconnect controls", href: "/online-users", icon: Activity, permissions: ["users.online.view", "reseller.users.view"] },
  { label: "Authentication Failures", description: "Investigate rejected logins", href: "/auth-failures", icon: Shield, permissions: ["users.online.view", "reseller.users.view"] },
  { label: "NAS Devices", description: "RADIUS network access servers", href: "/nas", icon: Server, permissions: ["radius.nas.view"] },
  { label: "External Invoices", description: "Imported customer billing records", href: "/external-invoices", icon: FileText, permissions: ["billing.externalInvoices.view"] },
  { label: "RADIUS Invoices", description: "Generated monthly invoices", href: "/invoices", icon: FileText, permissions: ["billing.externalInvoices.view"] },
  { label: "Wallet Ledger", description: "Subscriber wallet credits and debits", href: "/external-invoices/wallet-ledger", icon: Wallet, permissions: ["billing.externalInvoices.view", "billing.externalInvoices.pay"] },
  { label: "Audit Log", description: "Administrative activity history", href: "/audit", icon: History, permissions: ["users.view"] },
  {
    label: "System Health",
    description: "Infrastructure, network, backup, and integration diagnostics",
    href: "/integrations",
    icon: HeartPulse,
    permissions: ["users.online.view", "reseller.users.view", "radius.nas.view", "admin.analytics.view", "admin.access.manage", "billing.externalInvoices.view"],
  },
  { label: "Alerts", description: "Operational alerts and rules", href: "/alerts", icon: Bell, permissions: ["admin.alerts.view"] },
  { label: "Settings", description: "RADIUS and interface preferences", href: "/settings", icon: Settings, permissions: ["radius.settings.view"] },
];

function matchesPage(item: Omit<PaletteItem, "group" | "key">, query: string) {
  if (!query) return true;
  const haystack = `${item.label} ${item.description}`.toLowerCase();
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((part) => haystack.includes(part));
}

async function searchSubscribers(query: string): Promise<User[]> {
  const response = await apiClient.get<UsersApiResponse>("/radius/users/search", {
    params: { query },
  });
  return response.data?.data?.users ?? [];
}

async function searchInvoices(query: string): Promise<ExternalInvoice[]> {
  const response = await apiClient.get("/invoices/external", {
    params: { page: 1, limit: 6, search: query },
  });
  return response.data?.data?.data ?? [];
}

export default function GlobalCommandPalette() {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const canSearchSubscribers = canAny(user, ["users.view", "reseller.users.view"]);
  const canSearchInvoices = can(user, "billing.externalInvoices.view");

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const subscriberQuery = useQuery({
    queryKey: ["commandPalette", "subscribers", debouncedQuery],
    queryFn: () => searchSubscribers(debouncedQuery),
    enabled: open && canSearchSubscribers && debouncedQuery.length >= 2,
    staleTime: 20_000,
  });

  const invoiceQuery = useQuery({
    queryKey: ["commandPalette", "invoices", debouncedQuery],
    queryFn: () => searchInvoices(debouncedQuery),
    enabled: open && canSearchInvoices && debouncedQuery.length >= 2,
    staleTime: 20_000,
  });

  const items = useMemo<PaletteItem[]>(() => {
    const pages = PAGE_ITEMS.filter(
      (item) => !item.permissions || canAny(user, item.permissions)
    )
      .filter((item) => matchesPage(item, query.trim()))
      .slice(0, query.trim() ? 6 : 8)
      .map((item) => ({
        ...item,
        key: `page:${item.href}`,
        group: "Pages" as const,
      }));

    const subscribers = (subscriberQuery.data ?? []).slice(0, 6).map((subscriber) => ({
      key: `subscriber:${subscriber.username}`,
      group: "Subscribers" as const,
      label: subscriber.userDetails?.fullName || subscriber.username,
      description: [
        `@${subscriber.username}`,
        subscriber.userDetails?.phoneNumber,
        subscriber.profile?.profileName,
      ]
        .filter(Boolean)
        .join(" · "),
      href: `/users/${encodeURIComponent(subscriber.username)}`,
      icon: UserRound,
      badge: subscriber.isOnline ? "Online" : subscriber.accountStatus,
    }));

    const invoices = (invoiceQuery.data ?? []).slice(0, 6).map((invoice) => ({
      key: `invoice:${invoice.id}`,
      group: "Invoices" as const,
      label: `Invoice #${invoice.id} · ${invoice.fullName || invoice.username}`,
      description: `@${invoice.username} · $${Number(invoice.amount || 0).toFixed(2)} · ${invoice.billingMonth || "No month"}`,
      href: `/external-invoices?highlight=${invoice.id}`,
      icon: FileText,
      badge: invoice.status,
    }));

    return [...pages, ...subscribers, ...invoices];
  }, [invoiceQuery.data, query, subscriberQuery.data, user]);

  useEffect(() => {
    setActiveIndex(0);
  }, [items.length, query]);

  const navigate = (item: PaletteItem) => {
    setOpen(false);
    router.push(item.href);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (items.length ? (current + 1) % items.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => (items.length ? (current - 1 + items.length) % items.length : 0));
    } else if (event.key === "Enter" && items[activeIndex]) {
      event.preventDefault();
      navigate(items[activeIndex]);
    }
  };

  const searching = subscriberQuery.isFetching || invoiceQuery.isFetching;
  const showMinimumHint = query.trim().length === 1;

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          type="button"
          variant="outline"
          className="h-9 w-full justify-between gap-3 text-muted-foreground sm:w-72"
          onClick={() => setOpen(true)}
          aria-label="Open global search"
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search subscribers, invoices…
          </span>
          <span className="hidden items-center gap-0.5 sm:flex">
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px]">Ctrl</kbd>
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-sans text-[10px]">K</kbd>
          </span>
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10vh] block max-w-2xl translate-y-0 gap-0 overflow-hidden p-0 sm:top-[12vh]">
          <DialogHeader className="sr-only">
            <DialogTitle>Global search</DialogTitle>
            <DialogDescription>Search pages, subscribers, and invoices.</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 border-b px-4">
            {searching ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <Input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search pages, subscribers, phone numbers, invoices…"
              className="h-14 border-0 px-0 text-base shadow-none focus-visible:ring-0"
              role="combobox"
              aria-expanded="true"
              aria-controls="global-command-results"
              aria-activedescendant={items[activeIndex]?.key}
            />
            {query ? (
              <Button variant="ghost" size="sm" onClick={() => setQuery("")}>
                Clear
              </Button>
            ) : (
              <Command className="h-4 w-4 text-muted-foreground" />
            )}
          </div>

          <div id="global-command-results" className="max-h-[60vh] overflow-y-auto p-2" role="listbox">
            {showMinimumHint ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Enter at least two characters to search subscribers and invoices.
              </div>
            ) : items.length === 0 && !searching ? (
              <div className="p-8 text-center">
                <Search className="mx-auto mb-3 h-8 w-8 text-muted-foreground/60" />
                <p className="font-medium">No results found</p>
                <p className="mt-1 text-sm text-muted-foreground">Try a username, phone number, invoice number, or page name.</p>
              </div>
            ) : (
              (["Pages", "Subscribers", "Invoices"] as const).map((group) => {
                const groupItems = items.filter((item) => item.group === group);
                if (groupItems.length === 0) return null;
                return (
                  <div key={group} className="mb-2 last:mb-0">
                    <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group}
                    </div>
                    {groupItems.map((item) => {
                      const index = items.findIndex((candidate) => candidate.key === item.key);
                      const Icon = item.icon;
                      return (
                        <button
                          id={item.key}
                          key={item.key}
                          type="button"
                          role="option"
                          aria-selected={index === activeIndex}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => navigate(item)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                            index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/70"
                          )}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{item.label}</div>
                            <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                          </div>
                          {item.badge ? (
                            <Badge variant="secondary" className="max-w-24 shrink-0 truncate capitalize">
                              {item.badge}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span>↑↓ Navigate · Enter Open</span>
            <span>Esc Close</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
