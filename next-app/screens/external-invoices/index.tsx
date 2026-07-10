import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import {
  AlertCircle,
  Calendar,
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import IconActionButton from "@/components/IconActionButton";
import PageHeader from "@/components/PageHeader";
import ExternalInvoicesTable, { type ExternalInvoicesTableData } from "@/components/ExternalInvoicesTable";
import { useExternalInvoices } from "@/hooks/useExternalInvoices";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import {
  fetchAllExternalInvoicePages,
  remindExternalInvoice,
  setExternalInvoiceWorkflow,
} from "@/api/invoices";
import { getReconciliationFlagsMap, type ReconciliationFlag, type WorkflowStage } from "@/lib/externalInvoiceInsights";
import type { ExternalInvoice } from "@/types/api";
import { useExternalInvoicesPageState } from "./useExternalInvoicesPageState";
import { useExternalInvoicesUrlSync } from "./useExternalInvoicesUrlSync";
import { useAgingSummary } from "./useAgingSummary";
import { InvoiceMetricsPanel } from "./InvoiceMetricsPanel";
import { InvoiceFiltersPanel } from "./InvoiceFiltersPanel";
import { ReconciliationBanner } from "./ReconciliationBanner";
import { BulkActionsBar } from "./BulkActionsBar";
import { DateFilterDialog } from "./DateFilterDialog";
import { ReminderPreviewDialog } from "./ReminderPreviewDialog";
import {
  BulkPayDueDialog,
  ConfirmBulkDeleteDialog,
  ConfirmBulkPaidDialog,
  PromiseToPayDialog,
} from "./BulkDialogs";

export function ExternalInvoicesPageImpl({ mode = "standard" }: { mode?: "standard" | "reconciliation" }) {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const canViewTotals = can(user, "billing.externalInvoices.viewTotals");
  const canPayExternalInvoices = can(user, "billing.externalInvoices.pay");
  const canUploadInvoice = can(user, "billing.invoiceUpload.create") && isFeatureEnabled("invoice-upload");

  const defaultPageSize = 50;
  const {
    searchTerm,
    searchInput,
    refreshKey,
    rowSelection,
    pageSize,
    isConfirmBulkPaidOpen,
    isConfirmBulkDeleteOpen,
    isExportingAll,
    isBulkPaidInProgress,
    isDateFilterOpen,
    draftDateRange,
    setSearchTerm,
    setSearchInput,
    setPageSize,
    setCurrentPage,
    setIsConfirmBulkPaidOpen,
    setIsConfirmBulkDeleteOpen,
    setIsExportingAll,
    setIsBulkPaidInProgress,
    setIsDateFilterOpen,
    setDraftDateRange,
    incrementRefreshKey,
    setRowSelection,
  } = useExternalInvoicesPageState(defaultPageSize);
  const [searchParams, setSearchParams] = useSearchParams();
  const savedViewsKeys = useMemo(
    () => (mode === "reconciliation" ? ["q", "from", "to", "status", "age", "missing", "payDue", "ps", "sort"] : ["q", "from", "to", "status", "missing", "payDue", "ps", "sort"]),
    [mode]
  );
  const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false);
  const [reminderTargets, setReminderTargets] = useState<ExternalInvoice[]>([]);
  const [isPromiseDialogOpen, setIsPromiseDialogOpen] = useState(false);
  const [isBulkPayDueOpen, setIsBulkPayDueOpen] = useState(false);
  const [bulkPayDueDate, setBulkPayDueDate] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(() => new Date());
  const isReconciliationMode = mode === "reconciliation";
  const [reconciliationFilter, setReconciliationFilter] = useState<"all" | ReconciliationFlag>("all");
  const graceDays = 7;
  const { dateRange } = useExternalInvoicesUrlSync({
    defaultPageSize,
    searchParams,
    setSearchParams,
    searchTerm,
    pageSize,
    setSearchTerm,
    setSearchInput,
    setPageSize,
    setCurrentPage,
  });

  // When opening the date dialog, start from current URL range.
  useEffect(() => {
    if (!isDateFilterOpen) return;
    setDraftDateRange(dateRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDateFilterOpen, dateRange]);

  // Map 'overdue' to 'unpaid' for API (backend stores paid/unpaid/pending only)
  const apiStatus = searchParams.get("status") === "overdue" ? "unpaid" : (searchParams.get("status") || undefined);
  const ageBucket = searchParams.get("age") || undefined;

  // The table owns the (single) list query and reports its data back through
  // onDataLoaded; this hook instance is mutations-only (enabled: false).
  const { setInvoiceAsPaidMutation, bulkDeleteInvoicesMutation, bulkUpdateInvoicesMutation } = useExternalInvoices({
    initialPage: 1,
    pageSize: 1,
    search: "",
    enabled: false,
  });

  const [tableData, setTableData] = useState<ExternalInvoicesTableData | null>(null);
  const metrics = tableData?.metrics;
  const isStatsLoading = tableData ? tableData.isLoading : true;

  const invalidateInvoiceQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["externalInvoices"] });
    queryClient.invalidateQueries({ queryKey: ["externalAgingSummary"] });
  }, [queryClient]);

  const reconciliationDataQuery = useQuery({
    queryKey: [
      "externalInvoicesReconciliationDataset",
      isReconciliationMode,
      searchTerm,
      searchParams.get("from"),
      searchParams.get("to"),
      apiStatus,
      ageBucket,
      graceDays,
    ],
    enabled: isReconciliationMode,
    queryFn: () =>
      fetchAllExternalInvoicePages({
        search: searchTerm || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        status: apiStatus,
        ageBucket,
        graceDays,
      }),
  });

  const agingSummaryQuery = useAgingSummary({
    searchTerm,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    status: apiStatus,
    graceDays,
  });

  const sendRemindersMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => remindExternalInvoice(id)));
      const sent = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - sent;
      return { sent, failed };
    },
    onSuccess: (result) => {
      if (result.failed > 0) {
        notify.error("Reminder partial", `Sent ${result.sent}, failed ${result.failed}.`);
      } else {
        notify.success("Reminder sent", `Sent ${result.sent} reminder(s).`);
      }
      invalidateInvoiceQueries();
    },
    onError: (e: unknown) => {
      notify.error("Reminder failed", e instanceof Error ? e.message : "Could not send reminder.");
    },
  });

  const workflowMutation = useMutation({
    mutationFn: async (payload: { invoiceId: number; stage: WorkflowStage; promiseDate?: string | null }) =>
      setExternalInvoiceWorkflow(payload.invoiceId, { stage: payload.stage, promiseDate: payload.promiseDate }),
    onSuccess: () => {
      notify.success("Workflow updated", "Collection workflow stage saved.");
      incrementRefreshKey();
      invalidateInvoiceQueries();
    },
    onError: (e: unknown) => {
      notify.error("Workflow failed", e instanceof Error ? e.message : "Could not update workflow.");
    },
  });

  const handleSearch = useCallback((term: string) => {
    setSearchInput(term);
    setSearchTerm(term);
    setCurrentPage(1);
  }, [setSearchInput, setSearchTerm, setCurrentPage]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    incrementRefreshKey();
    setLastRefreshedAt(new Date());
    Promise.resolve(invalidateInvoiceQueries()).finally(() => {
      window.setTimeout(() => setIsRefreshing(false), 400);
    });
  }, [incrementRefreshKey, invalidateInvoiceQueries]);

  const clearSearchFields = useCallback(() => {
    setSearchTerm("");
    setSearchInput("");
  }, [setSearchInput, setSearchTerm]);

  const updateSearchParams = useCallback((mutate: (next: URLSearchParams) => void) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      mutate(next);
      return next;
    }, { replace: true } as any);
  }, [setSearchParams]);

  const handleQuickFilter = useCallback((filter: string) => {
    const applyDateRange = (daysBackInclusive: number) => {
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - daysBackInclusive);
      updateSearchParams((next) => {
        next.set("from", from.toISOString().slice(0, 10));
        next.set("to", to.toISOString().slice(0, 10));
      });
    };

    clearSearchFields();
    switch (filter) {
      case "pending":
        updateSearchParams((next) => {
          next.set("status", "pending");
          next.delete("age");
        });
        break;
      case "paid":
        updateSearchParams((next) => {
          next.set("status", "paid");
          next.delete("age");
        });
        break;
      case "overdue":
        updateSearchParams((next) => {
          next.set("status", "overdue");
          if (!next.get("age")) next.set("age", "1_30");
        });
        break;
      case "today":
        updateSearchParams((next) => {
          const today = new Date().toISOString().slice(0, 10);
          next.set("from", today);
          next.set("to", today);
        });
        break;
      case "last7d":
        applyDateRange(6);
        break;
      case "last30d":
        applyDateRange(29);
        break;
      default:
        updateSearchParams((next) => {
          next.delete("from");
          next.delete("to");
          next.delete("status");
          next.delete("age");
        });
    }
    setCurrentPage(1); // Reset to first page on filter change
  }, [clearSearchFields, setCurrentPage, updateSearchParams]);

  const handleAgeBucketFilter = useCallback((bucket: string) => {
    updateSearchParams((next) => {
      if (!bucket || bucket === "all") next.delete("age");
      else next.set("age", bucket);
      if (!next.get("status")) next.set("status", "overdue");
    });
    setCurrentPage(1);
  }, [setCurrentPage, updateSearchParams]);

  const handleMissingFilter = useCallback((value: string) => {
    updateSearchParams((next) => {
      if (!value || value === "all") next.delete("missing");
      else next.set("missing", value);
    });
    setCurrentPage(1);
  }, [setCurrentPage, updateSearchParams]);

  const handlePayDueFilter = useCallback((value: string) => {
    updateSearchParams((next) => {
      if (!value || value === "all") next.delete("payDue");
      else next.set("payDue", value);
    });
    setCurrentPage(1);
  }, [setCurrentPage, updateSearchParams]);

  const handleRemoveParams = useCallback((keys: string[]) => {
    updateSearchParams((next) => {
      keys.forEach((k) => next.delete(k));
    });
    setCurrentPage(1);
  }, [setCurrentPage, updateSearchParams]);

  const selectedIds = useMemo(() => {
    return Object.keys(rowSelection)
      .map((k) => parseInt(k, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [rowSelection]);

  const selectedInvoices = useMemo(() => {
    const rows = tableData?.rows ?? [];
    const idSet = new Set(selectedIds);
    return rows.filter((inv) => idSet.has(inv.id));
  }, [tableData?.rows, selectedIds]);

  const handleBulkSetPayDue = useCallback(() => {
    if (!bulkPayDueDate || selectedIds.length === 0) return;
    bulkUpdateInvoicesMutation.mutate(
      { invoiceIds: selectedIds, payDueDate: bulkPayDueDate },
      {
        onSuccess: () => {
          setIsBulkPayDueOpen(false);
          setBulkPayDueDate("");
          setRowSelection({});
        },
      }
    );
  }, [bulkPayDueDate, bulkUpdateInvoicesMutation, selectedIds, setRowSelection]);

  const openReminderPreview = useCallback((targets: ExternalInvoice[]) => {
    if (!targets.length) {
      notify.error("No selection", "Select at least one invoice.");
      return;
    }
    setReminderTargets(targets);
    setIsReminderDialogOpen(true);
  }, []);

  const handleSendRemindersConfirm = useCallback(async () => {
    const ids = reminderTargets.map((x) => x.id);
    if (!ids.length) return;
    setIsReminderDialogOpen(false);
    await sendRemindersMutation.mutateAsync(ids);
  }, [reminderTargets, sendRemindersMutation]);

  const handleSetWorkflowStage = useCallback((invoiceId: number, stage: WorkflowStage) => {
    workflowMutation.mutate({ invoiceId, stage });
  }, [workflowMutation]);

  const handleSetPromiseDate = useCallback((date: string) => {
    if (!date || selectedIds.length === 0) return;
    selectedIds.forEach((invoiceId) => {
      workflowMutation.mutate({ invoiceId, stage: "promise_to_pay", promiseDate: date });
    });
    setIsPromiseDialogOpen(false);
  }, [selectedIds, workflowMutation]);

  const openPromiseDialog = useCallback(() => {
    const suggestion = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    setPromiseDate(suggestion);
    setIsPromiseDialogOpen(true);
  }, []);

  const reconciliationRows = useMemo(
    () =>
      isReconciliationMode
        ? (reconciliationDataQuery.data ?? tableData?.rows ?? [])
        : (tableData?.rows ?? []),
    [isReconciliationMode, reconciliationDataQuery.data, tableData?.rows]
  );
  const reconciliationFlagsMap = useMemo(
    () => getReconciliationFlagsMap(reconciliationRows),
    [reconciliationRows]
  );
  const flaggedCount = reconciliationFlagsMap.size;
  const rowPredicate = useMemo(() => {
    if (!isReconciliationMode || reconciliationFilter === "all") return undefined;
    return (inv: ExternalInvoice) => (reconciliationFlagsMap.get(inv.id) || []).includes(reconciliationFilter);
  }, [isReconciliationMode, reconciliationFilter, reconciliationFlagsMap]);

  const handleBulkPaid = useCallback(async () => {
    if (!canPayExternalInvoices || selectedIds.length === 0) return;
    setIsBulkPaidInProgress(true);
    try {
      await Promise.all(
        selectedIds
          .filter((id) => id)
          .map((id) =>
            setInvoiceAsPaidMutation.mutateAsync({ invoiceId: id, silent: true })
          )
      );
      setRowSelection({});
      notify.success(MESSAGES.externalInvoices.markingPaidTitle, `${selectedIds.length} invoice(s) marked as paid.`);
    } catch (e: unknown) {
      notify.error("Action failed", e instanceof Error ? e.message : "Some invoices could not be marked as paid.");
    } finally {
      setIsBulkPaidInProgress(false);
    }
  }, [canPayExternalInvoices, selectedIds, setInvoiceAsPaidMutation, setIsBulkPaidInProgress, setRowSelection]);

  const handleExportSelected = useCallback(async () => {
    if (!selectedInvoices.length) return;
    const xlsx = await import("xlsx");
    const ws = xlsx.utils.json_to_sheet(selectedInvoices);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Selected Invoices");
    xlsx.writeFile(wb, "external_invoices_selected.xlsx");
    notify.success(MESSAGES.externalInvoices.exportedTitle, `${selectedInvoices.length} selected invoice(s) exported.`);
  }, [selectedInvoices]);

  const handleExportAll = useCallback(async () => {
    setIsExportingAll(true);
    try {
      const sortParam = searchParams.get("sort") || "";
      const [sortBy, sortDir] = sortParam.split(":");
      const allRows = await fetchAllExternalInvoicePages({
        search: searchTerm || undefined,
        from: searchParams.get("from") || undefined,
        to: searchParams.get("to") || undefined,
        status: apiStatus,
        ageBucket,
        graceDays,
        sortBy: sortBy || undefined,
        sortDir: (sortDir as "asc" | "desc") || undefined,
      });

      if (!allRows.length) {
        notify.error("Export failed", "No invoices to export.");
        return;
      }

      const xlsx = await import("xlsx");
      const ws = xlsx.utils.json_to_sheet(allRows);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "External Invoices");
      xlsx.writeFile(wb, `external_invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
      notify.success(MESSAGES.externalInvoices.exportedTitle, `${allRows.length} invoice(s) exported.`);
    } catch (e: unknown) {
      notify.error("Export failed", e instanceof Error ? e.message : "Could not export invoices.");
    } finally {
      setIsExportingAll(false);
    }
  }, [ageBucket, apiStatus, graceDays, searchParams, searchTerm, setIsExportingAll]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.length === 0) return;
    try {
      const result = await bulkDeleteInvoicesMutation.mutateAsync(selectedIds);
      setRowSelection({});

      if (result.failed.length > 0) {
        const first = result.failed[0];
        notify.error(
          MESSAGES.externalInvoices.partialDeleteTitle,
          `Deleted ${result.deletedIds.length}. Failed ${result.failed.length}. Example: #${first?.id} (${first?.reason})`
        );
      } else {
        notify.success(MESSAGES.externalInvoices.deletedTitle, `Deleted ${result.deletedIds.length} invoice(s).`);
      }
    } catch (e: unknown) {
      notify.error(MESSAGES.externalInvoices.deleteFailedTitle, e instanceof Error ? e.message : MESSAGES.common.deleteFailed);
    }
  }, [bulkDeleteInvoicesMutation, selectedIds, setRowSelection]);

  const agingSummary = agingSummaryQuery.data;
  const selectedCount = selectedIds.length;
  const ageFilterValue = searchParams.get("age") || "all";

  const statusFilterOptions = useMemo(() => ([
    { value: "all", label: `All (${metrics?.totalInvoices ?? 0})` },
    { value: "pending", label: `Pending (${metrics?.totalPending ?? 0})` },
    { value: "paid", label: `Paid (${metrics?.totalPaid ?? 0})` },
    { value: "overdue", label: `Overdue (${metrics?.totalUnpaid ?? 0})` },
  ]), [metrics?.totalInvoices, metrics?.totalPaid, metrics?.totalPending, metrics?.totalUnpaid]);

  const ageFilterOptions = useMemo(() => {
    const bucketMap = new Map((agingSummary?.buckets || []).map((b) => [b.key, b]));
    return [
      { value: "all", label: "All Aging" },
      { value: "current", label: `Current (${bucketMap.get("current")?.count ?? 0})` },
      { value: "1_30", label: `1-30 (${bucketMap.get("1_30")?.count ?? 0})` },
      { value: "31_60", label: `31-60 (${bucketMap.get("31_60")?.count ?? 0})` },
      { value: "61_90", label: `61-90 (${bucketMap.get("61_90")?.count ?? 0})` },
      { value: "90_plus", label: `90+ (${bucketMap.get("90_plus")?.count ?? 0})` },
    ];
  }, [agingSummary?.buckets]);

  const hasActiveFilters = Boolean(
    searchParams.get("from") ||
      searchParams.get("to") ||
      searchParams.get("status") ||
      searchParams.get("age") ||
      searchParams.get("missing") ||
      searchParams.get("payDue") ||
      searchTerm
  );

  const clearAllFilters = useCallback(() => {
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.delete("from");
      n.delete("to");
      n.delete("status");
      n.delete("age");
      n.delete("missing");
      n.delete("payDue");
      n.delete("q");
      return n;
    }, { replace: true } as any);
    clearSearchFields();
    setCurrentPage(1);
  }, [clearSearchFields, setCurrentPage, setSearchParams]);

  const applySavedView = useCallback((state: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    savedViewsKeys.forEach((k) => {
      const v = state[k];
      if (v) next.set(k, v);
      else next.delete(k);
    });
    if (!isReconciliationMode) next.delete("age");
    setSearchParams(next, { replace: true } as any);
    incrementRefreshKey();
    if (typeof state.q === "string") {
      setSearchInput(state.q);
      setSearchTerm(state.q);
    }
    if (state.ps) {
      const psNum = parseInt(state.ps, 10);
      if (!Number.isNaN(psNum)) setPageSize(psNum);
    }
    setCurrentPage(1);
    invalidateInvoiceQueries();
  }, [
    incrementRefreshKey,
    invalidateInvoiceQueries,
    isReconciliationMode,
    savedViewsKeys,
    searchParams,
    setCurrentPage,
    setPageSize,
    setSearchInput,
    setSearchParams,
    setSearchTerm,
  ]);

  const applyDateRangeFilter = useCallback((from: string, to: string) => {
    updateSearchParams((next) => {
      next.set("from", from);
      next.set("to", to);
    });
    clearSearchFields();
    setCurrentPage(1);
  }, [clearSearchFields, setCurrentPage, updateSearchParams]);

  const clearDateFilter = useCallback(() => {
    updateSearchParams((next) => {
      next.delete("from");
      next.delete("to");
    });
    setCurrentPage(1);
  }, [setCurrentPage, updateSearchParams]);

  return (
    <div className="w-full space-y-6 py-6 px-4 sm:px-0 animate-in fade-in-50">
      <PageHeader
        variant="gradient"
        title={isReconciliationMode ? t("invoices.title_reconciliation") : t("invoices.title")}
        subtitle={isReconciliationMode ? t("invoices.subtitle_reconciliation") : t("invoices.subtitle")}
        icon={isReconciliationMode ? Scale : FileText}
        actions={(
          <div className="flex w-full flex-wrap justify-end gap-2">
            <IconActionButton
              label={isRefreshing ? "Refreshing..." : "Refresh"}
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
              icon={<RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />}
            />
            <IconActionButton
              label={isExportingAll ? "Exporting..." : "Export all"}
              onClick={handleExportAll}
              disabled={isExportingAll || isStatsLoading}
              className="border-white/25 bg-white/15 text-white shadow-sm hover:bg-white/25"
              icon={isExportingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            />
            {canUploadInvoice ? (
              <IconActionButton
                label="Upload"
                to="/invoice-upload"
                className="border-white/25 bg-white text-slate-900 shadow-sm hover:bg-white/90"
                icon={<Plus className="h-4 w-4" />}
              />
            ) : null}
          </div>
        )}
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
          <Link href="/external-invoices/dunning">
            <AlertCircle className="mr-2 h-4 w-4" />
            Dunning center
          </Link>
        </Button>
        <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
          <Link href="/external-invoices/payment-due">
            <Calendar className="mr-2 h-4 w-4" />
            Payment due
          </Link>
        </Button>
        {!isReconciliationMode ? (
          <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
            <Link href="/external-invoices/reconciliation">
              <Scale className="mr-2 h-4 w-4" />
              Reconciliation
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" className="rounded-full shadow-sm" asChild>
            <Link href="/external-invoices">
              <FileText className="mr-2 h-4 w-4" />
              Standard view
            </Link>
          </Button>
        )}
      </div>

      <InvoiceMetricsPanel
        metrics={metrics}
        isStatsLoading={isStatsLoading}
        canViewTotals={canViewTotals}
        agingSummary={agingSummary}
        searchTerm={searchTerm}
        ageFilterValue={ageFilterValue}
        onQuickFilter={handleQuickFilter}
        onAgeBucketFilter={handleAgeBucketFilter}
      />

      {isReconciliationMode ? (
        <ReconciliationBanner
          isScanning={reconciliationDataQuery.isLoading}
          flaggedCount={flaggedCount}
          avgDaysOverdue={agingSummary?.avgDaysOverdue ?? 0}
          overdueAmount={agingSummary?.overdueAmount ?? 0}
        />
      ) : null}

      <InvoiceFiltersPanel
        isReconciliationMode={isReconciliationMode}
        searchInput={searchInput}
        searchTerm={searchTerm}
        onSearch={handleSearch}
        onClearSearch={clearSearchFields}
        onOpenDateFilter={() => setIsDateFilterOpen(true)}
        statusFilterOptions={statusFilterOptions}
        onStatusFilter={handleQuickFilter}
        onPayDueFilter={handlePayDueFilter}
        onMissingFilter={handleMissingFilter}
        ageFilterOptions={ageFilterOptions}
        onAgeBucketFilter={handleAgeBucketFilter}
        reconciliationFilter={reconciliationFilter}
        onReconciliationFilterChange={setReconciliationFilter}
        flaggedCount={flaggedCount}
        savedViewsKeys={savedViewsKeys}
        onApplySavedView={applySavedView}
        hasActiveFilters={hasActiveFilters}
        onClearAllFilters={clearAllFilters}
        onRemoveParams={handleRemoveParams}
        lastRefreshedAt={lastRefreshedAt}
      />

      <DateFilterDialog
        open={isDateFilterOpen}
        onOpenChange={setIsDateFilterOpen}
        draftDateRange={draftDateRange}
        onDraftDateRangeChange={setDraftDateRange}
        currentFrom={searchParams.get("from")}
        currentTo={searchParams.get("to")}
        onApplyRange={applyDateRangeFilter}
        onClearDates={clearDateFilter}
        onQuickPreset={handleQuickFilter}
      />

      {selectedCount > 0 && (
        <BulkActionsBar
          selectedCount={selectedCount}
          canPay={canPayExternalInvoices}
          isBulkPaidInProgress={isBulkPaidInProgress}
          isReminderDisabled={sendRemindersMutation.isPending || selectedInvoices.length === 0}
          isWorkflowPending={workflowMutation.isPending}
          isBulkUpdatePending={bulkUpdateInvoicesMutation.isPending}
          isBulkDeletePending={bulkDeleteInvoicesMutation.isPending}
          isExportingAll={isExportingAll}
          onMarkPaid={() => setIsConfirmBulkPaidOpen(true)}
          onSendReminders={() => openReminderPreview(selectedInvoices)}
          onEscalate={() => {
            selectedIds.forEach((invoiceId) => handleSetWorkflowStage(invoiceId, "escalated"));
          }}
          onSetPayDue={() => setIsBulkPayDueOpen(true)}
          onPromiseToPay={openPromiseDialog}
          onExportSelected={handleExportSelected}
          onDelete={() => setIsConfirmBulkDeleteOpen(true)}
          onClearSelection={() => setRowSelection({})}
        />
      )}

      {/* Main Table */}
      <ExternalInvoicesTable
        search={searchTerm}
        ageBucket={ageBucket}
        graceDays={graceDays}
        reconciliationMode={isReconciliationMode}
        reconciliationFlags={reconciliationFlagsMap}
        rowPredicate={rowPredicate}
        onSetWorkflowStage={handleSetWorkflowStage}
        onSendReminderRequest={(invoice) => openReminderPreview([invoice])}
        key={refreshKey}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        hideBulkActions={true}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        totalItems={tableData?.total || 0}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearAllFilters}
        onDataLoaded={setTableData}
      />

      <ReminderPreviewDialog
        open={isReminderDialogOpen}
        onOpenChange={setIsReminderDialogOpen}
        targets={reminderTargets}
        isSending={sendRemindersMutation.isPending}
        onConfirm={handleSendRemindersConfirm}
      />

      <PromiseToPayDialog
        open={isPromiseDialogOpen}
        onOpenChange={setIsPromiseDialogOpen}
        selectedCount={selectedCount}
        promiseDate={promiseDate}
        onPromiseDateChange={setPromiseDate}
        isSaving={workflowMutation.isPending}
        onSave={() => handleSetPromiseDate(promiseDate)}
      />

      <BulkPayDueDialog
        open={isBulkPayDueOpen}
        onOpenChange={setIsBulkPayDueOpen}
        selectedCount={selectedCount}
        payDueDate={bulkPayDueDate}
        onPayDueDateChange={setBulkPayDueDate}
        isSaving={bulkUpdateInvoicesMutation.isPending}
        onSave={handleBulkSetPayDue}
      />

      <ConfirmBulkPaidDialog
        open={isConfirmBulkPaidOpen}
        onOpenChange={setIsConfirmBulkPaidOpen}
        selectedCount={selectedCount}
        disabled={!canPayExternalInvoices || isBulkPaidInProgress}
        onConfirm={async () => {
          setIsConfirmBulkPaidOpen(false);
          await handleBulkPaid();
        }}
      />

      <ConfirmBulkDeleteDialog
        open={isConfirmBulkDeleteOpen}
        onOpenChange={setIsConfirmBulkDeleteOpen}
        selectedIds={selectedIds}
        disabled={bulkDeleteInvoicesMutation.isPending}
        onConfirm={async () => {
          setIsConfirmBulkDeleteOpen(false);
          await handleBulkDelete();
        }}
      />
    </div>
  );
}

export default function ExternalInvoicesPage() {
  return <ExternalInvoicesPageImpl mode="standard" />;
}
