"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark, Loader2, Minus, Plus, RefreshCw } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { canAny, COMPANY_WALLET_MANAGE_PERMS, COMPANY_WALLET_VIEW_PERMS } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import {
  creditCompanyWallet,
  debitCompanyWallet,
  fetchCompanyWallet,
  type CompanyWalletEntryDto,
} from "@/api/companyWallet";

function formatMoney(amount: number | string, currency = "USD") {
  const n = typeof amount === "number" ? amount : Number(amount);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "LBP" ? "LBP" : "USD",
      maximumFractionDigits: 2,
    }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `${Number(n || 0).toFixed(2)} ${currency}`;
  }
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function refLabel(e: CompanyWalletEntryDto) {
  const t = String(e.referenceType || "");
  if (t === "invoice_payment") return `Invoice payment #${e.referenceId}`;
  if (t === "invoice_unpay") return `Unpay reverse #${e.referenceId}`;
  if (t === "reseller_fund") return `Reseller fund ${e.referenceId}`;
  if (t === "reseller_debit") return `Reseller debit ${e.referenceId}`;
  if (t === "whish_claim") return `Whish top-up #${e.referenceId}`;
  if (t === "admin_credit") return "Opening / manual credit";
  if (t === "admin_debit") return "Manual debit";
  return t || "—";
}

export default function CompanyWalletPage() {
  const { user } = useAuth();
  const canView = canAny(user, [...COMPANY_WALLET_VIEW_PERMS]);
  const canManage = canAny(user, [...COMPANY_WALLET_MANAGE_PERMS]);
  const queryClient = useQueryClient();
  const [entryType, setEntryType] = useState<"all" | "credit" | "debit">("all");
  const [page, setPage] = useState(1);
  const [action, setAction] = useState<"credit" | "debit" | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["companyWallet", entryType, page],
    queryFn: () =>
      fetchCompanyWallet({
        entryType: entryType === "all" ? undefined : entryType,
        page,
        limit: 50,
      }),
    enabled: canView,
  });

  const rows = query.data?.data || [];
  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (action === "debit") return debitCompanyWallet({ amount: Number(amount), note: note.trim() || undefined });
      return creditCompanyWallet({ amount: Number(amount), note: note.trim() || undefined });
    },
    onSuccess: (result) => {
      notify.success(
        action === "debit" ? "Company wallet debited" : "Company wallet credited",
        `Balance is now ${formatMoney(result.balance)}.`
      );
      setAction(null);
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["companyWallet"] });
      queryClient.invalidateQueries({ queryKey: ["company-wallet"] });
    },
    onError: (error: any) => {
      notify.error(
        "Wallet update failed",
        error?.response?.data?.message || error?.message || "Could not update the company wallet"
      );
    },
  });

  if (!canView) {
    return (
      <div className="w-full space-y-6 py-6">
        <PageHeader title="Company wallet" subtitle="You do not have access to the operator treasury." />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">You don’t have access.</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Company wallet"
          subtitle="Operator treasury: cash collections credit this balance; funding resellers debits it."
          icon={Landmark}
        />
        {canManage ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setAction("debit");
                setAmount("");
                setNote("");
              }}
            >
              <Minus className="h-4 w-4" />
              Debit
            </Button>
            <Button
              onClick={() => {
                setAction("credit");
                setAmount("");
                setNote("");
              }}
            >
              <Plus className="h-4 w-4" />
              Credit
            </Button>
          </div>
        ) : null}
      </div>

      <Card className="border-primary/15">
        <CardContent className="p-6">
          <div className="text-sm text-muted-foreground">Available balance</div>
          <div className="mt-1 text-3xl font-semibold">
            {query.isLoading ? "…" : formatMoney(query.data?.balance ?? 0)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Company-level credits and debits across invoices, resellers, and manual adjustments.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Type</div>
            <Select
              value={entryType}
              onValueChange={(v: "all" | "credit" | "debit") => {
                setEntryType(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="credit">Credits</SelectItem>
                <SelectItem value="debit">Debits</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            {query.data?.total != null
              ? `${query.data.total.toLocaleString()} entries · page ${query.data.page}/${query.data.totalPages}`
              : "Loading…"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading ledger…
            </div>
          ) : query.isError ? (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
              <span>Failed to load the company wallet ledger.</span>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No company wallet entries yet. Credit an opening balance to fund resellers.</p>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Reference</th>
                    <th className="py-2 pr-3 font-medium">Note</th>
                    <th className="py-2 font-medium">By</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-border/60">
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatWhen(e.createdAt)}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={e.entryType === "credit" ? "success" : "outline"}>{e.entryType}</Badge>
                      </td>
                      <td
                        className={`py-2.5 pr-3 font-medium ${
                          e.entryType === "credit" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                        }`}
                      >
                        {e.entryType === "credit" ? "+" : "−"}
                        {formatMoney(e.amount, e.currency)}
                      </td>
                      <td className="py-2.5 pr-3">{refLabel(e)}</td>
                      <td className="py-2.5 pr-3 max-w-[220px] truncate" title={e.note || ""}>
                        {e.note || "—"}
                      </td>
                      <td className="py-2.5">{e.createdBy || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-3 md:hidden">
              {rows.map((e) => (
                <div key={e.id} className="space-y-2 rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant={e.entryType === "credit" ? "success" : "outline"}>{e.entryType}</Badge>
                    <span className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatWhen(e.createdAt)}
                    </span>
                  </div>
                  <div
                    className={`text-lg font-semibold ${
                      e.entryType === "credit" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                    }`}
                  >
                    {e.entryType === "credit" ? "+" : "−"}
                    {formatMoney(e.amount, e.currency)}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Reference:</span> {refLabel(e)}
                  </div>
                  {e.note ? <div className="break-words text-sm text-muted-foreground">{e.note}</div> : null}
                  <div className="text-xs text-muted-foreground">By {e.createdBy || "—"}</div>
                </div>
              ))}
            </div>
            </>
          )}

          {(query.data?.totalPages ?? 1) > 1 ? (
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {page} / {query.data?.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= (query.data?.totalPages ?? 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={action != null}
        onOpenChange={(open) => {
          if (mutation.isPending) return;
          if (!open) {
            setAction(null);
            setAmount("");
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{action === "debit" ? "Debit company wallet" : "Credit company wallet"}</DialogTitle>
            <DialogDescription>
              {action === "debit"
                ? "Remove funds from the operator treasury (adjustments or transfers out)."
                : "Add an opening balance or a manual treasury credit. Cash invoice collections also credit this wallet automatically."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="company-wallet-amount">Amount (USD)</Label>
              <Input
                id="company-wallet-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="company-wallet-note">Reason</Label>
              <Input
                id="company-wallet-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: opening balance"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAction(null)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => mutation.mutate()} disabled={!validAmount || mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : action === "debit" ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {mutation.isPending ? "Saving…" : action === "debit" ? "Debit" : "Credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
