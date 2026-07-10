"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Smartphone, XCircle } from "lucide-react";
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
import { notify } from "@/lib/notify";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";

type WhishClaim = {
  id: number;
  externalInvoiceId: number;
  username: string;
  amount: number;
  currency: string;
  whishReference: string;
  status: "pending" | "confirmed" | "rejected";
  note?: string | null;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string | null;
};

async function fetchWhishClaims(status: string): Promise<WhishClaim[]> {
  const { data } = await apiClient.get("/invoices/whish-claims", { params: { status } });
  return data?.data || [];
}

function formatMoney(amount: number, currency = "USD") {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency === "LBP" ? "LBP" : "USD",
      maximumFractionDigits: currency === "LBP" ? 0 : 2,
    }).format(Number(amount) || 0);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function WhishPaymentsPage() {
  const { user } = useAuth();
  const canPay = can(user, "billing.externalInvoices.pay");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "confirmed" | "rejected">("pending");
  const [search, setSearch] = useState("");

  const claimsQuery = useQuery({
    queryKey: ["whishClaims", status],
    queryFn: () => fetchWhishClaims(status),
    refetchInterval: 30_000,
  });

  const confirmMutation = useMutation({
    mutationFn: async (claimId: number) => {
      const { data } = await apiClient.post(`/invoices/whish-claims/${claimId}/confirm`, {});
      return data;
    },
    onSuccess: (data) => {
      const bal = data?.data?.balance;
      notify.success(
        "Wallet credited",
        bal != null
          ? `Subscriber wallet is now $${Number(bal).toFixed(2)}`
          : "Whish payment approved and wallet credited."
      );
      queryClient.invalidateQueries({ queryKey: ["whishClaims"] });
      queryClient.invalidateQueries({ queryKey: ["externalInvoices"] });
    },
    onError: (e: any) => {
      notify.error("Approve failed", e?.response?.data?.message || e?.message || "Could not approve");
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (vars: { claimId: number; reason?: string }) => {
      const { data } = await apiClient.post(`/invoices/whish-claims/${vars.claimId}/reject`, {
        reason: vars.reason || "Rejected by staff",
      });
      return data;
    },
    onSuccess: () => {
      notify.success("Claim rejected", "Subscriber can submit a new reference if needed.");
      queryClient.invalidateQueries({ queryKey: ["whishClaims"] });
    },
    onError: (e: any) => {
      notify.error("Reject failed", e?.response?.data?.message || e?.message || "Could not reject");
    },
  });

  const rows = useMemo(() => {
    const list = claimsQuery.data || [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.whishReference?.toLowerCase().includes(q) ||
        c.username?.toLowerCase().includes(q) ||
        String(c.externalInvoiceId).includes(q) ||
        String(c.amount).includes(q)
    );
  }, [claimsQuery.data, search]);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Whish payments"
          subtitle="Subscriber-reported Whish references — approve to credit wallet"
          icon={Smartphone}
        />
        <Button variant="outline" asChild>
          <Link href="/external-invoices">
            <ArrowLeft />
            External invoices
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Payment reports</CardTitle>
          <CardDescription>
            When a subscriber tops up via Whish QR and submits a reference, it appears here. Approving
            credits their wallet (invoice is paid later from wallet).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={status} onValueChange={(v: any) => setStatus(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="max-w-sm"
              placeholder="Search username, reference, invoice #"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Button variant="outline" onClick={() => claimsQuery.refetch()} disabled={claimsQuery.isFetching}>
              {claimsQuery.isFetching ? <Loader2 className="animate-spin" /> : null}
              Refresh
            </Button>
          </div>

          {claimsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load Whish claims.</p>
          ) : null}

          {claimsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
              No {status} Whish payment reports.
            </div>
          ) : (
            <div className="space-y-3">
              {rows.map((c) => (
                <div
                  key={c.id}
                  className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">@{c.username}</span>
                      <Badge
                        variant={
                          c.status === "confirmed"
                            ? "success"
                            : c.status === "rejected"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {c.status}
                      </Badge>
                      <Badge variant="secondary" className="font-normal">
                        Invoice #{c.externalInvoiceId}
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{formatMoney(c.amount, c.currency)}</span>
                      <span className="text-muted-foreground"> · ref </span>
                      <span className="font-mono text-xs sm:text-sm">{c.whishReference}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Reported {formatWhen(c.createdAt)}
                      {c.confirmedBy ? ` · by ${c.confirmedBy}` : ""}
                      {c.rejectionReason ? ` · ${c.rejectionReason}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/external-invoices?highlight=${c.externalInvoiceId}`}>
                        Open invoice
                      </Link>
                    </Button>
                    {c.status === "pending" && canPay ? (
                      <>
                        <Button
                          size="sm"
                          disabled={confirmMutation.isPending}
                          onClick={() => confirmMutation.mutate(c.id)}
                        >
                          {confirmMutation.isPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <CheckCircle2 />
                          )}
                          Approve → credit wallet
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={rejectMutation.isPending}
                          onClick={() => {
                            const reason = window.prompt("Rejection reason (optional)") || undefined;
                            rejectMutation.mutate({ claimId: c.id, reason });
                          }}
                        >
                          <XCircle />
                          Reject
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
