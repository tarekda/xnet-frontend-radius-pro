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
  FaChevronRight,
} from 'react-icons/fa';
import { useSidebar } from './Sidebar.context';
import { useIsMobile } from '../../../hooks/use-mobile';
import { Button } from '../button';
import { cn } from '@/lib/utils';
import { FileText, Upload, CloudDownload, BarChart3, Receipt, Folder, DollarSign, LogOut, Search, X, AlertCircle, CalendarClock, Smartphone, Wallet, CircleHelp, History, HeartPulse, MessageCircle, Network, Landmark, Ticket, Radio, Clock, TrendingUp, CheckCircle2, ShieldAlert, FileBarChart, LifeBuoy, ScrollText } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { can, canAny, COMPANY_WALLET_VIEW_PERMS } from '@/lib/permissions';
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
    <div className="flex h-16 flex-shrink-0 items-center border-b border-sidebar-border px-3">
      {/* Show toggle button only on desktop */}
      {isMobile === false && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          className={cn(
            "rounded-lg p-2 text-sidebar-foreground/65 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/40",
            isCollapsed ? '' : 'rotate-180'
          )}
          aria-label="Toggle Sidebar"
        >
          <FaBars size={20} />
        </button>
      )}
      <span
        className={cn(
          "ml-3 whitespace-nowrap text-[15px] font-bold tracking-tight text-sidebar-foreground transition-opacity duration-200",
          !isMobile && isCollapsed ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
        )}
      >
        XNet Radius
      </span>
    </div>
  );

  // NOTE: SidebarContent is invoked as a plain function (see `{SidebarContent()}` below), not rendered
  // as a component, so its hooks live on Sidebar and the exhaustive-deps rule misclassifies
  // Sidebar-scoped values (pathname/isMobile/isCollapsed) as outer scope. Those deps are intentional.
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
    }, [isMobile, isCollapsed]); // eslint-disable-line react-hooks/exhaustive-deps

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
      return p.startsWith("/users") || p.startsWith("/online-users") || p.startsWith("/profiles") || p.startsWith("/audit") || p.startsWith("/external-users") || p.startsWith("/auth-failures") || p.startsWith("/radius-packet-audit");
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const isSystemRoute = useMemo(() => {
      const p = pathname || "";
      return p.startsWith("/nas") || p.startsWith("/settings") || p.startsWith("/integrations");
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const isAdminRoute = useMemo(() => {
      const p = pathname || "";
      return p.startsWith("/analytics") || p.startsWith("/alerts") || p.startsWith("/expenses") || p.startsWith("/auth-users") || p.startsWith("/backups") || p.startsWith("/access");
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const isBillingRoute = useMemo(() => {
      const p = pathname || "";
      return (
        p === "/billing" ||
        p.startsWith("/billing/") ||
        p.startsWith("/invoices") ||
        p.startsWith("/invoice-upload") ||
        p.startsWith("/external-invoices") ||
        p.startsWith("/whatsapp-hub") ||
        p.startsWith("/vouchers") ||
        p.startsWith("/collections") ||
        p.startsWith("/cable-vision") ||
        p.startsWith("/revenue-leakage") ||
        p.startsWith("/admin/company-wallet")
      );
    }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    const [isUsersGroupOpen, setIsUsersGroupOpen] = useState<boolean>(isUsersRoute);
    const [isSystemGroupOpen, setIsSystemGroupOpen] = useState<boolean>(isSystemRoute);
    const [isAdminGroupOpen, setIsAdminGroupOpen] = useState<boolean>(isAdminRoute);
    const [isBillingGroupOpen, setIsBillingGroupOpen] = useState<boolean>(isBillingRoute);

    // Auto-expand the relevant group when navigating into it.
    useEffect(() => {
      if (isUsersRoute) setIsUsersGroupOpen(true);
    }, [isUsersRoute]);
    useEffect(() => {
      if (isSystemRoute) setIsSystemGroupOpen(true);
    }, [isSystemRoute]);
    useEffect(() => {
      if (isAdminRoute) setIsAdminGroupOpen(true);
    }, [isAdminRoute]);
    useEffect(() => {
      if (isBillingRoute) setIsBillingGroupOpen(true);
    }, [isBillingRoute]);

    const mainItems = [
      { to: '/', label: 'Home', icon: FaHome, navPerm: "ui.sidebar.home.show" },
      { to: '/dashboard', label: 'Dashboard', icon: FaTachometerAlt, navPerm: "ui.sidebar.dashboard.show" },
      { to: '/noc', label: 'NOC Wallboard', icon: Radio, navPerm: "ui.sidebar.dashboard.show" },
      { to: '/tickets', label: 'Support Tickets', icon: LifeBuoy, perm: 'support.tickets.view', navPerm: "ui.sidebar.support.tickets.show" },
      { to: '/about', label: 'About & Help', icon: CircleHelp, navPerm: "ui.sidebar.home.show" },
    ];

    const adminItems = [
      { to: '/analytics', label: 'Analytics', icon: BarChart3, perm: 'admin.analytics.view', navPerm: "ui.sidebar.admin.analytics.show", feature: "analytics" },
      { to: '/analytics/revenue', label: 'Revenue Insights', icon: TrendingUp, perm: 'admin.analytics.view', navPerm: "ui.sidebar.admin.analytics.show", feature: "analytics" },
      { to: '/reports', label: 'Reports', icon: FileBarChart, perm: 'admin.reports.view', navPerm: "ui.sidebar.admin.reports.show" },
      { to: '/alerts', label: 'Alerts', icon: FaBell, perm: 'admin.alerts.view', navPerm: "ui.sidebar.admin.alerts.show", feature: "alerts" },
      { to: '/expenses', label: 'Expenses', icon: Receipt, perm: 'admin.expenses.view', navPerm: "ui.sidebar.admin.expenses.show" },
      { to: '/auth-users', label: 'Auth Users', icon: FaUserShield, perm: 'admin.authUsers.manage', navPerm: "ui.sidebar.admin.authUsers.show" },
      { to: '/access', label: 'Roles & Access', icon: FaUserShield, perm: 'admin.access.manage', navPerm: "ui.sidebar.admin.access.show" },
      { to: '/backups', label: 'Backups', icon: Folder, perm: 'admin.access.manage', navPerm: "ui.sidebar.admin.backups.show", feature: "backups" },
      { to: '/admin/resellers', label: 'Resellers', icon: FaUsers, perm: 'admin.resellers.manage', navPerm: "ui.sidebar.admin.resellers.show" },
      { to: '/admin/company-wallet', label: 'Company wallet', icon: Landmark, perms: ['billing.companyWallet.view', 'ui.sidebar.admin.companyWallet.show', 'admin.resellers.manage', 'admin.access.manage'] },
    ] as const;

    const usersItems = [
      { to: '/users/list', label: 'Users', icon: FaUsers, perms: ['users.view', 'reseller.users.view'], navPerm: "ui.sidebar.users.list.show" },
      { to: '/online-users', label: 'Live Sessions', icon: FaUserClock, perms: ['users.online.view', 'reseller.users.view'], navPerm: "ui.sidebar.users.online.show" },
      { to: '/auth-failures', label: 'Auth Failures', icon: FaBell, perms: ['users.online.view', 'reseller.users.view'] },
      { to: '/radius-packet-audit', label: 'Packet Audit', icon: ScrollText, perms: ['users.online.view', 'reseller.users.view'] },
      { to: '/profiles/list', label: 'Profile Plans', icon: FaCreditCard, perms: ['radius.profiles.view'], navPerm: "ui.sidebar.users.profiles.show" },
      { to: '/audit', label: 'Audit Log', icon: History, perms: ['users.view'], navPerm: "ui.sidebar.users.list.show" },
      { to: '/external-users', label: 'External Users', icon: CloudDownload, perms: ['billing.invoiceUpload.create', 'users.view'] },
    ] as const;

    const systemItems = [
      { to: '/settings', label: 'Settings', icon: FaCogs, perm: 'radius.settings.view', navPerm: "ui.sidebar.radius.settings.show" },
      {
        to: '/integrations',
        label: 'System Health',
        icon: HeartPulse,
        perms: ['users.online.view', 'reseller.users.view', 'radius.nas.view', 'admin.analytics.view', 'admin.access.manage'],
      },
      { to: '/nas', label: 'NAS', icon: FaServer, perm: 'radius.nas.view', navPerm: "ui.sidebar.radius.nas.show" },
      { to: '/settings/security', label: 'Security (MFA)', icon: FaUserShield, navPerm: "ui.sidebar.home.show" },
      { to: '/topology', label: 'Network Topology', icon: Network, perm: 'radius.nas.view', navPerm: "ui.sidebar.home.show" },
    ] as const;

    const billingItems = [
      { label: 'Invoicing', to: 'header_invoicing', type: 'header' as const },
      { label: 'Overview', to: '/billing', icon: BarChart3, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      { label: 'External Invoices', to: '/external-invoices', icon: FileText, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'RADIUS Invoices', to: '/invoices', icon: Receipt, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      { label: 'Upload Invoice', icon: Upload, to: '/invoice-upload', perm: 'billing.invoiceUpload.create', navPerm: "ui.sidebar.billing.invoiceUpload.show", feature: "invoice-upload" },
      { label: 'Provider Import', icon: CloudDownload, to: '/invoice-upload/myisp', perm: 'billing.invoiceUpload.create', navPerm: "ui.sidebar.billing.invoiceUpload.show", feature: "invoice-upload" },
      { label: 'Prepaid Vouchers', to: '/vouchers', icon: Ticket, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },

      { label: 'Payments & Collections', to: 'header_payments', type: 'header' as const },
      { label: 'Revenue Leak & Ghost Audit', to: '/revenue-leakage', icon: ShieldAlert, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      { label: 'Payment due', to: '/external-invoices/payment-due', icon: CalendarClock, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Dunning Center', to: '/external-invoices/dunning', icon: AlertCircle, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Aging Report', to: '/billing/aging', icon: Clock, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Revenue Insights', to: '/analytics/revenue', icon: TrendingUp, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      { label: 'Reconciliation', to: '/external-invoices/reconciliation', icon: Search, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Collections', to: '/collections', icon: DollarSign, perm: 'billing.collections.view', navPerm: "ui.sidebar.billing.collections.show", feature: "collections" },
      { label: 'Whish payments', to: '/external-invoices/whish-payments', icon: Smartphone, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Wallet ledger', to: '/external-invoices/wallet-ledger', icon: Wallet, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show", feature: "external-invoices" },
      { label: 'Company wallet', to: '/admin/company-wallet', icon: Landmark, perms: COMPANY_WALLET_VIEW_PERMS },

      { label: 'Communications', to: 'header_communications', type: 'header' as const },
      { label: 'WhatsApp Hub', to: '/whatsapp-hub', icon: MessageCircle, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      { label: 'WhatsApp Matches', to: '/external-invoices/whatsapp-matches', icon: CheckCircle2, perm: 'billing.externalInvoices.view', navPerm: "ui.sidebar.billing.externalInvoices.show" },
      {
        label: 'Cable Vision',
        to: '/cable-vision',
        icon: FaCreditCard,
        perms: ['cablevision.accounts.view', 'cablevision.accounts.manage'],
        navPerm: "ui.sidebar.cablevision.show",
      },
    ];

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
      .filter((i) => ("perms" in i ? canAny(user, [...(i as any).perms]) : can(user, (i as any).perm)))
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

    const systemItemsFiltered = systemItems
      .filter((i) => ("perms" in i ? canAny(user, [...(i as any).perms]) : !("perm" in i) || can(user, (i as any).perm)))
      .filter((i) => !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label))
      .map(({ to, label, icon }) => ({ to, label, icon }));

    const _billingRaw = billingItems
      .filter((i) => !(i as any).feature || isFeatureEnabled(String((i as any).feature)))
      .filter((i) => ("type" in i && i.type === "header") || ("perms" in i ? canAny(user, (i as any).perms) : can(user, (i as any).perm)))
      .filter((i) => ("type" in i && i.type === "header") || !("navPerm" in i) || can(user, (i as any).navPerm))
      .filter((i) => matches(i.label) || ("type" in i && i.type === "header"))
      .map(({ to, label, icon, type }) => ({ to, label, icon, type }));

    const billingItemsFiltered: typeof _billingRaw = [];
    for (let i = 0; i < _billingRaw.length; i++) {
      if (_billingRaw[i].type === 'header') {
        let hasChild = false;
        for (let j = i + 1; j < _billingRaw.length; j++) {
          if (_billingRaw[j].type === 'header') break;
          hasChild = true;
        }
        if (hasChild) billingItemsFiltered.push(_billingRaw[i]);
      } else {
        billingItemsFiltered.push(_billingRaw[i]);
      }
    }

    const NavItem = (props: {
      to: string;
      label: string;
      icon: any;
      badgeCount?: number;
      badgeVariant?: "info" | "danger";
    }) => (
      (() => {
        const Icon = props.icon;
        const isActive =
          props.to === "/settings"
            ? pathname === "/settings"
            : pathname === props.to || (props.to !== "/" && pathname.startsWith(props.to + "/"));
        const badgeClass = isActive
          ? props.badgeVariant === "danger"
            ? "bg-white/20 text-sidebar-primary-foreground"
            : "bg-white/15 text-sidebar-primary-foreground"
          : props.badgeVariant === "danger"
            ? "bg-destructive/15 text-destructive"
            : "bg-sidebar-accent text-sidebar-accent-foreground";
        return (
      <Link
        key={props.to}
        href={props.to}
        className={cn(
          "group relative mx-2 flex min-h-10 items-center space-x-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-sidebar-primary to-indigo-600 text-white shadow-md shadow-sidebar-primary/25 scale-[1.01]"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/80 hover:text-sidebar-foreground hover:translate-x-0.5"
        )}
        onClick={() => isMobile && setMobileMenuOpen(false)}
      >
        <div className="relative flex-shrink-0">
          <Icon
            size={18}
            className={cn(
              "transition-transform duration-200 group-hover:scale-110",
              isActive && "text-white"
            )}
          />
          {!isMobile && isCollapsed && typeof props.badgeCount === "number" && props.badgeCount > 0 ? (
            <span
              className={cn(
                "absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-sidebar",
                props.badgeVariant === "danger" ? "bg-destructive" : "bg-sidebar-primary"
              )}
            />
          ) : null}
        </div>
        <span
          className={cn(
            "flex-1 min-w-0 whitespace-nowrap transition-opacity duration-200 font-semibold",
            !isMobile && isCollapsed ? 'opacity-0 pointer-events-none select-none' : 'opacity-100'
          )}
        >
          {props.label}
        </span>

        {!isMobile && !isCollapsed && typeof props.badgeCount === "number" && props.badgeCount > 0 ? (
          <span className={cn("ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold shadow-2xs", badgeClass)}>
            {props.badgeCount > 999 ? "999+" : props.badgeCount}
          </span>
        ) : null}
        {!isMobile && isCollapsed && (
          <div className="absolute left-full ml-2 px-2.5 py-1 bg-popover text-popover-foreground border border-border rounded-lg text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-lg z-50">
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
      items: Array<{ to: string; label: string; icon?: any; badgeCount?: number; badgeVariant?: "info" | "danger"; type?: "header" }>;
    }) => {
      const Icon = props.icon;
      const hasActiveChild = props.items.some(
        (it) => it.type !== "header" && (it.to === "/settings" ? pathname === "/settings" : pathname === it.to || (it.to !== "/" && pathname.startsWith(it.to + "/")))
      );
      const totalGroupBadges = props.items.reduce((acc, it) => acc + (it.badgeCount || 0), 0);

      return (
        <div className="mx-2 mb-1">
          <button
            type="button"
            className={cn(
              "group relative flex min-h-10 w-full items-center space-x-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
              hasActiveChild
                ? "bg-sidebar-accent/60 text-sidebar-foreground font-semibold border border-sidebar-border/60 shadow-xs"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground hover:translate-x-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring/60"
            )}
            aria-expanded={props.isOpen}
            onClick={(e) => {
              e.stopPropagation();
              props.onToggle();
            }}
          >
            <div className="relative flex items-center justify-center flex-shrink-0">
              <Icon
                size={18}
                className={cn(
                  "transition-transform duration-200 group-hover:scale-110",
                  hasActiveChild ? "text-sidebar-primary" : "text-sidebar-foreground/70"
                )}
              />
              {!props.isOpen && totalGroupBadges > 0 && !isCollapsed && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-sidebar-primary ring-2 ring-sidebar" />
              )}
            </div>

            <span
              className={cn(
                "flex-1 min-w-0 whitespace-nowrap transition-opacity duration-200 text-left font-medium",
                !isMobile && isCollapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100"
              )}
            >
              {props.label}
            </span>

            {/* Total badge pill when group is collapsed */}
            {!props.isOpen && !isCollapsed && totalGroupBadges > 0 ? (
              <span className="rounded-full bg-sidebar-accent border border-sidebar-border px-1.5 py-0.2 text-[10px] font-bold text-sidebar-foreground/80">
                {totalGroupBadges > 99 ? "99+" : totalGroupBadges}
              </span>
            ) : null}

            {/* Smooth animated rotating chevron */}
            <FaChevronRight
              size={12}
              className={cn(
                "flex-shrink-0 text-sidebar-foreground/50 transition-transform duration-300 ease-out",
                props.isOpen && "rotate-90 text-sidebar-foreground/80",
                !isMobile && isCollapsed ? "hidden" : "block"
              )}
            />

            {!isMobile && isCollapsed && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover text-popover-foreground border border-border rounded-lg text-xs font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 shadow-xl z-50">
                <div className="font-semibold">{props.label}</div>
                <div className="text-[10px] text-muted-foreground">{props.items.length} items</div>
              </div>
            )}
          </button>

          {/* Ultra smooth CSS grid accordion expansion animation */}
          <div
            className={cn(
              "grid transition-all duration-300 ease-in-out",
              props.isOpen && (!isCollapsed || isMobile) ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="overflow-hidden">
              <div className="relative ml-3 pl-2 space-y-0.5 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-px before:bg-sidebar-border/70">
                {props.items.map(({ to, label, icon, badgeCount, badgeVariant, type }) => (
                  <div key={to} className={cn("transition-all duration-200", type === "header" && "mt-2 mb-1 first:mt-0")}>
                    {type === "header" ? (
                      <div className={cn("px-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45", !isMobile && isCollapsed && "hidden")}>
                        {label}
                      </div>
                    ) : (
                      NavItem({ to, label, icon, badgeCount, badgeVariant })
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    };

    return (
      <nav
        className="min-h-0 flex-1 space-y-0.5 overflow-y-scroll overflow-x-hidden py-3"
        // Keep scrollbar space stable to avoid layout jank while animating width
        style={{ scrollbarGutter: "stable" } as React.CSSProperties}
      >
        {/* Profile block */}
        {!isMobile ? (
          <div className={cn("px-2 pb-3", isCollapsed && "px-0")}>
            {!isCollapsed ? (
              <div className="mx-2 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
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
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
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

        {canAny(user, adminItems.flatMap((i) => ("perms" in i ? (i as any).perms : [(i as any).perm])) as unknown as string[]) && adminItemsFiltered.length > 0
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

        {systemItemsFiltered.length > 0
          ? NavGroup({
              label: "System",
              icon: FaCogs,
              isOpen: q.length > 0 ? true : isSystemGroupOpen,
              onToggle: () => setIsSystemGroupOpen((v) => !v),
              items: systemItemsFiltered,
            })
          : null}

        {canAny(
          user,
          billingItems.flatMap((i) => ("perms" in i ? (i as any).perms : [(i as any).perm])) as unknown as string[]
        ) && billingItemsFiltered.length > 0 ? (
          <>
            <div className="my-1 border-t border-sidebar-border/60 mx-3" />
            {NavGroup({
              label: "Billing",
              icon: Receipt,
              isOpen: q.length > 0 ? true : isBillingGroupOpen,
              onToggle: () => setIsBillingGroupOpen((v) => !v),
              items: billingItemsFiltered,
            })}
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
      <div className="mt-auto flex-shrink-0 border-t border-sidebar-border p-3">
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
      {/* Mobile backdrop overlay */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-200"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        id="sidebar"
        className={cn(
          "radius-sidebar-shop h-full text-sidebar-foreground",
          "transition-[width] duration-200 ease-out will-change-[width] flex flex-col shrink-0",
          "min-h-0 overflow-hidden overflow-x-hidden",
          // Mobile styles
          isMobile && "fixed z-40 h-screen",
          isMobile && (isMobileMenuOpen ? 'left-0 w-[17rem] shadow-2xl' : '-left-full'),
          // Desktop styles
          !isMobile && (isCollapsed ? 'w-[4.5rem]' : 'w-[17rem]')
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
