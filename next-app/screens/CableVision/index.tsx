import React, { useMemo, useReducer } from "react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import QueryState from "@/components/QueryState";
import EmptyState from "@/components/EmptyState";
import SearchBar from "@/components/SearchBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Pencil, Plus, RefreshCw, Trash2, Tv } from "lucide-react";
import { useCableVisionAccounts } from "@/hooks/useCableVision";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { CABLE_VISION_TEXT as T } from "@/constants/cableVision";
import { cableVisionPageReducer, initialCableVisionPageState } from "./reducer";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";

function statusBadgeClass(status: string) {
  const s = String(status || "").toLowerCase();
  if (s === "paid") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (s === "pending") return "bg-orange-100 text-orange-800 border-orange-200";
  return "bg-red-100 text-red-800 border-red-200"; // unpaid / default
}

export default function CableVisionPage() {
  const { user } = useAuth();
  const canManage = can(user, "cablevision.accounts.manage");
  const canPay = can(user, "cablevision.invoices.pay");
  const canUnpay = can(user, "cablevision.invoices.unpay");
  const canGenerate = can(user, "cablevision.invoices.generate");

  const [state, dispatch] = useReducer(cableVisionPageReducer, initialCableVisionPageState);

  const {
    accountsQuery,
    setCurrentPage,
    currentPage,
    pageSize,
    setPageSize,
    search,
    setSearch,
    billingMonth,
    setBillingMonth,
    billingMonthYmd,
    createAccountMutation,
    updateAccountMutation,
    deleteAccountMutation,
    createProfileMutation,
    updateProfileMutation,
    deleteProfileMutation,
    generateMonthlyInvoicesMutation,
    payInvoiceMutation,
    unpayInvoiceMutation,
  } = useCableVisionAccounts({ initialPage: 1, pageSize: 50 });

  const accounts = useMemo(() => accountsQuery.data?.data?.data ?? [], [accountsQuery.data?.data?.data]);
  const total = accountsQuery.data?.data?.total ?? 0;
  const totalPages = accountsQuery.data?.data?.totalPages ?? 1;

  const totalsByAccount = useMemo(() => {
    const map = new Map<number, { profiles: number; unpaid: number; paid: number; pending: number }>();
    for (const a of accounts) {
      const profiles = Array.isArray(a.profiles) ? a.profiles : [];
      let unpaid = 0,
        paid = 0,
        pending = 0;
      for (const p of profiles) {
        const st = String(p.currentInvoice?.status || "").toLowerCase();
        if (!p.currentInvoice) continue;
        if (st === "paid") paid++;
        else if (st === "pending") pending++;
        else unpaid++;
      }
      map.set(a.id, { profiles: profiles.length, unpaid, paid, pending });
    }
    return map;
  }, [accounts]);

  const isEmpty = !accountsQuery.isLoading && !accountsQuery.error && accounts.length === 0 && !search.trim();

  type CableAccount = (typeof accounts)[number];
  type CableProfile = NonNullable<CableAccount["profiles"]>[number];

  const renderAccountActions = (a: CableAccount, isExpanded: boolean) => (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => dispatch({ type: "toggleExpanded", accountId: a.id })}
      >
        {isExpanded ? T.table.hide : T.table.details}
      </Button>
      <Button
        variant="default"
        size="sm"
        disabled={!canManage}
        onClick={() => dispatch({ type: "openAddProfile", accountId: a.id })}
        title={!canManage ? T.table.addProfileNoPerm : T.table.addProfile}
      >
        {T.table.addProfile}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={!canManage}
        onClick={() =>
          dispatch({
            type: "openEditAccount",
            account: {
              accountId: a.id,
              accountNumber: a.accountNumber,
              fullName: a.fullName,
              phone: a.phoneNumber || null,
              email: a.email || null,
            },
          })
        }
        title={!canManage ? T.table.addProfileNoPerm : T.table.editAccount}
      >
        <Pencil className="h-4 w-4 mr-2" />
        {T.table.editAccount}
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
        disabled={!canManage}
        onClick={() =>
          dispatch({
            type: "openDeleteAccount",
            account: { accountId: a.id, accountNumber: a.accountNumber, fullName: a.fullName },
          })
        }
        title={!canManage ? T.table.addProfileNoPerm : T.table.deleteAccount}
      >
        <Trash2 className="h-4 w-4 mr-2" />
        {T.table.deleteAccount}
      </Button>
    </>
  );

  const renderProfileActions = (p: CableProfile, inv: CableProfile["currentInvoice"]) => {
    const invStatus = inv?.status || "unpaid";
    const canPayThis = Boolean(inv?.id) && canPay && String(invStatus) !== "paid";
    const canUnpayThis = Boolean(inv?.id) && canUnpay && String(invStatus) === "paid";
    const canGenerateThis = Boolean(!inv?.id) && canGenerate;
    const payDisabledReason =
      !inv?.id
        ? T.table.generateInvoiceHint
        : !canPay
          ? T.table.markPaidNoPerm
          : String(invStatus) === "paid"
            ? "Already paid."
            : undefined;
    const unpayDisabledReason =
      !inv?.id
        ? T.table.generateInvoiceHint
        : !canUnpay
          ? T.table.markUnpaidNoPerm
          : String(invStatus) !== "paid"
            ? "Only paid invoices can be marked unpaid."
            : undefined;
    return (
      <div className="flex flex-wrap gap-2 md:justify-end">
        <Button
          size="sm"
          variant="outline"
          disabled={!canManage}
          title={!canManage ? T.table.addProfileNoPerm : T.table.edit}
          onClick={() =>
            dispatch({
              type: "openEditProfile",
              profile: {
                profileId: p.id,
                profileName: p.profileName,
                assignedTo: p.assignedTo,
                deviceId: p.deviceId,
                monthlyFee: Number(p.monthlyFee || 0),
                status: p.status,
              },
            })
          }
        >
          {T.table.edit}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 hover:text-red-700"
          disabled={!canManage}
          title={!canManage ? T.table.addProfileNoPerm : T.table.delete}
          onClick={() =>
            dispatch({
              type: "openDeleteProfile",
              profile: { profileId: p.id, profileName: p.profileName },
            })
          }
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {T.table.delete}
        </Button>

        {canGenerateThis ? (
          <Button
            size="sm"
            variant="outline"
            disabled={generateMonthlyInvoicesMutation.isPending}
            title={T.table.generateInvoice}
            onClick={() => generateMonthlyInvoicesMutation.mutate({ billingMonth: billingMonthYmd })}
          >
            {T.table.generateInvoice}
          </Button>
        ) : null}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!inv?.id || payInvoiceMutation.isPending || !canPayThis}
                  onClick={() => inv?.id && payInvoiceMutation.mutate({ invoiceId: inv.id, paymentMethod: "cash" })}
                >
                  {T.table.markPaid}
                </Button>
              </span>
            </TooltipTrigger>
            {payDisabledReason ? <TooltipContent>{payDisabledReason}</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!inv?.id || unpayInvoiceMutation.isPending || !canUnpayThis}
                  onClick={() => inv?.id && unpayInvoiceMutation.mutate({ invoiceId: inv.id })}
                >
                  {T.table.markUnpaid}
                </Button>
              </span>
            </TooltipTrigger>
            {unpayDisabledReason ? <TooltipContent>{unpayDisabledReason}</TooltipContent> : null}
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  const handleRefresh = async () => {
    const start = Date.now();
    dispatch({ type: "refreshStart" });
    try {
      await accountsQuery.refetch();
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1000 - elapsed); // match Dashboard-like "refresh" feel
      window.setTimeout(() => {
        dispatch({ type: "refreshStop" });
        notify.success(T.refreshToastTitle, T.refreshToastDescription);
      }, remaining);
    } catch (e: any) {
      dispatch({ type: "refreshStop" });
      notify.error("Refresh failed", e?.message || "Failed to refresh Cable Vision data.");
    }
  };

  return (
    <QueryState
      isLoading={accountsQuery.isLoading}
      error={accountsQuery.error}
      onRetry={() => accountsQuery.refetch()}
      errorTitle={T.emptyTitle}
    >
      <div className="w-full space-y-6 py-2 sm:py-2 px-2 sm:px-0">
        <PageHeader
          title={T.pageTitle}
          subtitle={T.pageSubtitle}
          icon={Tv}
          rightContent={
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto items-stretch sm:items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{T.monthLabel}</span>
                <Input
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  aria-label={T.monthLabel}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>{T.totalLabel}</span>
                <Badge variant="outline">{total}</Badge>
              </div>
            </div>
          }
          actions={
            <div className="flex w-full flex-wrap gap-2 sm:justify-end">
              <IconActionButton
                label={state.isRefreshing ? `${T.refresh}...` : T.refresh}
                onClick={handleRefresh}
                disabled={state.isRefreshing}
                icon={<RefreshCw className={`h-4 w-4 ${state.isRefreshing ? "animate-spin" : ""}`} />}
              />
              <IconActionButton
                label={!canGenerate ? T.generateInvoicesNoPerm : T.generateInvoicesHint}
                onClick={() => generateMonthlyInvoicesMutation.mutate({ billingMonth: billingMonthYmd })}
                disabled={!canGenerate || generateMonthlyInvoicesMutation.isPending}
                icon={<FileText className="h-4 w-4" />}
              />
              <IconActionButton
                label={!canManage ? T.newAccountNoPerm : T.newAccount}
                onClick={() => dispatch({ type: "openCreateAccount" })}
                disabled={!canManage}
                variant="default"
                icon={<Plus className="h-4 w-4" />}
              />
            </div>
          }
        />

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-xl">
                <SearchBar
                  currentSearchTerm={search}
                  onSearch={(term) => {
                    setSearch(term);
                    setCurrentPage(1);
                  }}
                  placeholder={T.searchPlaceholder}
                  showButton
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">{T.pageSizeLabel}</span>
                <Input
                  type="number"
                  min={1}
                  max={200}
                  value={pageSize}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(200, parseInt(e.target.value || "50", 10) || 50));
                    setPageSize(n);
                    setCurrentPage(1);
                  }}
                  aria-label={T.pageSizeLabel}
                  className="w-[100px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {isEmpty ? (
          <EmptyState
            icon={Tv}
            title={T.emptyTitle}
            description={canManage ? T.emptyDescriptionManage : T.emptyDescriptionNoManage}
            actionLabel={canManage ? T.newAccount : undefined}
            onAction={canManage ? () => dispatch({ type: "openCreateAccount" }) : undefined}
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">{T.table.account}</TableHead>
                      <TableHead>{T.table.customer}</TableHead>
                      <TableHead className="w-[180px]">{T.table.profiles}</TableHead>
                      <TableHead className="w-[180px]">{T.table.thisMonth}</TableHead>
                      <TableHead className="w-[180px] text-right">{T.table.actions}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => {
                      const stats = totalsByAccount.get(a.id) || { profiles: 0, unpaid: 0, paid: 0, pending: 0 };
                      const isExpanded = state.expandedAccountId === a.id;
                      return (
                        <React.Fragment key={a.id}>
                          <TableRow className="hover:bg-muted/30">
                            {/* Alignment fix: match TableHead padding (px-4) and give consistent width */}
                            <TableCell className="px-4 py-2 w-[180px] font-mono text-sm">
                              {a.accountNumber}
                            </TableCell>
                            <TableCell className="px-4 py-2">
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold truncate">{a.fullName}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  {a.phoneNumber || "—"} {a.email ? `• ${a.email}` : ""}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{stats.profiles}/5</Badge>
                                {stats.unpaid > 0 ? <Badge className={statusBadgeClass("unpaid")}>{stats.unpaid} unpaid</Badge> : null}
                                {stats.pending > 0 ? (
                                  <Badge className={statusBadgeClass("pending")}>{stats.pending} pending</Badge>
                                ) : null}
                                {stats.paid > 0 ? <Badge className={statusBadgeClass("paid")}>{stats.paid} paid</Badge> : null}
                              </div>
                            </TableCell>
                            <TableCell className="px-4 py-2">
                              <Badge variant="outline">{accountsQuery.data?.data?.billingMonth ?? billingMonthYmd ?? "—"}</Badge>
                            </TableCell>
                            <TableCell className="px-4 py-2 text-right overflow-visible whitespace-normal">
                              <div className="flex flex-wrap justify-end gap-2">
                                {renderAccountActions(a, isExpanded)}
                              </div>
                            </TableCell>
                          </TableRow>

                          {isExpanded ? (
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={5} className="px-4 py-2">
                                <div className="p-3 space-y-3">
                                  <div className="text-sm font-semibold">{T.table.profilesSection}</div>
                                  <div className="hidden overflow-x-auto md:block">
                                    <Table className="table-fixed">
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead className="w-[80px]">{T.table.slot}</TableHead>
                                          <TableHead className="w-[220px]">{T.table.profile}</TableHead>
                                          <TableHead>{T.table.user}</TableHead>
                                          <TableHead className="w-[140px]">{T.table.fee}</TableHead>
                                          <TableHead className="w-[200px]">{T.table.invoice}</TableHead>
                                          <TableHead className="w-[240px] text-right">{T.table.actions}</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {(a.profiles || []).length === 0 ? (
                                          <TableRow>
                                            <TableCell colSpan={6} className="px-4 py-3 text-sm text-muted-foreground">
                                              {T.table.noProfiles}
                                            </TableCell>
                                          </TableRow>
                                        ) : (
                                          (a.profiles || []).map((p) => {
                                            const inv = p.currentInvoice || null;
                                            const invStatus = inv?.status || "unpaid";
                                            return (
                                              <TableRow key={p.id} className="bg-card/80 dark:bg-card/50">
                                                <TableCell className="px-4 py-2 font-mono">{p.profileIndex}</TableCell>
                                                <TableCell className="px-4 py-2">
                                                  <div className="flex flex-col min-w-0">
                                                    <span className="font-medium truncate">{p.profileName}</span>
                                                    <span className="text-xs text-muted-foreground truncate">
                                                      {T.table.devicePrefix} {p.deviceId || "—"}
                                                    </span>
                                                  </div>
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-sm">{p.assignedTo || "—"}</TableCell>
                                                <TableCell className="px-4 py-2 font-mono">${Number(p.monthlyFee || 0).toFixed(2)}</TableCell>
                                                <TableCell className="px-4 py-2">
                                                  {inv ? (
                                                    <div className="flex flex-col gap-1">
                                                      <Badge className={statusBadgeClass(invStatus)} variant="outline">
                                                        {invStatus}
                                                      </Badge>
                                                      <span className="text-[11px] text-muted-foreground font-mono truncate">
                                                        #{inv.id} • {inv.billingMonth}
                                                      </span>
                                                    </div>
                                                  ) : (
                                                    <Badge variant="outline" className="text-muted-foreground">
                                                      {T.table.noInvoice}
                                                    </Badge>
                                                  )}
                                                </TableCell>
                                                <TableCell className="px-4 py-2 text-right overflow-visible whitespace-normal">
                                                  {renderProfileActions(p, inv)}
                                                </TableCell>
                                              </TableRow>
                                            );
                                          })
                                        )}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : null}
                        </React.Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-3 p-3 md:hidden">
                {accounts.map((a) => {
                  const stats = totalsByAccount.get(a.id) || { profiles: 0, unpaid: 0, paid: 0, pending: 0 };
                  const isExpanded = state.expandedAccountId === a.id;
                  return (
                    <div key={a.id} className="space-y-3 rounded-lg border border-border/60 bg-card p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-muted-foreground">{a.accountNumber}</div>
                          <div className="truncate font-semibold">{a.fullName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {a.phoneNumber || "—"} {a.email ? `• ${a.email}` : ""}
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {accountsQuery.data?.data?.billingMonth ?? billingMonthYmd ?? "—"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{stats.profiles}/5</Badge>
                        {stats.unpaid > 0 ? <Badge className={statusBadgeClass("unpaid")}>{stats.unpaid} unpaid</Badge> : null}
                        {stats.pending > 0 ? <Badge className={statusBadgeClass("pending")}>{stats.pending} pending</Badge> : null}
                        {stats.paid > 0 ? <Badge className={statusBadgeClass("paid")}>{stats.paid} paid</Badge> : null}
                      </div>
                      <div className="flex flex-wrap gap-2">{renderAccountActions(a, isExpanded)}</div>
                      {isExpanded ? (
                        <div className="space-y-2 border-t border-border/60 pt-3">
                          <div className="text-sm font-semibold">{T.table.profilesSection}</div>
                          {(a.profiles || []).length === 0 ? (
                            <div className="text-sm text-muted-foreground">{T.table.noProfiles}</div>
                          ) : (
                            (a.profiles || []).map((p) => {
                              const inv = p.currentInvoice || null;
                              const invStatus = inv?.status || "unpaid";
                              return (
                                <div key={p.id} className="space-y-2 rounded-md border border-border/60 bg-muted/20 p-3">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="truncate font-medium">{p.profileName}</div>
                                      <div className="truncate text-xs text-muted-foreground">
                                        {T.table.devicePrefix} {p.deviceId || "—"}
                                      </div>
                                    </div>
                                    <Badge variant="outline" className="shrink-0">Slot {p.profileIndex}</Badge>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="min-w-0">
                                      <div className="text-xs text-muted-foreground">User</div>
                                      <div className="truncate">{p.assignedTo || "—"}</div>
                                    </div>
                                    <div>
                                      <div className="text-xs text-muted-foreground">Fee</div>
                                      <div className="font-mono">${Number(p.monthlyFee || 0).toFixed(2)}</div>
                                    </div>
                                  </div>
                                  {inv ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge className={statusBadgeClass(invStatus)} variant="outline">{invStatus}</Badge>
                                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                                        #{inv.id} • {inv.billingMonth}
                                      </span>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">{T.table.noInvoice}</Badge>
                                  )}
                                  {renderProfileActions(p, inv)}
                                </div>
                              );
                            })
                          )}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="p-3 flex items-center justify-between text-sm text-muted-foreground">
                <div>
                  Page {currentPage} / {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Account dialog */}
        <Dialog open={state.isCreateAccountOpen} onOpenChange={(open) => (open ? dispatch({ type: "openCreateAccount" }) : dispatch({ type: "closeCreateAccount" }))}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{T.dialogs.createAccountTitle}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="create-account-number">{T.dialogs.accountNumberLabel}</Label>
                <Input
                  id="create-account-number"
                  value={state.createAccount.accountNumber}
                  onChange={(e) => dispatch({ type: "setCreateAccountField", field: "accountNumber", value: e.target.value })}
                  placeholder={T.dialogs.accountNumberPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="create-account-name">{T.dialogs.customerNameLabel}</Label>
                <Input
                  id="create-account-name"
                  value={state.createAccount.fullName}
                  onChange={(e) => dispatch({ type: "setCreateAccountField", field: "fullName", value: e.target.value })}
                  placeholder={T.dialogs.customerNamePlaceholder}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="create-account-phone">{T.dialogs.phoneLabel}</Label>
                  <Input
                    id="create-account-phone"
                    value={state.createAccount.phone}
                    onChange={(e) => dispatch({ type: "setCreateAccountField", field: "phone", value: e.target.value })}
                    placeholder={T.dialogs.phonePlaceholder}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="create-account-email">{T.dialogs.emailLabel}</Label>
                  <Input
                    id="create-account-email"
                    value={state.createAccount.email}
                    onChange={(e) => dispatch({ type: "setCreateAccountField", field: "email", value: e.target.value })}
                    placeholder={T.dialogs.emailPlaceholder}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => dispatch({ type: "closeCreateAccount" })}>
                {T.dialogs.cancel}
              </Button>
              <Button
                disabled={
                  createAccountMutation.isPending ||
                  !canManage ||
                  !state.createAccount.accountNumber.trim() ||
                  !state.createAccount.fullName.trim()
                }
                onClick={() => {
                  createAccountMutation.mutate(
                    {
                      accountNumber: state.createAccount.accountNumber.trim(),
                      fullName: state.createAccount.fullName.trim(),
                      phoneNumber: state.createAccount.phone,
                      email: state.createAccount.email,
                    },
                    { onSuccess: () => dispatch({ type: "closeCreateAccount" }) }
                  );
                }}
              >
                {T.dialogs.create}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Account dialog */}
        <Dialog open={state.isEditAccountOpen} onOpenChange={(open) => (open ? null : dispatch({ type: "closeEditAccount" }))}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{T.dialogs.editAccountTitle}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-account-number">{T.dialogs.accountNumberLabel}</Label>
                <Input
                  id="edit-account-number"
                  value={state.editAccount.accountNumber}
                  onChange={(e) => dispatch({ type: "setEditAccountField", field: "accountNumber", value: e.target.value })}
                  placeholder={T.dialogs.accountNumberPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-account-name">{T.dialogs.customerNameLabel}</Label>
                <Input
                  id="edit-account-name"
                  value={state.editAccount.fullName}
                  onChange={(e) => dispatch({ type: "setEditAccountField", field: "fullName", value: e.target.value })}
                  placeholder={T.dialogs.customerNamePlaceholder}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-account-phone">{T.dialogs.phoneLabel}</Label>
                  <Input
                    id="edit-account-phone"
                    value={state.editAccount.phone}
                    onChange={(e) => dispatch({ type: "setEditAccountField", field: "phone", value: e.target.value })}
                    placeholder={T.dialogs.phonePlaceholder}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-account-email">{T.dialogs.emailLabel}</Label>
                  <Input
                    id="edit-account-email"
                    value={state.editAccount.email}
                    onChange={(e) => dispatch({ type: "setEditAccountField", field: "email", value: e.target.value })}
                    placeholder={T.dialogs.emailPlaceholder}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => dispatch({ type: "closeEditAccount" })}>
                {T.dialogs.cancel}
              </Button>
              <Button
                disabled={
                  updateAccountMutation.isPending ||
                  !canManage ||
                  !state.editAccount.accountId ||
                  !state.editAccount.accountNumber.trim() ||
                  !state.editAccount.fullName.trim()
                }
                onClick={() => {
                  const id = state.editAccount.accountId;
                  if (!id) return;
                  const phone = state.editAccount.phone.trim();
                  const email = state.editAccount.email.trim();
                  updateAccountMutation.mutate(
                    {
                      accountId: id,
                      accountNumber: state.editAccount.accountNumber.trim(),
                      fullName: state.editAccount.fullName.trim(),
                      phoneNumber: phone ? phone : null,
                      email: email ? email : null,
                    },
                    { onSuccess: () => dispatch({ type: "closeEditAccount" }) }
                  );
                }}
              >
                {T.dialogs.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Profile dialog */}
        <Dialog open={state.isAddProfileOpen} onOpenChange={(open) => (open ? null : dispatch({ type: "closeAddProfile" }))}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{T.dialogs.addProfileTitle}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="add-profile-name">{T.dialogs.profileNameLabel}</Label>
                <Input
                  id="add-profile-name"
                  value={state.addProfile.profileName}
                  onChange={(e) => dispatch({ type: "setAddProfileField", field: "profileName", value: e.target.value })}
                  placeholder={T.dialogs.profileNamePlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-profile-assigned">{T.dialogs.assignedToLabel}</Label>
                <Input
                  id="add-profile-assigned"
                  value={state.addProfile.assignedTo}
                  onChange={(e) => dispatch({ type: "setAddProfileField", field: "assignedTo", value: e.target.value })}
                  placeholder={T.dialogs.assignedToPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-profile-device">{T.dialogs.deviceIdLabel}</Label>
                <Input
                  id="add-profile-device"
                  value={state.addProfile.deviceId}
                  onChange={(e) => dispatch({ type: "setAddProfileField", field: "deviceId", value: e.target.value })}
                  placeholder={T.dialogs.deviceIdPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="add-profile-fee">{T.dialogs.monthlyFeeLabel}</Label>
                <Input
                  id="add-profile-fee"
                  value={state.addProfile.monthlyFee}
                  onChange={(e) => dispatch({ type: "setAddProfileField", field: "monthlyFee", value: e.target.value })}
                  placeholder={T.dialogs.monthlyFeePlaceholder}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => dispatch({ type: "closeAddProfile" })}>
                {T.dialogs.cancel}
              </Button>
              <Button
                disabled={!canManage || createProfileMutation.isPending || !state.addProfile.accountId || !state.addProfile.profileName.trim()}
                onClick={() => {
                  if (!state.addProfile.accountId) return;
                  createProfileMutation.mutate(
                    {
                      accountId: state.addProfile.accountId,
                      profileName: state.addProfile.profileName.trim(),
                      assignedTo: state.addProfile.assignedTo.trim() || undefined,
                      deviceId: state.addProfile.deviceId.trim() || undefined,
                      monthlyFee: Number(state.addProfile.monthlyFee || 0),
                    },
                    { onSuccess: () => dispatch({ type: "closeAddProfile" }) }
                  );
                }}
              >
                {T.dialogs.add}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Profile dialog */}
        <Dialog
          open={state.isEditProfileOpen}
          onOpenChange={(open) => (open ? null : dispatch({ type: "closeEditProfile" }))}
        >
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>{T.dialogs.editProfileTitle}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="edit-profile-name">{T.dialogs.profileNameLabel}</Label>
                <Input
                  id="edit-profile-name"
                  value={state.editProfile.profileName}
                  onChange={(e) => dispatch({ type: "setEditProfileField", field: "profileName", value: e.target.value })}
                  placeholder={T.dialogs.profileNamePlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-profile-assigned">{T.dialogs.assignedToLabel}</Label>
                <Input
                  id="edit-profile-assigned"
                  value={state.editProfile.assignedTo}
                  onChange={(e) => dispatch({ type: "setEditProfileField", field: "assignedTo", value: e.target.value })}
                  placeholder={T.dialogs.assignedToPlaceholder}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-profile-device">{T.dialogs.deviceIdLabel}</Label>
                <Input
                  id="edit-profile-device"
                  value={state.editProfile.deviceId}
                  onChange={(e) => dispatch({ type: "setEditProfileField", field: "deviceId", value: e.target.value })}
                  placeholder={T.dialogs.deviceIdPlaceholder}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="edit-profile-fee">{T.dialogs.monthlyFeeLabel}</Label>
                  <Input
                    id="edit-profile-fee"
                    value={state.editProfile.monthlyFee}
                    onChange={(e) => dispatch({ type: "setEditProfileField", field: "monthlyFee", value: e.target.value })}
                    placeholder={T.dialogs.monthlyFeePlaceholder}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium">Status</div>
                  <Select
                    value={state.editProfile.status}
                    onValueChange={(v) => dispatch({ type: "setEditProfileField", field: "status", value: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => dispatch({ type: "closeEditProfile" })}>
                {T.dialogs.cancel}
              </Button>
              <Button
                disabled={
                  !canManage ||
                  updateProfileMutation.isPending ||
                  !state.editProfile.profileId ||
                  !state.editProfile.profileName.trim()
                }
                onClick={() => {
                  const id = state.editProfile.profileId;
                  if (!id) return;
                  updateProfileMutation.mutate(
                    {
                      profileId: id,
                      profileName: state.editProfile.profileName.trim(),
                      assignedTo: state.editProfile.assignedTo.trim() || null,
                      deviceId: state.editProfile.deviceId.trim() || null,
                      monthlyFee: Number(state.editProfile.monthlyFee || 0),
                      status: state.editProfile.status,
                    },
                    { onSuccess: () => dispatch({ type: "closeEditProfile" }) }
                  );
                }}
              >
                {T.dialogs.save}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ActionConfirmDialog
          open={state.isDeleteAccountOpen}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "closeDeleteAccount" });
          }}
          title={`Delete ${state.deleteAccount.accountNumber || "account"}?`}
          description={`This will permanently delete the account for "${state.deleteAccount.fullName || "—"}" and may remove related profiles/invoices. This cannot be undone.`}
          confirmText="Delete"
          confirmTone="destructive"
          isConfirming={deleteAccountMutation.isPending}
          onConfirm={async () => {
            const id = state.deleteAccount.accountId;
            if (!id) return;
            await deleteAccountMutation.mutateAsync({ accountId: id });
          }}
        />

        <ActionConfirmDialog
          open={state.isDeleteProfileOpen}
          onOpenChange={(open) => {
            if (!open) dispatch({ type: "closeDeleteProfile" });
          }}
          title={`Delete "${state.deleteProfile.profileName || "profile"}"?`}
          description="This will permanently delete the profile/device slot. This cannot be undone."
          confirmText="Delete"
          confirmTone="destructive"
          isConfirming={deleteProfileMutation.isPending}
          onConfirm={async () => {
            const id = state.deleteProfile.profileId;
            if (!id) return;
            await deleteProfileMutation.mutateAsync({ profileId: id });
          }}
        />
      </div>
    </QueryState>
  );
}

