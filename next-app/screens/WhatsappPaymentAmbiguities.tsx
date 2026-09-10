"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, XCircle, Search } from "lucide-react";
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
import { notify } from "@/lib/notify";
import { apiClient } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import type { ExternalInvoice } from "@/types/api";
import { useExternalInvoiceRealtimeSync } from "@/hooks/useExternalInvoiceRealtimeSync";

type WhatsappAmbiguity = {
  id: number;
  submittedName: string;
  billingMonth: string;
  status: "pending" | "resolved" | "dismissed";
  sourceFrom?: string | null;
  createdAt?: string | null;
  candidates: ExternalInvoice[];
};

async function fetchWhatsappAmbiguities(status: string): Promise<WhatsappAmbiguity[]> {
  const { data } = await apiClient.get("/invoices/external/whatsapp-payment-ambiguities", {
    params: { status },
  });
  return data?.data || [];
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

export default function WhatsappPaymentAmbiguitiesPage() {
  const { user } = useAuth();
  const canPay = can(user, "billing.externalInvoices.pay");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"pending" | "resolved" | "dismissed">("pending");

  const [customSearchItem, setCustomSearchItem] = useState<WhatsappAmbiguity | null>(null);
  const [customSearchQueryText, setCustomSearchQueryText] = useState("");
  const [customSelectedInvoice, setCustomSelectedInvoice] = useState<ExternalInvoice | null>(null);

  const customInvoiceSearch = useQuery({
    queryKey: ["customInvoiceSearchForAmbiguity", customSearchQueryText],
    queryFn: async () => {
      if (!customSearchQueryText.trim() || customSearchQueryText.trim().length < 2) return [];
      const { data } = await apiClient.get("/invoices/external", {
        params: { search: customSearchQueryText.trim(), status: "unpaid", limit: 8 },
      });
      return (Array.isArray(data?.data) ? data.data : []) as ExternalInvoice[];
    },
    enabled: !!customSearchItem && customSearchQueryText.trim().length >= 2,
  });

  const listQuery = useQuery({
    queryKey: ["whatsappPaymentAmbiguities", status],
    queryFn: () => fetchWhatsappAmbiguities(status),
    refetchInterval: 30_000,
  });

  useExternalInvoiceRealtimeSync(() => {
    queryClient.invalidateQueries({ queryKey: ["whatsappPaymentAmbiguities"] });
    queryClient.invalidateQueries({ queryKey: ["externalInvoices"] });
  });

  const resolveMutation = useMutation({
    mutationFn: async (vars: { ambiguityId: number; invoiceId: number }) => {
      const { data } = await apiClient.post(
        `/invoices/external/whatsapp-payment-ambiguities/${vars.ambiguityId}/resolve`,
        { invoiceId: vars.invoiceId }
      );
      return data;
    },
    onSuccess: () => {
      notify.success("Marked paid", "The selected subscriber was marked paid.");
      queryClient.invalidateQueries({ queryKey: ["whatsappPaymentAmbiguities"] });
      queryClient.invalidateQueries({ queryKey: ["externalInvoices"] });
    },
    onError: (e: any) => {
      notify.error("Failed", e?.response?.data?.message || e?.message || "Could not apply payment");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (ambiguityId: number) => {
      const { data } = await apiClient.post(
        `/invoices/external/whatsapp-payment-ambiguities/${ambiguityId}/dismiss`,
        { reason: "Not a payment / wrong message" }
      );
      return data;
    },
    onSuccess: () => {
      notify.success("Dismissed", "Removed from the queue without marking anyone paid.");
      queryClient.invalidateQueries({ queryKey: ["whatsappPaymentAmbiguities"] });
    },
    onError: (e: any) => {
      notify.error("Dismiss failed", e?.response?.data?.message || e?.message || "Could not dismiss");
    },
  });

  const rows = useMemo(() => listQuery.data || [], [listQuery.data]);
  const pendingCount = status === "pending" ? rows.length : undefined;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="WhatsApp name matches"
        subtitle="When collectors send a name without a middle name and several subscribers match, choose who paid here."
        icon={MessageCircle}
        actions={
          <Button variant="outline" asChild>
            <Link href="/external-invoices">External invoices</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {(["pending", "resolved", "dismissed"] as const).map((s) => (
          <Button
            key={s}
            variant={status === s ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s)}
          >
            {s === "pending" ? "Needs review" : s === "resolved" ? "Resolved" : "Dismissed"}
          </Button>
        ))}
      </div>

      {listQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : listQuery.error ? (
        <p className="text-sm text-destructive">Could not load queue.</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {status === "pending"
              ? "No ambiguous WhatsApp payments waiting for review."
              : `No ${status} items.`}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-lg">
                      “{item.submittedName}”
                      {status === "pending" && (
                        <Badge variant="secondary" className="ml-2">
                          {item.candidates.length} matches
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Billing month {item.billingMonth.slice(0, 7)} · {formatWhen(item.createdAt)}
                      {item.sourceFrom ? ` · from ${item.sourceFrom}` : ""}
                    </CardDescription>
                  </div>
                  {status === "pending" && canPay && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={dismissMutation.isPending}
                      onClick={() => dismissMutation.mutate(item.id)}
                    >
                      <XCircle className="mr-1 h-4 w-4" />
                      Dismiss
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {item.candidates.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">#{c.id}</span>
                    <span className="min-w-[160px] font-medium">{c.fullName}</span>
                    <span className="text-muted-foreground">{c.username}</span>
                    <span className="font-semibold">${Number(c.amount).toFixed(2)}</span>
                    {c.debitLabel ? (
                      <Badge variant="outline">{c.debitLabel}</Badge>
                    ) : null}
                    {status === "pending" && canPay ? (
                      <Button
                        size="sm"
                        className="ml-auto"
                        disabled={resolveMutation.isPending}
                        onClick={() =>
                          resolveMutation.mutate({ ambiguityId: item.id, invoiceId: c.id! })
                        }
                      >
                        {resolveMutation.isPending ? (
                          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1 h-4 w-4" />
                        )}
                        Mark this one paid
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="ml-auto" asChild>
                        <Link href={`/external-invoices?q=${c.id}`}>Open</Link>
                      </Button>
                    )}
                  </div>
                ))}

                {status === "pending" && canPay && (
                  <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Not in the candidate list above?</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setCustomSearchItem(item);
                        setCustomSearchQueryText(item.submittedName.replace(/\(.*?\)/g, "").trim());
                        setCustomSelectedInvoice(null);
                      }}
                      className="text-xs h-7 gap-1"
                    >
                      <Search className="h-3 w-3" />
                      Search & Select Other Subscriber
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pendingCount !== undefined && pendingCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {pendingCount} item{pendingCount === 1 ? "" : "s"} need a choice before payment is applied.
        </p>
      )}

      {/* Custom Subscriber Search Dialog */}
      <Dialog
        open={!!customSearchItem}
        onOpenChange={(open) => !open && setCustomSearchItem(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-sky-600" />
              Select Other Subscriber For Payment
            </DialogTitle>
            <DialogDescription>
              {customSearchItem ? (
                <>
                  Applying payment for submitted name:{" "}
                  <span className="font-semibold text-foreground">&ldquo;{customSearchItem.submittedName}&rdquo;</span>
                </>
              ) : (
                "Search and select subscriber invoice"
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-inv-search" className="text-xs">
                Search Unpaid Invoices
              </Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="custom-inv-search"
                  placeholder="Type name, username, or invoice #…"
                  value={customSearchQueryText}
                  onChange={(e) => {
                    setCustomSearchQueryText(e.target.value);
                    setCustomSelectedInvoice(null);
                  }}
                  className="pl-9 text-xs"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-1.5 border rounded-lg p-2">
              {customInvoiceSearch.isLoading ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Searching unpaid invoices…
                </div>
              ) : !customSearchQueryText.trim() || customSearchQueryText.trim().length < 2 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  Enter at least 2 characters to search unpaid invoices.
                </div>
              ) : (customInvoiceSearch.data || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No unpaid invoices found matching &ldquo;{customSearchQueryText}&rdquo;.
                </div>
              ) : (
                (customInvoiceSearch.data || []).map((inv) => {
                  const isSelected = customSelectedInvoice?.id === inv.id;
                  return (
                    <div
                      key={inv.id}
                      onClick={() => setCustomSelectedInvoice(inv)}
                      className={`p-2.5 rounded-md border text-xs cursor-pointer transition-all flex items-center justify-between ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/40"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <div>
                        <div className="font-bold text-foreground flex items-center gap-1.5">
                          <span>{inv.fullName}</span>
                          <span className="font-mono text-[11px] text-muted-foreground font-normal">
                            (@{inv.username})
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Invoice #{inv.id} · Due: {inv.payDueDate ? new Date(inv.payDueDate).toLocaleDateString() : "—"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-mono font-bold text-foreground">
                          ${Number(inv.totalAmount ?? inv.amount ?? 0).toFixed(2)}
                        </div>
                        {isSelected && (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 text-[10px]">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomSearchItem(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (customSearchItem && customSelectedInvoice?.id) {
                  resolveMutation.mutate({
                    ambiguityId: customSearchItem.id,
                    invoiceId: customSelectedInvoice.id,
                  });
                  setCustomSearchItem(null);
                }
              }}
              disabled={!customSelectedInvoice || resolveMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Apply Payment & Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
