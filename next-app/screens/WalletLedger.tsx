"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Minus, Plus, RefreshCw, Wallet } from "lucide-react";
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
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { notify } from "@/lib/notify";

type LedgerEntry = {
  id: string;
  username: string;
  amount: string;
  currency: string;
  entryType: "credit" | "debit";
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
};

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

function refLabel(e: LedgerEntry) {
  const t = String(e.referenceType || "");
  if (t === "whish_claim") return `Whish top-up #${e.referenceId}`;
  if (t === "external_invoice") return `Invoice #${String(e.referenceId || "").split(":")[0]}`;
  if (t === "admin_credit") return "Staff credit";
  if (t === "admin_debit") return "Staff debit";
  if (t === "unpay_refund") return `Unpay refund #${String(e.referenceId || "").split(":")[0]}`;
  return t || "—";
}

async function fetchLedger(params: {
  username: string;
  entryType: string;
  page: number;
}) {
  const { data } = await apiClient.get("/invoices/subscriber-wallet/ledger", {
    params: {
      username: params.username || undefined,
      entryType: params.entryType !== "all" ? params.entryType : undefined,
      page: params.page,
      limit: 50,
    },
  });
  return data as {
    data: LedgerEntry[];
    total: number;
    page: number;
    totalPages: number;
    balance: number | null;
  };
}

export default function WalletLedgerPage() {
  const { user } = useAuth();
  const canCredit = can(user, "billing.externalInvoices.pay");
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [appliedUser, setAppliedUser] = useState("");
  const [entryType, setEntryType] = useState<"all" | "credit" | "debit">("all");
  const [page, setPage] = useState(1);
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditUsername, setCreditUsername] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNote, setCreditNote] = useState("");
  const [debitOpen, setDebitOpen] = useState(false);
  const [debitUsername, setDebitUsername] = useState("");
  const [debitAmount, setDebitAmount] = useState("");
  const [debitNote, setDebitNote] = useState("");

  const query = useQuery({
    queryKey: ["subscriberWalletLedger", appliedUser, entryType, page],
    queryFn: () => fetchLedger({ username: appliedUser, entryType, page }),
  });

  const rows = query.data?.data || [];

  const creditMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/invoices/subscriber-wallet/credit", {
        username: creditUsername.trim(),
        amount: Number(creditAmount),
        note: creditNote.trim() || undefined,
      });
      return data as { data?: { balance?: number } };
    },
    onSuccess: (result) => {
      const creditedUser = creditUsername.trim();
      const balance = result?.data?.balance;
      notify.success(
        "Wallet credited",
        balance != null
          ? `${creditedUser} now has a balance of ${formatMoney(balance)}.`
          : `Credit was added to ${creditedUser}.`
      );
      setUsername(creditedUser);
      setAppliedUser(creditedUser);
      setEntryType("all");
      setPage(1);
      setCreditOpen(false);
      setCreditUsername("");
      setCreditAmount("");
      setCreditNote("");
      queryClient.invalidateQueries({ queryKey: ["subscriberWalletLedger"] });
    },
    onError: (error: any) => {
      notify.error(
        "Credit failed",
        error?.response?.data?.message || error?.message || "Could not credit the subscriber wallet"
      );
    },
  });

  const debitMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/invoices/subscriber-wallet/debit", {
        username: debitUsername.trim(),
        amount: Number(debitAmount),
        note: debitNote.trim() || undefined,
      });
      return data as { data?: { balance?: number } };
    },
    onSuccess: (result) => {
      const debitedUser = debitUsername.trim();
      const balance = result?.data?.balance;
      notify.success(
        "Wallet debited",
        balance != null
          ? `${debitedUser} now has a balance of ${formatMoney(balance)}.`
          : `Debit was recorded for ${debitedUser}.`
      );
      setUsername(debitedUser);
      setAppliedUser(debitedUser);
      setEntryType("all");
      setPage(1);
      setDebitOpen(false);
      setDebitUsername("");
      setDebitAmount("");
      setDebitNote("");
      queryClient.invalidateQueries({ queryKey: ["subscriberWalletLedger"] });
    },
    onError: (error: any) => {
      notify.error(
        "Debit failed",
        error?.response?.data?.message || error?.message || "Could not debit the subscriber wallet"
      );
    },
  });

  const openCreditDialog = () => {
    setCreditUsername(appliedUser || username.trim());
    setCreditAmount("");
    setCreditNote("");
    setCreditOpen(true);
  };

  const openDebitDialog = () => {
    setDebitUsername(appliedUser || username.trim());
    setDebitAmount("");
    setDebitNote("");
    setDebitOpen(true);
  };

  const validCredit =
    creditUsername.trim().length > 0 &&
    Number.isFinite(Number(creditAmount)) &&
    Number(creditAmount) > 0;

  const validDebit =
    debitUsername.trim().length > 0 &&
    Number.isFinite(Number(debitAmount)) &&
    Number(debitAmount) > 0;

  return (
    <div className="w-full min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/external-invoices">
            <ArrowLeft className="h-4 w-4" />
            Invoices
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Wallet ledger"
          subtitle="Credits and debits for subscriber wallets (Whish top-ups, invoice payments)"
          icon={Wallet}
        />
        {canCredit ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openDebitDialog}>
              <Minus className="h-4 w-4" />
              Debit wallet
            </Button>
            <Button onClick={openCreditDialog}>
              <Plus className="h-4 w-4" />
              Credit wallet
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>
            Search by RADIUS username. Leave blank to see recent activity across all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Username</div>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. john.doe"
              aria-label="Username"
              className="w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setAppliedUser(username.trim());
                  setPage(1);
                }
              }}
            />
          </div>
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
          <Button
            onClick={() => {
              setAppliedUser(username.trim());
              setPage(1);
            }}
          >
            Search
          </Button>
          {appliedUser && query.data?.balance != null ? (
            <div className="text-sm">
              Balance for <span className="font-medium">{appliedUser}</span>:{" "}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatMoney(query.data.balance)}
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries</CardTitle>
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
              <span>Failed to load the wallet ledger.</span>
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet entries found.</p>
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">When</th>
                    <th className="py-2 pr-3 font-medium">User</th>
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
                      <td className="py-2.5 pr-3 font-medium">{e.username}</td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={e.entryType === "credit" ? "success" : "outline"}>
                          {e.entryType}
                        </Badge>
                      </td>
                      <td
                        className={`py-2.5 pr-3 font-medium ${
                          e.entryType === "credit"
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-foreground"
                        }`}
                      >
                        {e.entryType === "credit" ? "+" : "−"}
                        {formatMoney(e.amount, e.currency)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div>{refLabel(e)}</div>
                        <div className="font-mono text-[11px] text-muted-foreground">
                          WALLET-{e.id}
                        </div>
                      </td>
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
                  <div className="font-medium">{e.username}</div>
                  <div
                    className={`text-lg font-semibold ${
                      e.entryType === "credit" ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
                    }`}
                  >
                    {e.entryType === "credit" ? "+" : "−"}
                    {formatMoney(e.amount, e.currency)}
                  </div>
                  <div className="text-sm">
                    <div>{refLabel(e)}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">WALLET-{e.id}</div>
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
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
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
        open={creditOpen}
        onOpenChange={(open) => {
          if (creditMutation.isPending) return;
          setCreditOpen(open);
          if (!open) {
            setCreditUsername("");
            setCreditAmount("");
            setCreditNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit subscriber wallet</DialogTitle>
            <DialogDescription>
              Add a manual wallet credit. The transaction will identify you as the staff member and appear in the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="credit-username">RADIUS username</Label>
              <Input
                id="credit-username"
                autoFocus
                value={creditUsername}
                onChange={(e) => setCreditUsername(e.target.value)}
                placeholder="e.g. john.doe"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="credit-amount">Amount (USD)</Label>
              <Input
                id="credit-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="credit-note">Reason or reference</Label>
              <Input
                id="credit-note"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && validCredit && !creditMutation.isPending) {
                    creditMutation.mutate();
                  }
                }}
                placeholder="For example: cash payment at office"
              />
              <p className="text-xs text-muted-foreground">Recommended for audit and reconciliation.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)} disabled={creditMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => creditMutation.mutate()} disabled={!validCredit || creditMutation.isPending}>
              {creditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creditMutation.isPending ? "Crediting..." : "Add credit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={debitOpen}
        onOpenChange={(open) => {
          if (debitMutation.isPending) return;
          setDebitOpen(open);
          if (!open) {
            setDebitUsername("");
            setDebitAmount("");
            setDebitNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debit subscriber wallet</DialogTitle>
            <DialogDescription>
              Remove credit from a subscriber wallet. The subscriber must have enough available balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="debit-username">RADIUS username</Label>
              <Input
                id="debit-username"
                autoFocus
                value={debitUsername}
                onChange={(e) => setDebitUsername(e.target.value)}
                placeholder="e.g. john.doe"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="debit-amount">Amount (USD)</Label>
              <Input
                id="debit-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={debitAmount}
                onChange={(e) => setDebitAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="debit-note">Reason</Label>
              <Input
                id="debit-note"
                value={debitNote}
                onChange={(e) => setDebitNote(e.target.value)}
                placeholder="For example: correction / clawback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDebitOpen(false)} disabled={debitMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => debitMutation.mutate()} disabled={!validDebit || debitMutation.isPending}>
              {debitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
              {debitMutation.isPending ? "Debiting..." : "Debit wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
