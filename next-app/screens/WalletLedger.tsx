"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/api/client";

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
  const [username, setUsername] = useState("");
  const [appliedUser, setAppliedUser] = useState("");
  const [entryType, setEntryType] = useState<"all" | "credit" | "debit">("all");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["subscriberWalletLedger", appliedUser, entryType, page],
    queryFn: () => fetchLedger({ username: appliedUser, entryType, page }),
  });

  const rows = query.data?.data || [];

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

      <PageHeader
        title="Wallet ledger"
        subtitle="Credits and debits for subscriber wallets (Whish top-ups, invoice payments)"
        icon={Wallet}
      />

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
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet entries found.</p>
          ) : (
            <div className="overflow-x-auto">
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
    </div>
  );
}
