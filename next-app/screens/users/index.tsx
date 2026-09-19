import React, { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { OnChangeFn, SortingState } from "@tanstack/react-table";
import { useTranslation } from "react-i18next";
import { Activity, Download, Layers, Plus, RefreshCw, Server, Upload, Users as UsersIcon, X } from "lucide-react";

import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import IconActionButton from "@/components/IconActionButton";
import QueryState from "@/components/QueryState";
import UsersTable from "@/components/UsersTable";
import AddUserModal from "@/components/AddUserModal";

import { fetchFleetMetrics } from "@/api/users";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import useUsers from "@/hooks/useUsers";
import { useProfiles } from "@/hooks/useProfiles";
import { useOnlineUsers } from "@/hooks/useOnlineUsers";
import { useRecentRejectUsers } from "@/hooks/useDailyOpsBrief";
import { canAny } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { useSearchParams } from "@/navigation/urlSearchParams";
import type { User } from "@/types/api";

import { ActiveFiltersBar, hasActiveFilters, type RemovableFilterKey } from "./ActiveFiltersBar";
import { AccountStatusFilterDialog } from "./AccountStatusFilterDialog";
import { BulkActionsBar } from "./BulkActionsBar";
import { ExportUsersDialog } from "./ExportUsersDialog";
import { FleetMetricsPanel } from "./FleetMetricsPanel";
import { ImportUsersDialog } from "./ImportUsersDialog";
import { UsersAnalyticsView } from "./UsersAnalyticsView";
import { UsersConfirmDialog } from "./UsersConfirmDialog";
import { UsersFiltersPanel } from "./UsersFiltersPanel";
import { UsersPageSkeleton } from "./UsersPageSkeleton";
import { computeLocalMetrics, effectiveAccountStatus, filterUsers, toServerSortParams } from "./lib";
import { usersPageInitialState, usersPageReducer, type ViewMode } from "./usersPageReducer";

const UsersPage: React.FC = () => {
    const [state, dispatch] = useReducer(usersPageReducer, usersPageInitialState);
    const {
        editingUser,
        pageSize,
        isRefreshing,
        statusFilter,
        selectedUsers,
        viewMode,
        advancedFilters,
        isImportOpen,
        isExportOpen,
        confirmAction,
        isBulkActionInProgress,
    } = state;

    const { t } = useTranslation("screens");
    const [searchParams, setSearchParams] = useSearchParams();
    const router = useRouter();
    const savedViewsKeys = useMemo(
        () => ["q", "status", "account", "profile", "quotaExceeded", "hasMacAddress", "hasContactInfo", "ps", "view", "p", "sort"],
        []
    );

    const [isFiltersDialogOpen, setIsFiltersDialogOpen] = useState(false);
    const [sorting, setSorting] = useState<SortingState>([]);
    const serverSort = useMemo(() => toServerSortParams(sorting), [sorting]);

    const { user: authUser } = useAuth();
    const canSeeAudit = useMemo(() => canAny(authUser, ["users.view", "reseller.users.view"]), [authUser]);
    const canSeeLiveSessions = useMemo(
        () => canAny(authUser, ["users.online.view", "reseller.users.view"]),
        [authUser]
    );
    const canManageUsers = useMemo(() => canAny(authUser, ["users.view", "reseller.users.manage"]), [authUser]);
    const manageUsersReason = "You don't have permission to manage users.";
    const canResetDailyQuota = useMemo(() => canAny(authUser, ["users.resetDailyQuota", "reseller.users.manage"]), [authUser]);
    const canResetMonthlyQuota = useMemo(() => canAny(authUser, ["users.resetMonthlyQuota", "reseller.users.manage"]), [authUser]);
    const canSeeOpsSignals = useMemo(
        () => canAny(authUser, ["users.view", "users.online.view", "reseller.users.view"]),
        [authUser]
    );

    const {
        data,
        error,
        isLoading,
        refetch,
        setCurrentPage,
        currentPage,
        searchQuery,
        setSearchQuery,
        deleteUserMutation,
        resetMacAddressMutation,
    } = useUsers(1, pageSize, {
        accountStatus: advancedFilters.accountStatus,
        connectivityStatus: statusFilter,
        // Applied server-side so totals and pagination reflect the filters
        // instead of only narrowing the current page.
        profile: advancedFilters.profile,
        quotaExceeded: advancedFilters.quotaExceeded,
        hasMacAddress: advancedFilters.hasMacAddress,
        hasContactInfo: advancedFilters.hasContactInfo,
        ...serverSort,
    });

    const handleSortingChange = useCallback<OnChangeFn<SortingState>>((updater) => {
        setSorting((prev) => (typeof updater === "function" ? updater(prev) : updater));
        setCurrentPage(1);
    }, [setCurrentPage]);

    const profilesQuery = useProfiles();
    const recentRejectQuery = useRecentRejectUsers(canSeeOpsSignals);
    const recentRejectCounts = recentRejectQuery.data ?? {};

    // Fleet-wide metrics (all pages, reseller-scoped server side) — the paginated
    // list only covers the current page, so KPI cards use this endpoint instead.
    const fleetMetricsQuery = useQuery({
        queryKey: ["users", "fleet-metrics"],
        queryFn: fetchFleetMetrics,
        refetchInterval: 30000,
        staleTime: 15000,
    });
    const fleet = fleetMetricsQuery.data;

    // Backend sometimes returns either:
    // - { users, totalPages, ... } (normal list/search)
    // - [] (legacy "no users found" response)
    const serverUsersBase = useMemo<User[]>(() => {
        const d: any = (data as any)?.data;
        if (Array.isArray(d)) return d as User[];
        return (d?.users ?? []) as User[];
    }, [data]);

    // Live online status (avoids stale cached user-list "isOnline")
    const liveOnlineQuery = useOnlineUsers("", 1, 5000, {
        enabled: Boolean(canSeeLiveSessions),
        refetchInterval: 10000,
    });
    const liveOnlineSet = useMemo(() => {
        const rows = (liveOnlineQuery.data?.data ?? []) as any[];
        const set = new Set<string>();
        for (const r of rows) {
            const username = String(r?.session_username ?? "").trim();
            if (!username) continue;
            const status = String(r?.session_status ?? "").toLowerCase();
            if (status === "disconnected") continue;
            set.add(username);
        }
        return set;
    }, [liveOnlineQuery.data]);

    const serverUsers = useMemo<User[]>(() => {
        if (!canSeeLiveSessions) return serverUsersBase;
        // If the live query hasn't loaded (or errored), fall back to server-provided isOnline.
        if (!liveOnlineQuery.data) return serverUsersBase;
        return serverUsersBase.map((u) => ({
            ...u,
            isOnline: liveOnlineSet.has(String(u.username ?? "")),
        }));
    }, [serverUsersBase, canSeeLiveSessions, liveOnlineQuery.data, liveOnlineSet]);

    const isSearching = Boolean(searchQuery?.trim());

    // URL sync: initialize from URL on mount
    useEffect(() => {
        const q = searchParams.get("q") ?? "";
        const status = searchParams.get("status") ?? "";
        const accountFromUrl = searchParams.get("account") ?? "";
        const profile = searchParams.get("profile") ?? "all";
        const quotaExceeded = searchParams.get("quotaExceeded") === "true";
        const hasMacAddress = searchParams.get("hasMacAddress") === "true";
        const hasContactInfo = searchParams.get("hasContactInfo") === "true";
        const ps = parseInt(searchParams.get("ps") ?? "", 10);
        const view = (searchParams.get("view") ?? "table") as ViewMode;
        const p = parseInt(searchParams.get("p") ?? "", 10);
        const sort = searchParams.get("sort") ?? "";
        if (q) setSearchQuery(q);

        if (sort.includes(":")) {
            const [sortId, dir] = sort.split(":");
            if (sortId) setSorting([{ id: sortId, desc: dir === "desc" }]);
        }

        let accountStatus = accountFromUrl;
        if (!accountStatus && (status === "active" || status === "suspended")) {
            accountStatus = status;
        }
        const connectivityStatus =
            status && status !== "active" && status !== "suspended" ? status : "";
        if (connectivityStatus) dispatch({ type: "SET_STATUS_FILTER", payload: connectivityStatus });
        else if (accountStatus) dispatch({ type: "SET_STATUS_FILTER", payload: "" });

        if (
            profile !== "all" ||
            quotaExceeded ||
            hasMacAddress ||
            hasContactInfo ||
            accountFromUrl ||
            status === "active" ||
            status === "suspended"
        ) {
            dispatch({
                type: "SET_ADVANCED_FILTERS",
                payload: { accountStatus, profile, quotaExceeded, hasMacAddress, hasContactInfo },
            });
        }
        if (Number.isFinite(ps) && ps > 0) dispatch({ type: "SET_PAGE_SIZE", payload: ps });
        if (["table", "cards", "analytics"].includes(view)) dispatch({ type: "SET_VIEW_MODE", payload: view });
        if (Number.isFinite(p) && p > 0) setCurrentPage(p);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // URL sync: persist state to URL
    useEffect(() => {
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            if (searchQuery) next.set("q", searchQuery); else next.delete("q");
            if (advancedFilters.accountStatus) next.set("account", advancedFilters.accountStatus); else next.delete("account");
            if (statusFilter) next.set("status", statusFilter); else next.delete("status");
            if (advancedFilters.profile !== "all") next.set("profile", advancedFilters.profile); else next.delete("profile");
            if (advancedFilters.quotaExceeded) next.set("quotaExceeded", "true"); else next.delete("quotaExceeded");
            if (advancedFilters.hasMacAddress) next.set("hasMacAddress", "true"); else next.delete("hasMacAddress");
            if (advancedFilters.hasContactInfo) next.set("hasContactInfo", "true"); else next.delete("hasContactInfo");
            next.set("ps", String(pageSize));
            next.set("view", viewMode);
            next.set("p", String(currentPage));
            if (sorting[0]) next.set("sort", `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}`);
            else next.delete("sort");
            return next;
        }, { replace: true } as any);
    }, [searchQuery, statusFilter, advancedFilters, pageSize, viewMode, currentPage, sorting, setSearchParams]);

    const filteredUsers = useMemo(
        () => filterUsers(serverUsers, statusFilter, advancedFilters),
        [serverUsers, statusFilter, advancedFilters]
    );

    // Safety net: a filter change can leave us on a page that no longer exists in
    // the narrower result set. Snap back to the last available page.
    const loadedTotalPages = Array.isArray((data as any)?.data) ? 1 : ((data as any)?.data?.totalPages ?? 1);
    useEffect(() => {
        if (loadedTotalPages > 0 && currentPage > loadedTotalPages) {
            setCurrentPage(Math.max(1, loadedTotalPages));
        }
    }, [loadedTotalPages, currentPage, setCurrentPage]);

    const metrics = useMemo(() => computeLocalMetrics(serverUsers, filteredUsers), [serverUsers, filteredUsers]);

    const handleSearch = useCallback((term: string) => {
        setSearchQuery(term);
        setCurrentPage(1);
    }, [setSearchQuery, setCurrentPage]);

    const handleRefresh = useCallback(() => {
        dispatch({ type: "SET_IS_REFRESHING", payload: true });
        refetch().finally(() => {
            setTimeout(() => {
                dispatch({ type: "SET_IS_REFRESHING", payload: false });
                notify.success(MESSAGES.users.refreshedTitle, MESSAGES.users.refreshedDescription);
            }, 1000);
        });
    }, [refetch]);

    const handleAddUser = useCallback(() => {
        router.push("/users/new");
    }, [router]);

    const handleUserAdded = useCallback(() => {
        refetch();
        dispatch({ type: "SET_ADD_USER_MODAL_OPEN", payload: false });
        dispatch({ type: "SET_EDITING_USER", payload: null });
    }, [refetch]);

    const handleCloseModal = useCallback(() => {
        dispatch({ type: "SET_ADD_USER_MODAL_OPEN", payload: false });
        dispatch({ type: "SET_EDITING_USER", payload: null });
    }, []);

    const handleQuickFilter = useCallback((filter: string) => {
        switch (filter) {
            case "all":
                dispatch({ type: "SET_STATUS_FILTER", payload: "" });
                dispatch({
                    type: "SET_ADVANCED_FILTERS",
                    payload: { ...advancedFilters, accountStatus: "" },
                });
                break;
            case "suspended":
                dispatch({ type: "SET_STATUS_FILTER", payload: "" });
                dispatch({
                    type: "SET_ADVANCED_FILTERS",
                    payload: { ...advancedFilters, accountStatus: "suspended" },
                });
                break;
            case "online":
            case "offline":
            case "risk":
                dispatch({ type: "SET_STATUS_FILTER", payload: filter });
                break;
            default:
                dispatch({ type: "SET_STATUS_FILTER", payload: "" });
        }
        setCurrentPage(1);
    }, [advancedFilters, setCurrentPage]);

    const quickFilterPillValue = useMemo(() => {
        if (statusFilter === "online") return "online";
        if (statusFilter === "offline") return "offline";
        if (statusFilter === "risk") return "risk";
        if (advancedFilters.accountStatus === "suspended" || statusFilter === "suspended") return "suspended";
        return "all";
    }, [statusFilter, advancedFilters.accountStatus]);

    const displayAccountFilter = useMemo(
        () => effectiveAccountStatus(statusFilter, advancedFilters),
        [statusFilter, advancedFilters]
    );

    const currentAttributeFilter = advancedFilters.quotaExceeded
        ? "quota"
        : advancedFilters.hasMacAddress
            ? "mac"
            : advancedFilters.hasContactInfo
                ? "contact"
                : "all";

    const setAttributeFilter = useCallback((value: string) => {
        dispatch({
            type: "SET_ADVANCED_FILTERS",
            payload: {
                ...advancedFilters,
                quotaExceeded: value === "quota",
                hasMacAddress: value === "mac",
                hasContactInfo: value === "contact",
            },
        });
        setCurrentPage(1);
    }, [advancedFilters, setCurrentPage]);

    const handleProfileFilter = useCallback((value: string) => {
        dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, profile: value } });
        setCurrentPage(1);
    }, [advancedFilters, setCurrentPage]);

    const applyAccountStatusFilter = useCallback((status: string) => {
        dispatch({
            type: "SET_ADVANCED_FILTERS",
            payload: { ...advancedFilters, accountStatus: advancedFilters.accountStatus === status ? "" : status },
        });
        if (statusFilter === "active" || statusFilter === "suspended") {
            dispatch({ type: "SET_STATUS_FILTER", payload: "" });
        }
        setCurrentPage(1);
    }, [advancedFilters, statusFilter, setCurrentPage]);

    const clearAllFilters = useCallback(() => {
        setSearchQuery("");
        dispatch({ type: "SET_STATUS_FILTER", payload: "" });
        dispatch({
            type: "SET_ADVANCED_FILTERS",
            payload: {
                accountStatus: "",
                profile: "all",
                quotaExceeded: false,
                hasMacAddress: false,
                hasContactInfo: false,
            },
        });
        setCurrentPage(1);
    }, [setSearchQuery, setCurrentPage]);

    const removeFilter = useCallback((key: RemovableFilterKey) => {
        switch (key) {
            case "search":
                setSearchQuery("");
                break;
            case "account":
                dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, accountStatus: "" } });
                if (statusFilter === "active" || statusFilter === "suspended") {
                    dispatch({ type: "SET_STATUS_FILTER", payload: "" });
                }
                break;
            case "status":
                dispatch({ type: "SET_STATUS_FILTER", payload: "" });
                break;
            case "profile":
                dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, profile: "all" } });
                break;
            case "quotaExceeded":
                dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, quotaExceeded: false } });
                break;
            case "hasMacAddress":
                dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, hasMacAddress: false } });
                break;
            case "hasContactInfo":
                dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, hasContactInfo: false } });
                break;
        }
        setCurrentPage(1);
    }, [advancedFilters, statusFilter, setSearchQuery, setCurrentPage]);

    const handleAction = useCallback((action: string, user: User) => {
        const actions = {
            edit: () => {
                dispatch({ type: "SET_EDITING_USER", payload: user });
                dispatch({ type: "SET_ADD_USER_MODAL_OPEN", payload: true });
            },
            delete: () => dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'delete-user', username: user.username } }),
            'reset-mac': () => dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'reset-mac', username: user.username } }),
            // Not wired in Users module yet (Live Sessions has it); keep consistent UX.
            'reset-quota': () => dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'reset-quota', username: user.username } }),
            'reset-monthly': () => dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'reset-monthly-quota', username: user.username } }),
            renew: () => dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'renew-subscription', username: user.username } }),
            disconnect: async () => {
                try {
                    await apiClient.post("/sessions/disconnect", { username: user.username });
                    notify.success("Disconnected", `Kicked active session for ${user.username}`);
                    refetch();
                } catch (err: any) {
                    notify.error("Disconnect Failed", err?.response?.data?.message || err?.message || "Could not kick user session.");
                }
            },
        };

        const actionFunction = actions[action as keyof typeof actions];
        if (actionFunction) {
            actionFunction();
        } else {
            console.warn('Unknown action:', action);
        }
    }, [refetch]);

    const handlePageSizeChange = useCallback((newSize: number) => {
        dispatch({ type: "SET_PAGE_SIZE", payload: newSize });
        setCurrentPage(1); // Reset to first page when changing page size
    }, [setCurrentPage]);

    const handleSelectAll = useCallback((selected: boolean) => {
        if (selected) {
            dispatch({ type: "SET_SELECTED_USERS", payload: new Set(filteredUsers.map(u => u.id)) });
        } else {
            dispatch({ type: "SET_SELECTED_USERS", payload: new Set() });
        }
    }, [filteredUsers]);

    const handleToggleSelected = useCallback((userId: number, selected: boolean) => {
        const next = new Set(selectedUsers);
        if (selected) next.add(userId);
        else next.delete(userId);
        dispatch({ type: "SET_SELECTED_USERS", payload: next });
    }, [selectedUsers]);

    const handleBulkAction = useCallback((action: string) => {
        const selectedUserList = filteredUsers.filter(u => selectedUsers.has(u.id));
        const usernames = selectedUserList.map((u) => u.username).filter(Boolean);

        switch (action) {
            case 'suspend':
            case 'activate':
            case 'delete':
            case 'renew':
                dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'bulk', action, usernames } });
                break;
            case 'reset-mac':
                dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'bulk', action: 'reset-mac', usernames } });
                break;
            case 'export':
                dispatch({ type: "SET_EXPORT_OPEN", payload: true });
                break;
            default: {
                if (action.startsWith('assign-profile:')) {
                    const pid = Number(action.split(':')[1]);
                    const p = (profilesQuery.data?.data ?? []).find((x: any) => Number(x.id) === pid);
                    dispatch({ type: "SET_CONFIRM_ACTION", payload: { kind: 'bulk', action: 'assign-profile', usernames, profileId: pid, profileName: p?.profileName } });
                }
            }
        }
    }, [selectedUsers, filteredUsers, profilesQuery.data?.data]);

    const getSavedViewState = useCallback(() => ({
        q: searchQuery || "",
        status: statusFilter || "",
        account: advancedFilters.accountStatus || "",
        profile: advancedFilters.profile || "",
        quotaExceeded: advancedFilters.quotaExceeded ? "true" : "",
        hasMacAddress: advancedFilters.hasMacAddress ? "true" : "",
        hasContactInfo: advancedFilters.hasContactInfo ? "true" : "",
        ps: String(pageSize),
        view: viewMode,
        p: String(currentPage),
        sort: sorting[0] ? `${sorting[0].id}:${sorting[0].desc ? "desc" : "asc"}` : "",
    }), [searchQuery, statusFilter, advancedFilters, pageSize, viewMode, currentPage, sorting]);

    const applySavedViewState = useCallback((s: Record<string, string | undefined>) => {
        if (s.q !== undefined) setSearchQuery(s.q || "");
        if (s.status !== undefined) dispatch({ type: "SET_STATUS_FILTER", payload: s.status || "" });
        if (s.account !== undefined) {
            dispatch({
                type: "SET_ADVANCED_FILTERS",
                payload: { ...advancedFilters, accountStatus: s.account || "" },
            });
        }
        if (s.profile !== undefined) dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, profile: s.profile || "all" } });
        if (s.quotaExceeded !== undefined) dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, quotaExceeded: s.quotaExceeded === "true" } });
        if (s.hasMacAddress !== undefined) dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, hasMacAddress: s.hasMacAddress === "true" } });
        if (s.hasContactInfo !== undefined) dispatch({ type: "SET_ADVANCED_FILTERS", payload: { ...advancedFilters, hasContactInfo: s.hasContactInfo === "true" } });
        if (s.ps) { const n = parseInt(s.ps, 10); if (Number.isFinite(n)) dispatch({ type: "SET_PAGE_SIZE", payload: n }); }
        if (s.view && ["table", "cards", "analytics"].includes(s.view)) dispatch({ type: "SET_VIEW_MODE", payload: s.view as ViewMode });
        if (s.p) { const n = parseInt(s.p, 10); if (Number.isFinite(n) && n > 0) setCurrentPage(n); }
        if (s.sort !== undefined) {
            if (s.sort && s.sort.includes(":")) {
                const [sortId, dir] = s.sort.split(":");
                if (sortId) setSorting([{ id: sortId, desc: dir === "desc" }]);
            } else {
                setSorting([]);
            }
        }
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev);
            savedViewsKeys.forEach((key) => {
                const value = s[key];
                if (value) next.set(key, value); else next.delete(key);
            });
            return next;
        }, { replace: true } as any);
        refetch();
    }, [advancedFilters, savedViewsKeys, setSearchQuery, setCurrentPage, setSearchParams, refetch]);

    return (
        <>
        <UsersConfirmDialog
            confirmAction={confirmAction}
            onClose={() => dispatch({ type: "SET_CONFIRM_ACTION", payload: null })}
            onBusyChange={(busy) => dispatch({ type: "SET_BULK_ACTION_IN_PROGRESS", payload: busy })}
            deleteUser={(username) => deleteUserMutation.mutateAsync(username)}
            resetMacAddress={(username) => resetMacAddressMutation.mutateAsync(username)}
            refetch={refetch}
            clearSelection={() => dispatch({ type: "SET_SELECTED_USERS", payload: new Set() })}
        />

        <QueryState
            isLoading={isLoading}
            error={error}
            // Only show the full-page "empty" state when there are truly no users in the system.
            // If search returns 0 results, keep rendering the page so the user can clear the search
            // and so the table can show "No users found".
            isEmpty={!isLoading && !error && !isSearching && serverUsers.length === 0}
            onRetry={() => refetch()}
            loading={<UsersPageSkeleton title={t("users.title")} subtitle={t("users.subtitle_loading")} />}
            errorTitle="Failed to load users"
            emptyTitle="No users yet"
            emptyDescription="Create your first user to get started."
        >
        <div className="w-full min-w-0 space-y-5">
            <PageHeader
                title={t("users.title")}
                subtitle={t("users.subtitle")}
                icon={UsersIcon}
                actions={(
                    <div className="flex w-full flex-wrap gap-2 sm:justify-end">
                        <IconActionButton
                            label={isRefreshing ? "Refreshing..." : "Refresh"}
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="border-border bg-card text-foreground shadow-none hover:bg-muted"
                            icon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />}
                        />
                        <IconActionButton
                            label="Export Excel"
                            onClick={() => dispatch({ type: "SET_EXPORT_OPEN", payload: true })}
                            className="border-border bg-card text-foreground shadow-none hover:bg-muted"
                            icon={<Download className="h-4 w-4" />}
                        />
                        <IconActionButton
                            label={!canManageUsers ? manageUsersReason : "Import CSV"}
                            onClick={() => dispatch({ type: "SET_IMPORT_OPEN", payload: true })}
                            disabled={!canManageUsers}
                            className="border-border bg-card text-foreground shadow-none hover:bg-muted"
                            icon={<Upload className="h-4 w-4" />}
                        />
                        <IconActionButton
                            label={!canManageUsers ? manageUsersReason : "New User"}
                            onClick={handleAddUser}
                            disabled={!canManageUsers}
                            className="border-primary/20 bg-primary text-primary-foreground shadow-none hover:bg-primary/90"
                            icon={<Plus className="h-4 w-4" />}
                        />
                    </div>
                )}
            />

            {/* Quick links to related screens */}
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-border/60 bg-muted/20 p-1.5">
                {canSeeLiveSessions ? (
                    <Button variant="ghost" size="sm" className="h-8 rounded-md text-xs text-muted-foreground hover:text-primary" asChild>
                        <Link href="/online-users">
                            <Activity className="mr-2 h-4 w-4" />
                            Live sessions
                        </Link>
                    </Button>
                ) : null}
                <Button variant="ghost" size="sm" className="h-8 rounded-md text-xs text-muted-foreground hover:text-primary" asChild>
                    <Link href="/nas">
                        <Server className="mr-2 h-4 w-4" />
                        NAS devices
                    </Link>
                </Button>
                <Button variant="ghost" size="sm" className="h-8 rounded-md text-xs text-muted-foreground hover:text-primary" asChild>
                    <Link href="/profiles/list">
                        <Layers className="mr-2 h-4 w-4" />
                        Profiles
                    </Link>
                </Button>
            </div>

            {/* Fleet-wide KPIs (all users, not just the current page) */}
            <FleetMetricsPanel
                fleet={fleet}
                metrics={metrics}
                isLoading={isLoading}
                activeAccountStatus={advancedFilters.accountStatus}
                onClearAllFilters={clearAllFilters}
                onQuickFilter={handleQuickFilter}
                onQuotaFilter={() => setAttributeFilter("quota")}
                onAccountStatusFilter={applyAccountStatusFilter}
            />

            {/* Search & filters */}
            <UsersFiltersPanel
                searchQuery={searchQuery}
                onSearch={handleSearch}
                quickFilterValue={quickFilterPillValue}
                onQuickFilter={handleQuickFilter}
                profileFilterValue={advancedFilters.profile}
                onProfileFilter={handleProfileFilter}
                attributeFilterValue={currentAttributeFilter}
                onAttributeFilter={setAttributeFilter}
                onOpenAccountStatusDialog={() => setIsFiltersDialogOpen(true)}
                savedViewsKeys={savedViewsKeys}
                getSavedViewState={getSavedViewState}
                applySavedViewState={applySavedViewState}
                onViewSaved={(name) => notify.success("View saved", `Saved "${name}".`)}
                onViewDeleted={(name) => notify.success("View deleted", `Deleted "${name}".`)}
                viewMode={viewMode}
                onViewModeChange={(mode) => dispatch({ type: "SET_VIEW_MODE", payload: mode })}
            />

            <ActiveFiltersBar
                searchQuery={searchQuery}
                displayAccountFilter={displayAccountFilter}
                statusFilter={statusFilter}
                filters={advancedFilters}
                onRemove={removeFilter}
                onClearAll={clearAllFilters}
            />

            {/* Clear filters CTA when no results */}
            {filteredUsers.length === 0 &&
                !isLoading &&
                hasActiveFilters(searchQuery, displayAccountFilter, statusFilter, advancedFilters) && (
                <Card className="border-border/60 bg-card shadow-none">
                    <CardContent className="flex flex-col items-center justify-between gap-3 p-4 sm:flex-row">
                        <p className="text-sm text-muted-foreground">
                            No users match your current filters. Clear filters to see all users.
                        </p>
                        <IconActionButton
                            label="Clear all filters"
                            onClick={clearAllFilters}
                            variant="outline"
                            icon={<X className="h-4 w-4" />}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Bulk Actions */}
            {selectedUsers.size > 0 && (
                <BulkActionsBar
                    selectedUsers={selectedUsers}
                    onBulkAction={handleBulkAction}
                    onSelectAll={handleSelectAll}
                    allUsers={filteredUsers}
                    profiles={profilesQuery.data?.data ?? []}
                    isBulkActionInProgress={isBulkActionInProgress}
                />
            )}

            {/* Content based on view mode */}
            {viewMode === 'analytics' ? (
                <UsersAnalyticsView
                    filteredUsers={filteredUsers}
                    metrics={metrics}
                    canSeeAudit={Boolean(canSeeAudit)}
                />
            ) : (
                <UsersTable
                    users={filteredUsers}
                    displayMode={viewMode}
                    currentPage={currentPage}
                    totalPages={Array.isArray((data as any)?.data) ? 1 : ((data as any)?.data?.totalPages ?? 0)}
                    totalUsers={Array.isArray((data as any)?.data) ? serverUsers.length : ((data as any)?.data?.totalUsers ?? 0)}
                    onPageChange={setCurrentPage}
                    onAction={handleAction}
                    isLoading={isLoading}
                    pageSize={pageSize}
                    onPageSizeChange={handlePageSizeChange}
                    deleteUserMutation={deleteUserMutation}
                    resetMacAddressMutation={resetMacAddressMutation}
                    selectedUserIds={selectedUsers}
                    onToggleSelected={handleToggleSelected}
                    onToggleSelectAll={handleSelectAll}
                    canManageUsers={canManageUsers}
                    manageUsersReason={manageUsersReason}
                    canResetDailyQuota={canResetDailyQuota}
                    canResetMonthlyQuota={canResetMonthlyQuota}
                    recentRejectCounts={recentRejectCounts}
                    sorting={sorting}
                    onSortingChange={handleSortingChange}
                />
            )}

            {/* Edit User Modal (new user goes to /users/new page) */}
            {editingUser && (
                <AddUserModal
                    isOpen={!!editingUser}
                    onClose={handleCloseModal}
                    onUserAdded={handleUserAdded}
                    editingUser={editingUser}
                />
            )}

            <ImportUsersDialog
                open={isImportOpen}
                onOpenChange={(open) => dispatch({ type: "SET_IMPORT_OPEN", payload: open })}
                onImported={refetch}
            />

            <AccountStatusFilterDialog
                open={isFiltersDialogOpen}
                onOpenChange={setIsFiltersDialogOpen}
                currentStatus={advancedFilters.accountStatus}
                onApply={(accountStatus) => {
                    dispatch({
                        type: "SET_ADVANCED_FILTERS",
                        payload: { ...advancedFilters, accountStatus },
                    });
                    if (statusFilter === "active" || statusFilter === "suspended") {
                        dispatch({ type: "SET_STATUS_FILTER", payload: "" });
                    }
                    setCurrentPage(1);
                }}
            />

            <ExportUsersDialog
                open={isExportOpen}
                onOpenChange={(open) => dispatch({ type: "SET_EXPORT_OPEN", payload: open })}
                filteredUsers={filteredUsers}
            />
        </div>
        </QueryState>
        </>
    );
};

export default UsersPage;
