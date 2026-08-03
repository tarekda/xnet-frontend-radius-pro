"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  Radio,
  Wallet,
} from "lucide-react";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import type { ExternalInvoice, User } from "@/types/api";
import ExternalInvoiceDetailView from "@/components/ExternalInvoiceDetailView";
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
  const liveQuery = useLiveSession(username, canSeeSessions && Boolean(user.isOnline));
  const usageQuery = useUsageWindow(username, canSeeSessions);

  const openInvoices = useMemo(
    () => (invoicesQuery.data?.data ?? []).filter((invoice) => invoice.status !== "paid"),
    [invoicesQuery.data?.data]
  );
  const outstanding = openInvoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  const recentBytes = Number(
    usageQuery.data?.totalBytes ??
      Number(usageQuery.data?.bytesIn ?? 0) + Number(usageQuery.data?.bytesOut ?? 0)
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card className="border-border/70">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Service</span>
            <Radio className={`h-4 w-4 ${user.isOnline ? "text-emerald-500" : "text-muted-foreground"}`} />
          </div>
          <div className="mt-2 text-xl font-semibold">{user.isOnline ? "Online" : "Offline"}</div>
          <div className="mt-1 truncate text-xs text-muted-foreground">
            {liveQuery.data?.framedIpAddress
              ? `${liveQuery.data.framedIpAddress} · ${formatDuration(liveQuery.data.sessionTime)}`
              : user.lastTimeActive
                ? `Last active ${formatDateTime(user.lastTimeActive)}`
                : "No recent session details"}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Usage · last 24h</span>
            <Activity className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-xl font-semibold">
            {usageQuery.isLoading ? "…" : formatBytes(recentBytes)}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {usageQuery.data?.sessions ?? 0} session(s) in the usage window
          </div>
        </CardContent>
      </Card>

      {canSeeBilling ? (
        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Outstanding billing</span>
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <div className="mt-2 text-xl font-semibold">
              {invoicesQuery.isLoading
                ? "…"
                : canSeeTotals
                  ? formatMoney(outstanding)
                  : `${openInvoices.length} open`}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{openInvoices.length} unpaid or pending invoice(s)</div>
          </CardContent>
        </Card>
      ) : null}

      {canSeeWallet ? (
        <Card className="border-border/70">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Wallet balance</span>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-xl font-semibold">
              {walletQuery.isLoading ? "…" : formatMoney(walletQuery.data?.balance)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{walletQuery.data?.total ?? 0} ledger transaction(s)</div>
          </CardContent>
        </Card>
      ) : null}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Invoices</div>
            <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Open invoices</div>
            <div className="mt-1 text-2xl font-semibold">{openRows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Outstanding</div>
            <div className="mt-1 text-2xl font-semibold">
              {canSeeTotals ? formatMoney(outstanding) : "Restricted"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
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
        <CardContent>
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
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[720px]">
                <TableHeader>
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
                    <TableRow key={invoice.id}>
                      <TableCell className="font-mono">#{invoice.id}</TableCell>
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
                        <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(invoice)}>
                          Manage
                        </Button>
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

export function CustomerWalletPanel({ username }: { username: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasAccess = canAny(user, ["billing.externalInvoices.view", "billing.externalInvoices.pay"]);
  const canCredit = can(user, "billing.externalInvoices.pay");
  const query = useCustomerWallet(username, hasAccess);
  const [creditOpen, setCreditOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

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

  const validAmount = Number.isFinite(Number(amount)) && Number(amount) > 0;

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Wallet
            </CardTitle>
            <CardDescription>Balance and recent financial transactions</CardDescription>
          </div>
          {canCredit ? (
            <Button onClick={() => setCreditOpen(true)}>
              <Plus className="h-4 w-4" />
              Credit wallet
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl border bg-muted/20 p-4">
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
            <div className="overflow-x-auto rounded-lg border">
              <Table className="min-w-[760px]">
                <TableHeader>
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
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
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
