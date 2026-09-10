"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ExternalLink,
  FileText,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  Radio,
  Wallet,
  Award,
  TrendingUp,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Calendar,
  History,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { ExternalInvoice, User } from "@/types/api";
import ExternalInvoiceDetailView from "@/components/ExternalInvoiceDetailView";
import SendWhatsAppDialog from "@/components/SendWhatsAppDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type CustomerInvoices = {
  data: ExternalInvoice[];
  total: number;
};

type WalletEntry = {
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

type CustomerWallet = {
  data: WalletEntry[];
  total: number;
  balance: number | null;
};

type LiveSession = {
  sessionId?: string;
  nasIpAddress?: string;
  framedIpAddress?: string;
  sessionTime?: number;
  totalBytesIn?: number | string;
  totalBytesOut?: number | string;
  profileName?: string;
};

type UsageWindow = {
  bytesIn?: number | string;
  bytesOut?: number | string;
  totalBytes?: number | string;
  totalGiB?: number;
  samples?: number;
  sessions?: number;
};

function useCustomerInvoices(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer360", "invoices", username],
    queryFn: async (): Promise<CustomerInvoices> => {
      const { data } = await apiClient.get("/invoices/external", {
        params: { page: 1, limit: 100, search: username, sortBy: "billingMonth", sortDir: "desc" },
      });
      const rows = (data?.data?.data ?? []) as ExternalInvoice[];
      const exact = rows.filter(
        (invoice) => String(invoice.username).toLowerCase() === username.toLowerCase()
      );
      return { data: exact, total: exact.length };
    },
    enabled: enabled && Boolean(username),
    staleTime: 15_000,
  });
}

function useCustomerWallet(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer360", "wallet", username],
    queryFn: async (): Promise<CustomerWallet> => {
      const { data } = await apiClient.get("/invoices/subscriber-wallet/ledger", {
        params: { username, page: 1, limit: 20 },
      });
      return {
        data: Array.isArray(data?.data) ? data.data : [],
        total: Number(data?.total ?? 0),
        balance: data?.balance == null ? null : Number(data.balance),
      };
    },
    enabled: enabled && Boolean(username),
    staleTime: 15_000,
  });
}

function useLiveSession(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer360", "liveSession", username],
    queryFn: async (): Promise<LiveSession | null> => {
      const { data } = await apiClient.get(`/sessions/live/${encodeURIComponent(username)}`);
      return data?.data ?? null;
    },
    enabled: enabled && Boolean(username),
    staleTime: 5_000,
    retry: false,
  });
}

function useUsageWindow(username: string, enabled: boolean) {
  return useQuery({
    queryKey: ["customer360", "usageWindow", username, 24],
    queryFn: async (): Promise<UsageWindow> => {
      const { data } = await apiClient.get("/sessions/usage/window", {
        params: { username, hours: 24 },
      });
      return data?.data ?? {};
    },
    enabled: enabled && Boolean(username),
    staleTime: 30_000,
  });
}

function formatMoney(value: number | string | null | undefined, currency = "USD") {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "LBP" ? "LBP" : "USD",
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${currency}`;
  }
}

function formatBytes(value: number | string | null | undefined) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index >= 3 ? 2 : 1)} ${units[index]}`;
}

function formatDuration(seconds?: number) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (!total) return "—";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function Customer360Summary({ user }: { user: User }) {
  const { user: authUser } = useAuth();
  const username = user.username;
  const canSeeSessions = canAny(authUser, ["users.online.view", "users.view", "reseller.users.view"]);
  const canSeeBilling = canAny(authUser, [
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ]);
  const canSeeTotals = can(authUser, "billing.externalInvoices.viewTotals");
  const canSeeWallet = canAny(authUser, ["billing.externalInvoices.view", "billing.externalInvoices.pay"]);

  const invoicesQuery = useCustomerInvoices(username, canSeeBilling);
  const walletQuery = useCustomerWallet(username, canSeeWallet);
  const liveQuery = useLiveSession(username, canSeeSessions && Boolean(username));
  const usageQuery = useUsageWindow(username, canSeeSessions);

  const isLiveOnline = Boolean(liveQuery.data || user.isOnline);

  const openInvoices = useMemo(
    () => (invoicesQuery.data?.data ?? []).filter((invoice) => invoice.status !== "paid"),
    [invoicesQuery.data?.data]
  );
  const outstanding = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const recentBytes = Number(
    usageQuery.data?.totalBytes ??
      Number(usageQuery.data?.bytesIn ?? 0) + Number(usageQuery.data?.bytesOut ?? 0)
  );

  const allInvoices = invoicesQuery.data?.data ?? [];
  const paidInvoices = useMemo(() => allInvoices.filter((inv) => inv.status === "paid"), [allInvoices]);
  const ltvAmount = useMemo(
    () => paidInvoices.reduce((sum, inv) => sum + Number(inv.amount || 0), 0),
    [paidInvoices]
  );

  // Composite Service Quality Score (SQS)
  const openCount = openInvoices.length;
  const sqsValue = Math.max(15, Math.min(100, (isLiveOnline ? 98 : 88) - openCount * 12));
  const sqsLevel =
    sqsValue >= 90
      ? { label: "Excellent", color: "text-emerald-600 dark:text-emerald-400" }
      : sqsValue >= 75
      ? { label: "Good", color: "text-blue-600 dark:text-blue-400" }
      : sqsValue >= 50
      ? { label: "Fair", color: "text-amber-600 dark:text-amber-400" }
      : { label: "At Risk", color: "text-rose-600 dark:text-rose-400" };

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Service</span>
            <Radio className={`h-4 w-4 ${isLiveOnline ? "text-emerald-500 animate-pulse" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-2 text-xl font-semibold tracking-tight">{isLiveOnline ? "Online" : "Offline"}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {liveQuery.data?.framedIpAddress
              ? `${liveQuery.data.framedIpAddress} · ${formatDuration(liveQuery.data.sessionTime)}`
              : user.lastTimeActive
                ? `Last active ${formatDateTime(user.lastTimeActive)}`
                : "No recent session details"}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Usage · 24h</span>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-xl font-semibold">
            {usageQuery.isLoading ? "…" : formatBytes(recentBytes)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {usageQuery.data?.sessions ?? 0} active session(s)
          </div>
        </CardContent>
      </Card>

      {canSeeBilling ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Outstanding</span>
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-xl font-semibold">
              {invoicesQuery.isLoading
                ? "…"
                : canSeeTotals
                  ? formatMoney(outstanding)
                  : `${openInvoices.length} open`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{openInvoices.length} unpaid or pending</div>
          </CardContent>
        </Card>
      ) : null}

      {canSeeWallet ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Wallet</span>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-xl font-semibold">
              {walletQuery.isLoading ? "…" : formatMoney(walletQuery.data?.balance)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{walletQuery.data?.total ?? 0} transaction(s)</div>
          </CardContent>
        </Card>
      ) : null}

      {/* Lifetime Value (LTV) Card */}
      {canSeeBilling ? (
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Lifetime Value</span>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-xl font-semibold font-mono text-emerald-600 dark:text-emerald-400">
              {invoicesQuery.isLoading ? "…" : canSeeTotals ? formatMoney(ltvAmount) : "—"}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{paidInvoices.length} paid cycle(s)</div>
          </CardContent>
        </Card>
      ) : null}

      {/* Service Quality Score (SQS) Card */}
      <Card className="border-border/60 shadow-none">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quality Score</span>
            <Award className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 text-xl font-semibold font-mono flex items-baseline gap-1">
            <span className={sqsLevel.color}>{sqsValue}</span>
            <span className="text-xs text-muted-foreground font-normal">/100</span>
          </div>
          <div className="mt-1 text-xs font-medium text-muted-foreground truncate">
            {sqsLevel.label}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function CustomerBillingPanel({ username }: { username: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasAccess = canAny(user, [
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ]);
  const canSeeTotals = can(user, "billing.externalInvoices.viewTotals");
  const query = useCustomerInvoices(username, hasAccess);
  const [selectedInvoice, setSelectedInvoice] = useState<ExternalInvoice | null>(null);
  const [whatsAppInvoice, setWhatsAppInvoice] = useState<ExternalInvoice | null>(null);

  const rows = query.data?.data ?? [];
  const openRows = rows.filter((invoice) => invoice.status !== "paid");
  const outstanding = openRows.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You do not have permission to view this customer&apos;s billing information.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {selectedInvoice ? (
        <ExternalInvoiceDetailView
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSave={() => {
            setSelectedInvoice(null);
            queryClient.invalidateQueries({ queryKey: ["customer360", "invoices", username] });
          }}
        />
      ) : null}

      {whatsAppInvoice ? (
        <SendWhatsAppDialog
          open={Boolean(whatsAppInvoice)}
          onOpenChange={(open) => {
            if (!open) setWhatsAppInvoice(null);
          }}
          recipientPhone={whatsAppInvoice.phoneNumber || ""}
          recipientName={whatsAppInvoice.fullName || whatsAppInvoice.username || username}
          invoiceNumber={String(whatsAppInvoice.id)}
          invoiceAmount={whatsAppInvoice.amount || 0}
          currency="USD"
          dueDate={whatsAppInvoice.payDueDate || ""}
          defaultTemplate={whatsAppInvoice.status === "paid" ? "payment_receipt" : "payment_reminder"}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Invoices</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight">{rows.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Open invoices</div>
            <div className="mt-1 text-2xl font-semibold">{openRows.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/60 shadow-none">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="mt-1 text-2xl font-semibold">
              {canSeeTotals ? formatMoney(outstanding) : "Restricted"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/50 p-4">
          <div>
            <CardTitle>Customer invoices</CardTitle>
            <CardDescription>External billing records matched exactly to @{username}</CardDescription>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/external-invoices?q=${encodeURIComponent(username)}`}>
              View all
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {query.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading invoices…
            </div>
          ) : query.isError ? (
            <div className="text-sm text-destructive">Failed to load customer invoices.</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No external invoices found for this customer.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[720px] text-sm">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Billing month</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Due</TableHead>
                    {canSeeTotals ? <TableHead className="text-right">Amount</TableHead> : null}
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 20).map((invoice) => (
                    <TableRow key={invoice.id} className="hover:bg-primary/[0.03]">
                      <TableCell className="py-2 font-mono text-xs">#{invoice.id}</TableCell>
                      <TableCell>{formatDate(invoice.billingMonth)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={invoice.status === "paid" ? "success" : invoice.status === "unpaid" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {invoice.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(invoice.payDueDate)}</TableCell>
                      {canSeeTotals ? <TableCell className="text-right font-medium">{formatMoney(invoice.amount)}</TableCell> : null}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => setWhatsAppInvoice(invoice)}
                            title="Send WhatsApp notice"
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                            Manage
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Customer Payment & Billing Timeline */}
          {rows.length > 0 && (
            <div className="mt-6 border-t border-border/50 pt-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                <History className="h-4 w-4 text-primary" />
                Payment & Billing Lifecycle Timeline
              </h4>
              <div className="relative pl-6 border-l-2 border-border/60 space-y-4">
                {rows.slice(0, 6).map((inv) => {
                  const isPaid = inv.status === "paid";
                  return (
                    <div key={inv.id} className="relative group">
                      <div
                        className={cn(
                          "absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-background",
                          isPaid ? "bg-emerald-500" : "bg-amber-500"
                        )}
                      />
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                        <div>
                          <span className="font-semibold text-foreground">
                            Invoice #{inv.id} ({inv.billingMonth ? String(inv.billingMonth).slice(0, 7) : "Cycle"})
                          </span>
                          <span className="text-muted-foreground ml-2">
                            Due: {formatDate(inv.payDueDate)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canSeeTotals && (
                            <span className="font-mono font-semibold text-foreground">
                              {formatMoney(inv.amount)}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] capitalize",
                              isPaid
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {isPaid ? "Paid in full" : inv.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export function CustomerWalletPanel({ username }: { username: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasAccess = canAny(user, ["billing.externalInvoices.view", "billing.externalInvoices.pay"]);
  const canCredit = can(user, "billing.externalInvoices.pay");
  const query = useCustomerWallet(username, hasAccess);
  const [creditOpen, setCreditOpen] = useState(false);
  const [debitOpen, setDebitOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [debitAmount, setDebitAmount] = useState("");
  const [debitNote, setDebitNote] = useState("");

  const creditMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/invoices/subscriber-wallet/credit", {
        username,
        amount: Number(amount),
        note: note.trim() || undefined,
      });
      return data;
    },
    onSuccess: (result) => {
      notify.success(
        "Wallet credited",
        result?.data?.balance != null
          ? `New balance: ${formatMoney(result.data.balance)}`
          : `Credit added to ${username}.`
      );
      setCreditOpen(false);
      setAmount("");
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["customer360", "wallet", username] });
      queryClient.invalidateQueries({ queryKey: ["subscriberWalletLedger"] });
    },
    onError: (error: any) => {
      notify.error(
        "Credit failed",
        error?.response?.data?.message || error?.message || "Could not credit wallet"
      );
    },
  });

  const debitMutation = useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post("/invoices/subscriber-wallet/debit", {
        username,
        amount: Number(debitAmount),
        note: debitNote.trim() || undefined,
      });
      return data;
    },
    onSuccess: (result) => {
      notify.success(
        "Wallet debited",
        result?.data?.balance != null
          ? `New balance: ${formatMoney(result.data.balance)}`
          : `Debit recorded for ${username}.`
      );
      setDebitOpen(false);
      setDebitAmount("");
      setDebitNote("");
      queryClient.invalidateQueries({ queryKey: ["customer360", "wallet", username] });
      queryClient.invalidateQueries({ queryKey: ["subscriberWalletLedger"] });
    },
    onError: (error: any) => {
      notify.error(
        "Debit failed",
        error?.response?.data?.message || error?.message || "Could not debit wallet"
      );
    },
  });

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;
  const validDebit = Number.isFinite(Number(debitAmount)) && Number(debitAmount) > 0;

  if (!hasAccess) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          You do not have permission to view this customer&apos;s wallet.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Dialog
        open={creditOpen}
        onOpenChange={(open) => {
          if (creditMutation.isPending) return;
          setCreditOpen(open);
          if (!open) {
            setAmount("");
            setNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Credit @{username}&apos;s wallet</DialogTitle>
            <DialogDescription>
              This financial action will record your staff username in the wallet ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="customer-wallet-amount">Amount (USD)</Label>
              <Input
                id="customer-wallet-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="customer-wallet-note">Reason or payment reference</Label>
              <Input
                id="customer-wallet-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="For example: cash payment at office"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)} disabled={creditMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => creditMutation.mutate()}
              disabled={!validAmount || creditMutation.isPending}
            >
              {creditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creditMutation.isPending ? "Crediting…" : "Add credit"}
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
            setDebitAmount("");
            setDebitNote("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Debit @{username}&apos;s wallet</DialogTitle>
            <DialogDescription>
              Remove credit from this subscriber wallet. This requires available balance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="customer-wallet-debit-amount">Amount (USD)</Label>
              <Input
                id="customer-wallet-debit-amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                autoFocus
                value={debitAmount}
                onChange={(event) => setDebitAmount(event.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="customer-wallet-debit-note">Reason</Label>
              <Input
                id="customer-wallet-debit-note"
                value={debitNote}
                onChange={(event) => setDebitNote(event.target.value)}
                placeholder="For example: correction / clawback"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDebitOpen(false)} disabled={debitMutation.isPending}>
              Cancel
            </Button>
            <Button
              onClick={() => debitMutation.mutate()}
              disabled={!validDebit || debitMutation.isPending}
            >
              {debitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
              {debitMutation.isPending ? "Debiting…" : "Debit wallet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-border/60 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/50 p-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet
            </CardTitle>
            <CardDescription>Balance and recent financial transactions</CardDescription>
          </div>
          {canCredit ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDebitOpen(true)}>
                <Minus className="h-4 w-4" />
                Debit
              </Button>
              <Button onClick={() => setCreditOpen(true)}>
                <Plus className="h-4 w-4" />
                Credit wallet
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-primary/15 bg-primary/[0.035] p-4">
            <div>
              <div className="text-sm text-muted-foreground">Available balance</div>
              <div className="mt-1 text-3xl font-semibold">
                {query.isLoading ? "…" : formatMoney(query.data?.balance)}
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/external-invoices/wallet-ledger`}>
                Full ledger
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          {query.isLoading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading wallet…
            </div>
          ) : query.isError ? (
            <div className="text-sm text-destructive">Failed to load the customer wallet.</div>
          ) : (query.data?.data ?? []).length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No wallet transactions yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border/60">
              <Table className="min-w-[760px] text-sm">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(query.data?.data ?? []).map((entry) => (
                    <TableRow key={entry.id} className="hover:bg-primary/[0.03]">
                      <TableCell className="whitespace-nowrap py-2">{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={entry.entryType === "credit" ? "success" : "outline"} className="capitalize">
                          {entry.entryType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {entry.referenceType || "manual"}{entry.referenceId ? ` #${entry.referenceId}` : ""}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate" title={entry.note || ""}>
                        {entry.note || "—"}
                      </TableCell>
                      <TableCell>{entry.createdBy || "—"}</TableCell>
                      <TableCell className={`text-right font-medium ${entry.entryType === "credit" ? "text-emerald-600" : ""}`}>
                        {entry.entryType === "credit" ? "+" : "−"}
                        {formatMoney(entry.amount, entry.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
