// Sidebar.tsx
import React, { useEffect, useMemo, useState } from 'react';
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  FaBars,
  FaTimes,
  FaTachometerAlt,
  FaCogs,
  FaUsers,
  FaCreditCard,
  FaHome,
  FaUserClock,
  FaServer,
  FaUserShield,
  FaBell,
  FaChevronDown,
  FaChevronRight,
} from 'react-icons/fa';
import { useSidebar } from './Sidebar.context';
import { useIsMobile } from '../../../hooks/use-mobile';
import { Button } from '../button';
import { FileText, Upload, BarChart3, Receipt, Folder, DollarSign, LogOut, Search, X, AlertCircle, CalendarClock, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/context/AuthContext';
import { can, canAny } from '@/lib/permissions';
import { getAppVersionInfo } from '@/lib/version';
import { apiClient } from '@/api/client';
import { Input } from "@/components/ui/input";
import type { Alert } from "@/types/alerts";
import type { UsersApiResponse } from "@/types/api";
import { isFeatureEnabled } from "@/lib/featureFlags";

const Sidebar: React.FC = () => {
  const {
    isCollapsed,
    isMobileMenuOpen,
    toggleCollapse,
    toggleMobileMenu,
    setMobileMenuOpen,
  } = useSidebar();
  const isMobile = useIsMobile();
  const pathname = usePathname();

  // Handle screen size changes
  useEffect(() => {
    const handleResize = () => {
      // When switching to desktop, ensure the mobile drawer is closed.
      // Keep collapsed state as user preference (persisted in Sidebar.context).
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [setMobileMenuOpen]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const sidebar = document.getElementById('sidebar');
      if (isMobile && isMobileMenuOpen && sidebar && !sidebar.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isMobileMenuOpen, setMobileMenuOpen]);

  // Internal helper components
  const SidebarHeader = () => (
    <div className="flex items-center p-4 border-b border-sidebar-border flex-shrink-0">
      {/* Show toggle button only on desktop */}
      {isMobile === false && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          className={cn(
            "text-sidebar-foreground/70 hover:text-sidebar-foreground focus:outline-none transition-all duration-300",
            "p-2 rounded-lg hover:bg-sidebar-accent",
            isCollapsed ? '' : 'rotate-180'
          )}
          aria-label="Toggle Sidebar"
        >
          <FaBars size={20} />
        </button>
      )}
      <span
        className={cn(
          "ml-3 text-lg font-semibold whitespace-nowrap transition-opacity duration-200",
          "bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent",
          !isMobile && isCollapsed ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
        )}
      >
        Xnet Billing
      </span>
    </div>
  );

  const SidebarContent = () => {
    const { user } = useAuth();
    const [navQuery, setNavQuery] = useState<string>("");

    // "/" focuses sidebar search (desktop + expanded only)
    useEffect(() => {
      if (isMobile || isCollapsed) return;

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "/") return;
        const el = e.target as HTMLElement | null;
        const tag = (el?.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || (el as any)?.isContentEditable) return;

        const input = document.getElementById("sidebar-search") as HTMLInputElement | null;
        if (!input) return;
        e.preventDefault();
        input.focus();
      };

      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [isMobile, isCollapsed]);

    const canSeeLiveSessions = useMemo(
      () => canAny(user, ["users.online.view", "reseller.users.view"]),
      [user]
    );
    const canSeeUsers = useMemo(
      () => canAny(user, ["users.view", "reseller.users.view"]),
      [user]
    );
    const canSeeAlerts = useMemo(() => can(user, "admin.alerts.view"), [user]);

    const onlineMetricsQuery = useQuery({
      queryKey: ["onlineUsersMetrics"],
      queryFn: async () => {
        const resp = await apiClient.get("/online-users-metrics");
        return (resp?.data?.data ?? null) as null | { totalOnlineUsers?: number; totalActiveUsers?: number };
      },
      enabled: Boolean(canSeeLiveSessions),
      refetchInterval: 10000,
      staleTime: 5000,
    });
    const onlineCount = Math.max(0, Number(onlineMetricsQuery.data?.totalOnlineUsers ?? 0) || 0);

    const usersCountQuery = useQuery({
      queryKey: ["users", "count"],
      queryFn: async () => {
        const resp = await apiClient.get<UsersApiResponse>("/radius/users", {
          params: { page: 1, pageSize: 1 },
        });
        return resp.data;
      },
      enabled: Boolean(canSeeUsers),
      staleTime: 30000,
      refetchInterval: 60000,
    });
    const totalUsersCount = Math.max(0, Number(usersCountQuery.data?.data?.totalUsers ?? 0) || 0);

    const alertsQuery = useQuery({
      queryKey: ["alerts"],
      queryFn: async () => {
               const resp = await apiClient.get("/alerts");
        const raw = resp.data as Alert[] | { data?: Alert[] };
        return (Array.isArray(raw) ? raw : raw?.data ?? []) as Alert[];
      },
      enabled: Boolean(canSeeAlerts),
      refetchInterval: 15000,
      staleTime: 5000,
    });

    const alertsBadgeCount = useMemo(() => {
      const alerts = alertsQuery.data;
      if (!alerts || !Array.isArray(alerts)) return 0;
      const critical = alerts.filter(
        (a: any) =>
          (a?.severity === "critical" || a?.severity === "high") &&
          a?.resolved !== true
      );
      const unack = critical.filter((a: any) => a?.acknowledged !== true);
      return unack.length;
    }, [alertsQuery.data]);

    const displayName = useMemo(() => {
      const u: any = user || {};
      return String(u.username || u.email || "—");
    }, [user]);
    const roleLabel = useMemo(() => {
      const u: any = user || {};
      const role = String(u.role || "").trim();
      const resellerId = u.resellerId ?? null;
      return resellerId ? `${role || "reseller"} #${resellerId}` : (role || "user");
    }, [user]);
    const initials = useMemo(() => {
      const base = String(displayName || "").trim();
      if (!base) return "U";
      const parts = base.split(/[\s._-]+/).filter(Boolean);
      const a = parts[0]?.[0] || base[0];
      const b = parts.length > 1 ? parts[parts.length - 1]?.[0] : base[1];
      return (a + (b || "")).toUpperCase();
    }, [displayName]);

    const isUsersRoute = useMemo(() => {
      const p = pathname || "";
      return p.startsWith("/users") || p.startsWith("/online-users") || p.startsWith("/profiles");
    }, [pathname]);

    const isRadiusSettingsRoute = useMemo(() => {
      const p = pathname || "";
      return p.startsWith("/nas") || p.startsWith("/settings");
    }, [pathname]);

    const isAdminRoute = useMemo(() => {
      const p = pathname || "";
      return p.startsWith("/analytics") || p.startsWith("/alerts") || p.startsWith("/expenses") || p.startsWith("/auth-users") || p.startsWith("/backups") || p.startsWith("/access");
    }, [pathname]);

    const [isUsersGroupOpen, setIsUsersGroupOpen] = useState<boolean>(isUsersRoute);
    const [isRadiusSettingsGroupOpen, setIsRadiusSettingsGroupOpen] = useState<boolean>(isRadiusSettingsRoute);
    const [isAdminGroupOpen, setIsAdminGroupOpen] = useState<boolean>(isAdminRoute);

    // Auto-expand the relevant group when navigating into it.
    useEffect(() => {
      if (isUsersRoute) setIsUsersGroupOpen(true);
    }, [isUsersRoute]);
    useEffect(() => {
      if (isRadiusSettingsRoute) setIsRadiusSettingsGroupOpen(true);
    }, [isRadiusSettingsRoute]);
    useEffect(() => {
      if (isAdminRoute) setIsAdminGroupOpen(true);
    }, [isAdminRoute]);

    const mainItems = [
      { to: '/', label: 'Home', icon: FaHome, navPerm: "ui.sidebar.home.show" },
      { to: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt, navPerm: "ui.sidebar.dashboard.show" },
    ];

    const adminItems = [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, perm: 'admin.analytics.view', navPerm: "ui.sidebar.admin.analytics.show", feature: "analytics" },
      { to: '/alerts', label: 'Alerts', icon: FaBell, perm: 'admin.alerts.view', navPerm: "ui.sidebar.admin.alerts.show", feature: "alerts" },
      { to: '/expenses', label: 'Expenses', icon: Receipt, perm: 'admin.expenses.view', navPerm: "ui.sidebar.admin.expenses.show" },
      { to: '/auth-users', label: 'Auth Users', icon: FaUserShield, perm: 'admin.authUsers.manage', navPerm: "ui.sidebar.admin.authUsers.show" },
      { to: '/access', label: 'Roles & Access', icon: FaUserShield, perm: 'admin.access.manage', navPerm: "ui.sidebar.admin.access.show" },
      { to: '/backups', label: 'Backups', icon: Folder, perm: 'admin.access.manage', navPerm: "ui.sidebar.admin.backups.show", feature: "backups" },
      { to: '/admin/resellers', label: 'Resellers', icon: FaUsers, perm: 'admin.resellers.manage', navPerm: "ui.sidebar.admin.resellers.show" },
    ] as const;

    const usersItems = [
      { to: '/users/list', label: 'Users', icon: FaUsers, perms: ['users.view', 'reseller.users.view'], navPerm: "ui.sidebar.users.list.show" },
      { to: '/online-users', label: 'Live Sessions', icon: FaUserClock, perms: ['users.online.view', 'reseller.users.view'], navPerm: "ui.sidebar.users.online.show" },
      { to: '/auth-failures', label: 'Auth Failures', icon: FaBell, perms: ['users.online.view', 'reseller.users.view'] },
      { to: '/profiles/list', label: 'Profile Plans', icon: FaCreditCard, perms: ['radius.profiles.view'], navPerm: "ui.sidebar.users.profiles.show" },
    ] as const;

    const radiusSettingsItems = [
      { to: '/settings', label: 'Settings', icon: FaCogs, perm: 'radius.settings.view', navPerm: "ui.sidebar.radius.settings.show" },
      { to: '/nas', label: 'NAS', icon: FaServer, perm: 'radius.nas.view', navPerm: "ui.sidebar.radius.nas.show" },
    ] as const;

    const billingItems = [
      { label: 'Upload Invoice', icon: Upload, to: '/invoice-upload', perm: 'billing.invoiceUpload.create', navPerm: "ui.sidebar.billing.invoiceUpload.show", feature: "invoice-upload" },
      { label: 'External Invoices', to: '/external-invoices', icon: FileText, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Whish payments', to: '/external-invoices/whish-payments', icon: Smartphone, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Payment due', to: '/external-invoices/payment-due', icon: CalendarClock, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Dunning Center', to: '/external-invoices/dunning', icon: AlertCircle, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Reconciliation', to: '/external-invoices/reconciliation', icon: Search, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Collections', to: '/collections', icon: DollarSign, perm: 'billing.collections.view', navPerm: "ui.sidebar.billing.collections.show", feature: "collections" },
      {
        label: 'Cable Vision',
        to: '/cable-vision',
        icon: FaCreditCard,
        perms: ['cablevision.accounts.view', 'cablevision.accounts.manage'],
        navPerm: "ui.sidebar.cablevision.show",
      },
    ] as const;

    // Resellers use the same pages (dashboard/users/online-users) with scoped data.

    const hasItemAccess = (item: { perms: readonly string[] }) =>
      canAny(user, item.perms as unknown as string[]);

    const q = navQuery.trim().toLowerCase();
    const matches = (label: string) => (q.length === 0 ? true : label.toLowerCase().includes(q));

    const mainItemsFiltered = mainItems
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label));

    const adminItemsFiltered = adminItems
      .filter((i) => !(i as any).feature || isFeatureEnabled(String((i as any).feature)))
      .filter((i) => can(user, i.perm))
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label))
      .map(({ to, label, icon }) => ({
        to,
        label,
        icon,
        badgeCount: to === "/alerts" ? alertsBadgeCount : undefined,
        badgeVariant: to === "/alerts" ? ("danger" as const) : undefined,
      }));

    const usersItemsFiltered = usersItems
      .filter((i) => hasItemAccess(i))
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label))
      .map(({ to, label, icon }) => ({
        to,
        label,
        icon,
        badgeCount:
          to === "/online-users"
            ? onlineCount
            : to === "/users/list"
              ? totalUsersCount
              : undefined,
        badgeVariant:
          to === "/online-users" || to === "/users/list" ? ("info" as const) : undefined,
      }));

    const radiusSettingsItemsFiltered = radiusSettingsItems
      .filter((i) => can(user, i.perm))
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label))
      .map(({ to, label, icon }) => ({ to, label, icon }));

    const billingItemsFiltered = billingItems
      .filter((i) => !(i as any).feature || isFeatureEnabled(String((i as any).feature)))
      .filter((i) => ("perms" in i ? canAny(user, (i as any).perms) : can(user, (i as any).perm)))
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label))
      .map(({ to, label, icon }) => ({ to, label, icon }));

    const SectionLabel = ({ children }: { children: React.ReactNode }) => (
      <div className={cn("px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-sidebar-foreground/60", !isMobile && isCollapsed && "hidden")}>
        {children}
      </div>
    );

    const NavItem = (props: {
      to: string;
      label: string;
      icon: any;
      badgeCount?: number;
      badgeVariant?: "info" | "danger";
    }) => (
      (() => {
        const Icon = props.icon;
        const badgeClass =
          props.badgeVariant === "danger"
            ? "bg-destructive/15 text-destructive"
            : "bg-sidebar-primary/15 text-sidebar-primary";
        const isActive =
          pathname === props.to || (props.to !== "/" && pathname.startsWith(props.to + "/"));
        return (
      <Link
        key={props.to}
        href={props.to}
        className={cn(
          "flex items-center px-4 py-3 space-x-3 transition-colors duration-200",
          "hover:bg-sidebar-accent rounded-lg mx-2",
          "group relative",
          isActive ? "bg-sidebar-primary/10 text-sidebar-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground"
        )}
        onClick={() => isMobile && setMobileMenuOpen(false)}
      >
        <div className="relative flex-shrink-0">
          <Icon
            size={20}
            className={cn(
              "transition-transform duration-200",
              "group-hover:scale-110"
            )}
          />
          {!isMobile && isCollapsed && typeof props.badgeCount === "number" && props.badgeCount > 0 ? (
            <span
              className={cn(
                "absolute -top-1 -right-1 h-2 w-2 rounded-full",
                props.badgeVariant === "danger" ? "bg-destructive" : "bg-sidebar-primary"
              )}
            />
          ) : null}
        </div>
        <span
          className={cn(
            "flex-1 min-w-0 whitespace-nowrap transition-opacity duration-200",
            !isMobile && isCollapsed ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
          )}
        >
          {props.label}
        </span>

        {!isMobile && !isCollapsed && typeof props.badgeCount === "number" && props.badgeCount > 0 ? (
          <span className={cn("ml-auto rounded-full text-xs px-2 py-0.5 font-semibold", badgeClass)}>
            {props.badgeCount > 999 ? "999+" : props.badgeCount}
          </span>
        ) : null}
        {!isMobile && isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-md">
            {props.label}
          </div>
        )}
      </Link>
        );
      })()
    );

    const NavGroup = (props: {
      label: string;
      icon: any;
      isOpen: boolean;
      onToggle: () => void;
      items: Array<{ to: string; label: string; icon: any; badgeCount?: number; badgeVariant?: "info" | "danger" }>;
    }) => {
      const Icon = props.icon;
      const Chevron = props.isOpen ? FaChevronDown : FaChevronRight;

      return (
        <div className="mx-2">
          <button
            type="button"
            className={cn(
              "w-full flex items-center px-4 py-3 space-x-3 transition-colors duration-200",
              "hover:bg-sidebar-accent rounded-lg",
              "text-sidebar-foreground/80 hover:text-sidebar-foreground",
              "group relative",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar"
            )}
            aria-expanded={props.isOpen}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggle();
            }}
          >
            <Icon size={20} className={cn("flex-shrink-0 transition-transform duration-200", "group-hover:scale-110")} />
            <span
              className={cn(
                "flex-1 min-w-0 whitespace-nowrap transition-opacity duration-200 text-left",
                !isMobile && isCollapsed ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
              )}
            >
              {props.label}
            </span>
            <Chevron
              size={14}
              className={cn(
                "flex-shrink-0 opacity-80",
                !isMobile && isCollapsed ? 'hidden' : 'block'
              )}
            />

            {!isMobile && isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-md">
                {props.label}
              </div>
            )}
          </button>

          {props.isOpen && (
            <div className={cn("mt-1 space-y-1", !isMobile && isCollapsed ? 'hidden' : 'block')}>
              {props.items.map(({ to, label, icon, badgeCount, badgeVariant }) => (
                <div key={to} className="ml-3">
                  {NavItem({ to, label, icon, badgeCount, badgeVariant })}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    };

    return (
      <nav
        className="flex-1 min-h-0 overflow-y-scroll overflow-x-hidden py-4 space-y-1"
        // Keep scrollbar space stable to avoid layout jank while animating width
        style={{ scrollbarGutter: "stable" } as React.CSSProperties}
      >
        {/* Profile block */}
        {!isMobile ? (
          <div className={cn("px-2 pb-3", isCollapsed && "px-0")}>
            {!isCollapsed ? (
              <div className="mx-2 rounded-xl border border-sidebar-border bg-sidebar-accent/50 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-sidebar-foreground truncate">{displayName}</div>
                    <div className="text-xs text-sidebar-foreground/60 truncate">{roleLabel}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="relative group flex items-center justify-center py-2">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-white">
                  {initials}
                </div>
                <div className="absolute left-full ml-2 px-3 py-2 bg-popover text-popover-foreground border border-border rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-md">
                  <div className="font-semibold">{displayName}</div>
                  <div className="text-xs text-muted-foreground">{roleLabel}</div>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Search (desktop + expanded) */}
        {!isMobile && !isCollapsed ? (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sidebar-foreground/50" />
              <Input
                id="sidebar-search"
                value={navQuery}
                onChange={(e) => setNavQuery(e.target.value)}
                placeholder='Search… (press "/")'
                className="h-9 pl-9 pr-9 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50 focus-visible:ring-sidebar-ring/40"
              />
              {navQuery.trim().length > 0 ? (
                <button
                  type="button"
                  onClick={() => setNavQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-sidebar-accent text-sidebar-foreground/70"
                  title="Clear"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {mainItemsFiltered.map(({ to, label, icon: Icon }) => (
          <React.Fragment key={to}>{NavItem({ to, label, icon: Icon })}</React.Fragment>
        ))}

        {canAny(user, adminItems.map((i) => i.perm) as unknown as string[]) && adminItemsFiltered.length > 0
          ? NavGroup({
              label: "Admin",
              icon: FaUserShield,
              isOpen: q.length > 0 ? true : isAdminGroupOpen,
              onToggle: () => setIsAdminGroupOpen((v) => !v),
              items: adminItemsFiltered,
            })
          : null}

        {canAny(user, usersItems.flatMap((i) => i.perms) as unknown as string[]) && usersItemsFiltered.length > 0
          ? NavGroup({
              label: "Users",
              icon: FaUsers,
              isOpen: q.length > 0 ? true : isUsersGroupOpen,
              onToggle: () => setIsUsersGroupOpen((v) => !v),
              items: usersItemsFiltered,
            })
          : null}

        {canAny(user, radiusSettingsItems.map((i) => i.perm) as unknown as string[]) && radiusSettingsItemsFiltered.length > 0
          ? NavGroup({
              label: "Radius Settings",
              icon: FaCogs,
              isOpen: q.length > 0 ? true : isRadiusSettingsGroupOpen,
              onToggle: () => setIsRadiusSettingsGroupOpen((v) => !v),
              items: radiusSettingsItemsFiltered,
            })
          : null}

        {canAny(
          user,
          billingItems.flatMap((i) => ("perms" in i ? (i as any).perms : [(i as any).perm])) as unknown as string[]
        ) && billingItemsFiltered.length > 0 ? (
          <>
            <div className="my-2 border-t border-sidebar-border mx-3" />

            {SectionLabel({
              children: (
                <span className="inline-flex items-center gap-2">
                  <Folder className="h-3.5 w-3.5" /> Billing
                </span>
              ),
            })}

            {billingItemsFiltered.map(({ to, label, icon: Icon }) => (
                <React.Fragment key={to}>{NavItem({ to, label, icon: Icon })}</React.Fragment>
              ))}
          </>
        ) : null}

        {/* Reseller section removed (scoped in-place) */}
      </nav>
    );
  };

  const SidebarFooter = () => {
    const { logout } = useAuth();
    const v = getAppVersionInfo();
    const versionLabel = `v${v.version}${v.gitShaShort ? ` (${v.gitShaShort})` : ""}`;
    const collapsedVersionLabel = `v${v.version}${v.gitShaShort ? ` ${v.gitShaShort}` : ""}`;
    const buildNumberLabel = v.gitShaShort ? `build ${v.gitShaShort}` : undefined;
    const meta =
      v.buildTime
        ? `Built ${new Date(v.buildTime).toLocaleString()}`
        : undefined;

    const copyText = [
      `version=${v.version}`,
      v.gitSha ? `git=${v.gitSha}` : null,
      v.buildTime ? `build=${v.buildTime}` : null,
    ].filter(Boolean).join(" ");

    return (
      <div className="p-4 mt-auto border-t border-sidebar-border flex-shrink-0">
        <div className="space-y-2">
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-sidebar-foreground/60">Version</div>
                  <div className="grid grid-cols-[1fr_auto] items-center gap-2 min-w-0" title={copyText}>
                    <div className="text-sm text-sidebar-foreground font-mono truncate">
                      {`v${v.version}`}
                    </div>
                    {buildNumberLabel ? (
                      <div className="text-xs text-sidebar-foreground/60 font-mono truncate max-w-[6rem]">
                        {buildNumberLabel}
                      </div>
                    ) : null}
                  </div>
                  {meta ? (
                    <div className="text-[11px] text-sidebar-foreground/50 truncate" title={v.buildTime}>
                      {meta}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(copyText);
                    } catch {}
                  }}
                  title="Copy version info"
                >
                  Copy
                </Button>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-full justify-start gap-2 px-2 text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => logout()}
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
              <div className="text-[11px] text-sidebar-foreground/50">© {new Date().getFullYear()} Xnet Billing</div>
            </>
          ) : (
            <div className="space-y-2">
              <div className="relative group flex items-center justify-center gap-2">
                <div className="h-2 w-2 rounded-full bg-sidebar-primary/80 flex-shrink-0" />
                <div className="min-w-0 max-w-full text-[10px] text-sidebar-foreground/80 font-mono truncate" title={versionLabel}>
                  {collapsedVersionLabel}
                </div>
                <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground border border-border rounded-md text-sm whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-md">
                  {versionLabel}
                </div>
              </div>

              <button
                type="button"
                className="relative group flex items-center justify-center w-full rounded-lg py-2 hover:bg-sidebar-accent transition-colors"
                onClick={() => logout()}
                title="Logout"
              >
                <LogOut className="h-4 w-4 text-sidebar-foreground/80" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile === true && (
        <Button
          onClick={(e) => {
            e.stopPropagation();
            toggleMobileMenu();
          }}
          className="md:hidden fixed top-4 left-4 z-50 p-2 bg-sidebar border border-sidebar-border rounded-lg text-sidebar-foreground shadow-lg hover:bg-sidebar-accent transition-colors"
          aria-label="Toggle Menu"
        >
          {isMobileMenuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
        </Button>
      )}

      {/* Sidebar Container */}
      <div
        id="sidebar"
        className={cn(
          "radius-sidebar-shop h-full text-sidebar-foreground",
          "transition-[width] duration-200 ease-out will-change-[width] flex flex-col shrink-0",
          "min-h-0 overflow-hidden overflow-x-hidden",
          // Mobile styles
          isMobile && "fixed z-40 h-screen",
          isMobile && (isMobileMenuOpen ? 'left-0 w-64 shadow-2xl' : '-left-full'),
          // Desktop styles
          !isMobile && (isCollapsed ? 'w-20' : 'w-64')
        )}
      >
        {SidebarHeader()}
        {SidebarContent()}
        {SidebarFooter()}
      </div>
    </>
  );
};

export default Sidebar;
