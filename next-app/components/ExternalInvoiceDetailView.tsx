import React, { useState, useMemo, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Ban, CalendarIcon, Copy, Loader2, Mail, MessageCircle, Printer, ReceiptText, User } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { ExternalInvoice } from "@/types/api";
import { useExternalInvoices } from "@/hooks/useExternalInvoices";
import { useToast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { isFeatureEnabled } from "@/lib/featureFlags";
import { notify } from "@/lib/notify";
import { fetchExternalInvoiceHistory, fetchExternalInvoicePaymentLines, setExternalInvoiceWorkflow, voidExternalCreditNote } from "@/api/invoices";
import { apiClient } from "@/api/client";
import ExternalInvoiceAddDebitDialog from "@/components/ExternalInvoiceAddDebitDialog";
import SendWhatsAppDialog from "@/components/SendWhatsAppDialog";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { parsePromiseDateFromLastAction } from "@/lib/externalInvoiceInsights";

type Props = {
  invoice: ExternalInvoice;
  onClose: () => void;
  onSave: (updated: ExternalInvoice) => void;
};

const ReadOnlyMetric = ({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) => (
  <div className={className}>
    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</div>
    <div className="font-medium text-sm break-words">{value || "—"}</div>
  </div>
);

function remainingOf(inv: ExternalInvoice): number {
  if (inv.remainingDue != null && Number.isFinite(Number(inv.remainingDue))) {
    return Math.max(0, Number(inv.remainingDue));
  }
  const due = Number(inv.totalAmount ?? inv.amount ?? 0);
  const paid = Number(inv.amountPaid ?? 0);
  if (String(inv.status).toLowerCase() === "paid") return 0;
  return Math.max(0, Math.round((due - paid) * 100) / 100);
}

const ExternalInvoiceDetailView: React.FC<Props> = ({
  invoice,
  onClose,
  onSave,
}) => {
  const { user } = useAuth();
  const canPay = can(user, "billing.externalInvoices.pay");
  const canUnpay = can(user, "billing.externalInvoices.unpay");
  const canPrint = can(user, "billing.externalInvoices.viewTotals");
  const canSendReminder = isFeatureEnabled("whatsapp-remind");

  const [isEditing, setIsEditing] = useState(false);
  const [isAddDebitOpen, setIsAddDebitOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "pos" | "transfer" | "other" | "gateway" | "wallet">("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [debitRemainder, setDebitRemainder] = useState(false);
  const [matchedClaims, setMatchedClaims] = useState<any[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [creditNoteBusy, setCreditNoteBusy] = useState(false);
  const [creditNoteConfirmOpen, setCreditNoteConfirmOpen] = useState(false);
  const [creditNoteToVoid, setCreditNoteToVoid] = useState<ExternalInvoice | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [promiseDateInput, setPromiseDateInput] = useState<string>(parsePromiseDateFromLastAction((invoice as any).lastAction) || "");
  const [editedInvoice, setEditedInvoice] = useState<ExternalInvoice>({
    ...invoice,
  });
  const isCreditNote = String(editedInvoice.documentType || "invoice") === "credit_note";
  const isVoided = Boolean(editedInvoice.voidedAt);
  const openDocument = (
    target: ExternalInvoice,
    kind: "invoice" | "credit_note" | "receipt"
  ) => {
    window.open(
      `/external-invoices/${target.id}/print?kind=${kind}&auto=1`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  // lightweight access to mutations via hook (pageSize 1 to avoid heavy work)
  const {
    updateInvoiceMutation,
    setInvoiceAsPaidMutation,
    unpayInvoiceMutation,
    sendReminderMutation,
    emailInvoiceMutation,
    sharePaidInvoiceMutation,
    refetch,
  } = useExternalInvoices({ initialPage: 1, pageSize: 1, search: "", enabled: false });
  const { toast } = useToast();
  const historyQuery = useQuery({
    queryKey: ["externalInvoiceHistory", invoice.id],
    queryFn: () => fetchExternalInvoiceHistory(invoice.id, 100),
    staleTime: 30_000,
  });
  const paymentLinesQuery = useQuery({
    queryKey: ["externalInvoicePaymentLines", invoice.username, invoice.billingMonth, invoice.provider],
    queryFn: () =>
      fetchExternalInvoicePaymentLines(
        invoice.username,
        String(invoice.billingMonth).slice(0, 10),
        invoice.provider
      ),
    staleTime: 30_000,
  });
  const workflowMutation = useMutation({
    mutationFn: async (payload: { stage: "new" | "reminded" | "promise_to_pay" | "escalated" | "resolved"; promiseDate?: string | null }) =>
      setExternalInvoiceWorkflow(invoice.id, payload),
    onSuccess: () => {
      notify.success("Workflow updated", "Stage saved.");
      historyQuery.refetch();
      refetch();
    },
    onError: (e: unknown) => {
      notify.error("Workflow failed", e instanceof Error ? e.message : "Could not update workflow.");
    },
  });
  const voidCreditNoteMutation = useMutation({
    mutationFn: async () => {
      if (!creditNoteToVoid?.id) throw new Error("Credit note is required");
      return voidExternalCreditNote(creditNoteToVoid.id, voidReason.trim());
    },
    onSuccess: async (voided) => {
      notify.success("Credit note voided", `Document #${voided.id} no longer affects financial totals.`);
      setCreditNoteToVoid(null);
      setVoidReason("");
      await Promise.all([
        paymentLinesQuery.refetch(),
        historyQuery.refetch(),
        refetch(),
      ]);
    },
    onError: (e: any) => {
      notify.error(
        "Void failed",
        e?.response?.data?.message || e?.message || "Could not void credit note"
      );
    },
  });

  const whishClaimsQuery = useQuery({
    queryKey: ["externalInvoiceWhishClaims", invoice.id],
    queryFn: async (): Promise<any[]> => {
      const { data } = await apiClient.get("/invoices/whish-claims", { params: { status: "pending" } });
      const all: any[] = data?.data || [];
      return all.filter((c) => Number(c.externalInvoiceId) === Number(invoice.id));
    },
    // Cached per invoice so re-opening the same invoice doesn't re-fetch all pending claims.
    staleTime: 30_000,
  });
  const whishClaims = whishClaimsQuery.data ?? [];
  const claimsLoading = whishClaimsQuery.isLoading;

  useEffect(() => {
    setPayAmount(remainingOf(invoice).toFixed(2));
    setDebitRemainder(false);
  }, [invoice.id, invoice.remainingDue, invoice.amountPaid, invoice.amount, invoice.totalAmount, invoice.status]);

  useEffect(() => {
    const ref = paymentReference.trim();
    if (ref.length < 4) {
      setMatchedClaims([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setMatchLoading(true);
      try {
        const { data } = await apiClient.get("/invoices/whish-claims", {
          params: { status: "pending", reference: ref },
        });
        if (!cancelled) setMatchedClaims(data?.data || []);
      } catch {
        if (!cancelled) setMatchedClaims([]);
      } finally {
        if (!cancelled) setMatchLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [paymentReference]);

  const confirmClaim = async (claimId: number) => {
    try {
      await apiClient.post(`/invoices/whish-claims/${claimId}/confirm`, {});
      notify.success("Wallet credited", "Whish payment approved — subscriber balance updated.");
      refetch();
      void whishClaimsQuery.refetch();
      onClose();
    } catch (e: any) {
      notify.error("Confirm failed", e?.response?.data?.message || e?.message || "Could not confirm");
    }
  };

  /* ── handlers ─────────────────────────────── */
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setEditedInvoice((prev) => ({ ...prev, [id]: value }));
  };

  const handleDate = (date: Date | undefined, field: keyof ExternalInvoice) => {
    if (date)
      setEditedInvoice((prev) => ({ ...prev, [field]: date.toISOString() }));
  };

  const handleStatusChange = (value: string) => {
    setEditedInvoice((prev: any) => ({ ...prev, status: value }));
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => notify.success("Copied", `${label} copied to clipboard`),
      () => notify.error("Copy failed", "Could not copy to clipboard")
    );
  };

  const renderField = (key: string, value: any) => (
    <div key={key} className="mb-4">
      <Label htmlFor={key} className="block mb-2 capitalize">
        {key === "payDueDate"
          ? "Pay due date"
          : key === "debitLabel"
            ? "Payment line"
            : key}
      </Label>
      {key === "status" && isEditing ? (
        <Select
          value={value as string}
          onValueChange={handleStatusChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="unpaid">Unpaid</SelectItem>
          </SelectContent>
        </Select>
      ) : key === "paidAt" && isEditing ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-full justify-start",
                !value && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {value ? format(new Date(value), "PPP") : "Pick a date"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="p-0">
            <Calendar
              mode="single"
              selected={value ? new Date(value) : undefined}
              onSelect={(d) => handleDate(d!, "paidAt")}
              autoFocus
            />
          </PopoverContent>
        </Popover>
      ) : key === "payDueDate" && isEditing ? (
        <Input
          type="date"
          id="payDueDate"
          value={value ? String(value).slice(0, 10) : ""}
          onChange={(e) =>
            setEditedInvoice((prev) => ({
              ...prev,
              payDueDate: e.target.value ? e.target.value : null,
            }))
          }
          className="w-full"
        />
      ) : (
        <Input
          id={key}
          value={
            ["billingMonth", "createdAt", "paidAt", "payDueDate"].includes(key)
              ? value
                ? key === "payDueDate" || key === "billingMonth"
                  ? new Date(`${String(value).slice(0, 10)}T12:00:00`).toLocaleDateString()
                  : new Date(value as string).toLocaleString()
                : ""
              : String(value ?? "")
          }
          readOnly={
            !isEditing ||
            ["id", "createdAt", "documentType", "parentInvoiceId", "voidedAt", "voidedBy", "voidReason"].includes(key)
          }
          onChange={handleInput}
          className="w-full"
        />
      )}
    </div>
  );

  const saveAndClose = () => {
    onSave(editedInvoice);
    setIsEditing(false);
  };

  const remainingDue = remainingOf(editedInvoice);
  const requestedPay = Number(payAmount);
  const isPartialPay =
    Number.isFinite(requestedPay) && requestedPay > 0 && requestedPay + 0.009 < remainingDue;

  const markPaidLocal = () => {
    if (!canPay) return;
    const prev = {
      status: editedInvoice.status,
      paidAt: (editedInvoice as any).paidAt,
      amountPaid: editedInvoice.amountPaid,
      remainingDue: editedInvoice.remainingDue,
    } as any;
    const applyAmount = Number.isFinite(requestedPay) && requestedPay > 0 ? requestedPay : remainingDue;
    const willRemain = Math.max(0, remainingDue - applyAmount);
    setEditedInvoice((prevInv: any) => ({
      ...prevInv,
      status: willRemain < 0.01 || debitRemainder ? "paid" : "pending",
      paidAt: willRemain < 0.01 || debitRemainder ? new Date().toISOString() : prevInv.paidAt,
      amountPaid: Number(prevInv.amountPaid ?? 0) + applyAmount,
      remainingDue: debitRemainder ? 0 : willRemain,
    }));
    const ref = paymentReference.trim();
    setInvoiceAsPaidMutation.mutate(
      {
        invoiceId: editedInvoice.id,
        paymentMethod: ref ? "gateway" : paymentMethod,
        paymentReference: ref || undefined,
        paymentProvider:
          paymentMethod === "wallet"
            ? "wallet"
            : ref || paymentMethod === "gateway"
              ? "whish"
              : undefined,
        paidAmount: applyAmount,
        debitRemainder: debitRemainder && willRemain >= 0.01,
        silent: true,
      },
      {
      onSuccess: (res) => {
        refetch();
        const next = (res as any)?.data;
        if (next) setEditedInvoice((prevInv) => ({ ...prevInv, ...next }));
        toast({
          title:
            willRemain >= 0.01 && !debitRemainder
              ? `Recorded ${applyAmount.toFixed(2)} on invoice #${editedInvoice.id}`
              : `Invoice #${editedInvoice.id} marked as paid`,
          action: (
            <ToastAction altText="Undo" onClick={() => updateInvoiceMutation.mutate({ invoiceId: editedInvoice.id, invoiceData: prev }, { onSuccess: () => refetch() })}>
              Undo
            </ToastAction>
          ),
        });
      },
      onError: () => setEditedInvoice((_) => ({ ..._, ...prev })),
    });
  };

  const markUnpaidLocal = () => {
    if (!canUnpay) return;
    const prev = { status: editedInvoice.status, paidAt: (editedInvoice as any).paidAt } as any;
    setEditedInvoice((prevInv: any) => ({ ...prevInv, status: "unpaid", paidAt: null }));
    unpayInvoiceMutation.mutate({ invoiceId: editedInvoice.id, silent: true }, {
      onSuccess: () => {
        refetch();
        toast({
          title: `Invoice #${editedInvoice.id} marked as unpaid`,
          action: (
            <ToastAction altText="Undo" onClick={() => updateInvoiceMutation.mutate({ invoiceId: editedInvoice.id, invoiceData: prev }, { onSuccess: () => refetch() })}>
              Undo
            </ToastAction>
          ),
        });
      },
      onError: () => setEditedInvoice((_) => ({ ..._, ...prev })),
    });
  };

  /* ── render ───────────────────────────────── */
  const timelineItems = useMemo(() => {
    const seed = [
      (invoice as any).createdAt
        ? { label: "CREATED", actor: (invoice as any).modifiedBy || "system", date: (invoice as any).createdAt, detail: "" }
        : null,
      (invoice as any).paidAt
        ? { label: "PAID", actor: (invoice as any).modifiedBy || "system", date: (invoice as any).paidAt, detail: "" }
        : null,
    ].filter(Boolean) as Array<{ label: string; actor: string; date: string; detail: string }>;
    const fromLogs = (historyQuery.data || []).map((item) => ({
      label: item.action,
      actor: item.username,
      date: item.timestamp,
      detail: item.changes ? JSON.stringify(item.changes) : "",
    }));
    return [...seed, ...fromLogs].sort((a, b) => new Date(b.date || "").getTime() - new Date(a.date || "").getTime());
  }, [historyQuery.data, invoice]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="lg:max-w-4xl w-full p-0 overflow-hidden relative flex flex-col max-h-[85vh]">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b bg-background/90 backdrop-blur">
          <DialogHeader>
            <DialogTitle>External Invoice Details</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(String(editedInvoice.id), "Invoice ID")}
              title="Copy Invoice ID"
            >
              <Copy className="h-4 w-4 mr-1" />
              Copy ID
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => copyToClipboard(editedInvoice.username, "Username")}
              title="Copy Username"
            >
              <User className="h-4 w-4 mr-1" />
              Copy User
            </Button>
            {canPrint ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDocument(editedInvoice, isCreditNote ? "credit_note" : "invoice")}
              >
                <Printer className="mr-1 h-4 w-4" />
                {isCreditNote ? "Credit note" : "Invoice"}
              </Button>
            ) : null}
            {canPrint && !isCreditNote && editedInvoice.status === "paid" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openDocument(editedInvoice, "receipt")}
              >
                <ReceiptText className="mr-1 h-4 w-4" />
                Receipt
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => setIsWhatsAppOpen(true)}
              title="Send WhatsApp notice or receipt"
            >
              <MessageCircle className="mr-1 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              WhatsApp
            </Button>
            {!isCreditNote && !isVoided ? (
              <>
                {editedInvoice.status !== "paid" && canPay ? (
                  <Button variant="outline" size="sm" onClick={markPaidLocal}>
                    {isPartialPay ? "Record payment" : "Mark Paid"}
                  </Button>
                ) : null}
                {(editedInvoice.status === "paid" || Number(editedInvoice.amountPaid ?? 0) > 0.009) && canUnpay ? (
                  <Button variant="outline" size="sm" onClick={markUnpaidLocal}>
                    Mark Unpaid
                  </Button>
                ) : null}
              </>
            ) : null}
            {!isCreditNote && !isVoided ? (
              String(editedInvoice.status).toLowerCase() === "paid" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    sharePaidInvoiceMutation.mutate(editedInvoice.id, {
                      onSuccess: () => historyQuery.refetch(),
                    })
                  }
                  disabled={!canSendReminder || sharePaidInvoiceMutation.isPending}
                  title={!canSendReminder ? "WhatsApp messaging is disabled" : "Share paid invoice on WhatsApp"}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Share paid
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    sendReminderMutation.mutate(editedInvoice.id, {
                      onSuccess: () => historyQuery.refetch(),
                    })
                  }
                  disabled={!canSendReminder || sendReminderMutation.isPending}
                  title={!canSendReminder ? "Reminder feature is disabled" : "Send WhatsApp reminder"}
                >
                  <MessageCircle className="mr-1 h-4 w-4" />
                  Send reminder
                </Button>
              )
            ) : null}
            {!isVoided ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  emailInvoiceMutation.mutate(
                    { invoiceId: editedInvoice.id },
                    { onSuccess: () => historyQuery.refetch() }
                  )
                }
                disabled={emailInvoiceMutation.isPending}
                title="Email this document to the subscriber's address on file"
              >
                {emailInvoiceMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="mr-1 h-4 w-4" />
                )}
                Email
              </Button>
            ) : null}
            {!isVoided && (isEditing ? (
              <>
                <Button size="sm" onClick={saveAndClose}>Save</Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setIsEditing(true)}>Edit</Button>
            ))}
            <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>

        {/* Body with tabs - scrolls within the dialog */}
        <div className="p-4 flex-1 overflow-y-auto overflow-x-auto">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid grid-cols-3 w-full mb-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {!isEditing ? (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm">
                    <ReadOnlyMetric label="Username" value={editedInvoice.username} />
                    <ReadOnlyMetric label="Provider" value={editedInvoice.provider} />
                    <ReadOnlyMetric label="Billing Month" value={editedInvoice.billingMonth ? String(editedInvoice.billingMonth).slice(0, 10) : ""} />
                    <ReadOnlyMetric label="Created" value={(editedInvoice as any).createdAt ? new Date((editedInvoice as any).createdAt).toLocaleString() : ""} />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 rounded-xl border border-border/70 bg-card/60 shadow-sm backdrop-blur-sm">
                    <ReadOnlyMetric label="Status" value={<Badge variant={editedInvoice.status === 'paid' ? 'default' : editedInvoice.status === 'unpaid' ? 'destructive' : 'secondary'} className="capitalize">{editedInvoice.status}</Badge>} />
                    <ReadOnlyMetric label="Pay Due Date" value={editedInvoice.payDueDate ? String(editedInvoice.payDueDate).slice(0, 10) : ""} />
                    <ReadOnlyMetric label="Total Amount" value={`$${Number((editedInvoice as any).totalAmount ?? editedInvoice.amount ?? 0).toFixed(2)}`} />
                    <ReadOnlyMetric label="Remaining Due" value={`$${remainingDue.toFixed(2)}`} />
                  </div>

                  {isVoided && (
                    <div className="p-4 rounded-xl border border-destructive/50 bg-destructive/10 text-destructive text-sm">
                      <strong>Voided:</strong> This document was voided on {new Date((editedInvoice as any).voidedAt).toLocaleString()} by {(editedInvoice as any).voidedBy}. Reason: {(editedInvoice as any).voidReason}
                    </div>
                  )}
                </>
              ) : (
                <div className="p-5 rounded-xl border border-primary/20 bg-primary/5 space-y-4 shadow-inner">
                  <div className="flex items-center gap-2 pb-2 border-b border-primary/10">
                    <Plus className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-primary">Edit Invoice Fields</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    {renderField("username", editedInvoice.username)}
                    {renderField("provider", editedInvoice.provider)}
                    {renderField("billingMonth", editedInvoice.billingMonth)}
                    {renderField("payDueDate", editedInvoice.payDueDate)}
                    {renderField("amount", editedInvoice.amount)}
                    {renderField("taxRate", (editedInvoice as any).taxRate)}
                    {renderField("taxAmount", (editedInvoice as any).taxAmount)}
                    {renderField("subtotalAmount", (editedInvoice as any).subtotalAmount)}
                    {renderField("totalAmount", (editedInvoice as any).totalAmount)}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="space-y-4">
              <div className="rounded-md border p-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">Payment lines this month</div>
                    <div className="text-xs text-muted-foreground">
                      Multiple pending charges for the same customer and billing month
                    </div>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setIsAddDebitOpen(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add line
                  </Button>
                </div>
                {paymentLinesQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading lines…</div>
                ) : (
                  <div className="space-y-2">
                    {(paymentLinesQuery.data ?? []).map((line) => (
                      <div
                        key={line.id}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${
                          line.id === invoice.id ? "border-primary/40 bg-primary/5" : ""
                        } ${line.voidedAt ? "border-muted bg-muted/40 text-muted-foreground" : ""}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium">#{line.id}</span>
                          {line.debitLabel ? (
                            <Badge variant="secondary">{line.debitLabel}</Badge>
                          ) : (
                            <Badge variant="outline">primary</Badge>
                          )}
                          <span className="text-muted-foreground capitalize">{line.status}</span>
                          {line.voidedAt ? <Badge variant="destructive">Voided</Badge> : null}
                        </div>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className={cn("font-semibold", line.voidedAt && "line-through")}>
                            ${Number(line.amount).toFixed(2)}
                          </span>
                          <span className="text-muted-foreground">
                            {line.payDueDate ? String(line.payDueDate).slice(0, 10) : "No due date"}
                          </span>
                          {!line.voidedAt &&
                          String(line.documentType || "invoice") !== "credit_note" ? (
                            String(line.status).toLowerCase() === "paid" ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canSendReminder || sharePaidInvoiceMutation.isPending}
                                onClick={() =>
                                  sharePaidInvoiceMutation.mutate(line.id, {
                                    onSuccess: () => historyQuery.refetch(),
                                  })
                                }
                              >
                                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                Share paid
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={!canSendReminder || sendReminderMutation.isPending}
                                onClick={() =>
                                  sendReminderMutation.mutate(line.id, {
                                    onSuccess: () => historyQuery.refetch(),
                                  })
                                }
                              >
                                <MessageCircle className="mr-1 h-3.5 w-3.5" />
                                Remind
                              </Button>
                            )
                          ) : null}
                          {canPrint ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openDocument(
                                  line,
                                  String(line.documentType || "invoice") === "credit_note"
                                    ? "credit_note"
                                    : "invoice"
                                )
                              }
                              title="Print or save as PDF"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {String(line.documentType || "invoice") === "credit_note" &&
                          !line.voidedAt &&
                          (canPay || canUnpay) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setCreditNoteToVoid(line);
                                setVoidReason("");
                              }}
                            >
                              <Ban className="mr-1 h-3.5 w-3.5" />
                              Void
                            </Button>
                          ) : null}
                        </div>
                        {line.voidedAt ? (
                          <div className="w-full text-xs text-muted-foreground">
                            Voided {new Date(line.voidedAt).toLocaleString()}
                            {line.voidedBy ? ` by ${line.voidedBy}` : ""}
                            {line.voidReason ? ` · ${line.voidReason}` : ""}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderField("status", (editedInvoice as any).status)}
                {renderField("paidAt", (editedInvoice as any).paidAt)}
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2 text-sm">
                <div className="text-sm font-semibold">Amount / tax</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <div className="text-xs text-muted-foreground">Subtotal</div>
                    <div className="font-medium">
                      {Number((editedInvoice as any).subtotalAmount ?? editedInvoice.amount ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Tax ({(((editedInvoice as any).taxRate ?? 0) * 100).toFixed(1)}%)
                    </div>
                    <div className="font-medium">
                      {Number((editedInvoice as any).taxAmount ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Total</div>
                    <div className="font-semibold">
                      {Number((editedInvoice as any).totalAmount ?? editedInvoice.amount ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Collected</div>
                    <div className="font-medium">
                      {Number(editedInvoice.amountPaid ?? 0).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Remaining</div>
                    <div className="font-semibold">
                      {remainingDue.toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Document</div>
                    <div className="font-medium capitalize">
                      {(editedInvoice as any).documentType || "invoice"}
                      {(editedInvoice as any).parentInvoiceId
                        ? ` (parent #${(editedInvoice as any).parentInvoiceId})`
                        : ""}
                    </div>
                  </div>
                </div>
              </div>

              {String((editedInvoice as any).status || "").toLowerCase() === "paid" ||
              Number(editedInvoice.amountPaid ?? 0) > 0.009 ? (
                <div
                  className={`rounded-xl border p-4 space-y-2 ${
                    String((editedInvoice as any).paymentProvider || "").toLowerCase() === "wallet" ||
                    String((editedInvoice as any).paymentMethod || "").toLowerCase() === "wallet"
                      ? "border-emerald-500/30 bg-emerald-500/5"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="text-sm font-semibold">Payment details</div>
                  <div className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <div className="text-xs text-muted-foreground">Paid via</div>
                      <div className="font-medium">
                        {String((editedInvoice as any).paymentProvider || "").toLowerCase() === "wallet" ||
                        String((editedInvoice as any).paymentMethod || "").toLowerCase() === "wallet"
                          ? "Paid from own wallet"
                          : String((editedInvoice as any).paymentProvider || "").toLowerCase() === "whish"
                            ? "Whish"
                            : (editedInvoice as any).paymentMethod || "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Payment date</div>
                      <div className="font-medium">
                        {(editedInvoice as any).paidAt
                          ? new Date((editedInvoice as any).paidAt).toLocaleString()
                          : "—"}
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-muted-foreground">Transaction / reference #</div>
                      <div className="font-mono text-sm font-semibold break-all">
                        {(editedInvoice as any).paymentReference || "—"}
                      </div>
                    </div>
                    {(editedInvoice as any).collectedBy ? (
                      <div>
                        <div className="text-xs text-muted-foreground">Collected / paid by</div>
                        <div className="font-medium">{(editedInvoice as any).collectedBy}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="max-w-xs space-y-3">
                <div>
                  <Label htmlFor="external-invoice-payment-method" className="block mb-2">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={(v: any) => setPaymentMethod(v)}>
                    <SelectTrigger id="external-invoice-payment-method">
                      <SelectValue placeholder="Select payment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="pos">POS</SelectItem>
                      <SelectItem value="transfer">Transfer</SelectItem>
                      <SelectItem value="gateway">Whish / Gateway</SelectItem>
                      <SelectItem value="wallet">Own wallet</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="external-invoice-payment-amount" className="block mb-2">Amount to collect</Label>
                  <Input
                    id="external-invoice-payment-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    placeholder={remainingDue.toFixed(2)}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Remaining due {remainingDue.toFixed(2)}. Leave as remaining to settle in full.
                  </p>
                </div>
                {isPartialPay ? (
                  <label className="flex items-start gap-2 text-sm">
                    <Checkbox
                      checked={debitRemainder}
                      onCheckedChange={(v) => setDebitRemainder(v === true)}
                    />
                    <span>
                      Create a debit line for the unpaid remainder
                      <span className="block text-xs text-muted-foreground">
                        This invoice is marked paid for the collected amount. The leftover becomes a new unpaid line.
                      </span>
                    </span>
                  </label>
                ) : null}
                <div>
                  <Label htmlFor="external-invoice-payment-reference" className="block mb-2">Whish reference / transaction #</Label>
                  <Input
                    id="external-invoice-payment-reference"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    placeholder="Paste Whish txn / reference"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Paste a Whish ref to auto-match pending claims. Wallet pays auto-save as WALLET-&#123;id&#125;.
                  </p>
                  {matchLoading ? (
                    <p className="mt-1 text-xs text-muted-foreground">Matching…</p>
                  ) : null}
                  {matchedClaims.length > 0 ? (
                    <div className="mt-2 space-y-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-2">
                      <div className="text-xs font-medium">Matched Whish claims</div>
                      {matchedClaims.map((c) => (
                        <div
                          key={c.id}
                          className="flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <div className="font-mono text-xs">{c.whishReference}</div>
                            <div className="text-muted-foreground">
                              {c.amount} {c.currency} · @{c.username} · Invoice #{c.externalInvoiceId}
                              {Number(c.externalInvoiceId) !== Number(invoice.id) ? (
                                <span className="text-amber-600"> (other invoice)</span>
                              ) : null}
                            </div>
                          </div>
                          {canPay && c.status === "pending" ? (
                            <Button size="sm" onClick={() => confirmClaim(c.id)}>
                              Approve → credit wallet
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : paymentReference.trim().length >= 4 && !matchLoading ? (
                    <p className="mt-1 text-xs text-muted-foreground">No pending claim matches this reference.</p>
                  ) : null}
                </div>
              </div>
              {whishClaims.length > 0 ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                  <div className="text-sm font-medium">Pending Whish payment reports</div>
                  <p className="text-xs text-muted-foreground">
                    Approving credits the subscriber wallet. They then pay the invoice from balance
                    (renews if expired).
                  </p>
                  {claimsLoading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
                  {whishClaims.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <div>
                        <div className="font-mono text-xs">{c.whishReference}</div>
                        <div className="text-muted-foreground">
                          {c.amount} {c.currency} · @{c.username}
                        </div>
                      </div>
                      {canPay ? (
                        <Button size="sm" onClick={() => confirmClaim(c.id)}>
                          Approve → credit wallet
                        </Button>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                {!isCreditNote && !isVoided && editedInvoice.status !== "paid" ? (
                  <Button onClick={markPaidLocal}>
                    {isPartialPay ? "Record payment" : "Mark Paid"}
                  </Button>
                ) : null}
                {!isCreditNote &&
                !isVoided &&
                (editedInvoice.status === "paid" || Number(editedInvoice.amountPaid ?? 0) > 0.009) ? (
                  <Button variant="outline" onClick={markUnpaidLocal}>Mark Unpaid</Button>
                ) : null}
                {canPay &&
                !isCreditNote &&
                !isVoided &&
                String(editedInvoice.status).toLowerCase() !== "paid" ? (
                  <Button
                    variant="secondary"
                    disabled={gatewayBusy}
                    onClick={async () => {
                      setGatewayBusy(true);
                      try {
                        const { data } = await apiClient.post(
                          `/invoices/external/${editedInvoice.id}/payment-intent`,
                          {},
                          { timeout: 40_000 }
                        );
                        const url = data?.data?.checkoutUrl;
                        notify.success(
                          "Payment intent created",
                          url ? "Checkout link ready." : "Intent created."
                        );
                        if (url && typeof window !== "undefined") {
                          window.open(url, "_blank", "noopener,noreferrer");
                        }
                        refetch();
                      } catch (e: any) {
                        notify.error(
                          "Payment intent failed",
                          e?.response?.data?.message || e?.message || "Could not create intent"
                        );
                      } finally {
                        setGatewayBusy(false);
                      }
                    }}
                  >
                    {gatewayBusy ? "Creating…" : "Create payment link"}
                  </Button>
                ) : null}
                {canPay &&
                !isCreditNote &&
                !isVoided ? (
                  <Button
                    variant="outline"
                    disabled={creditNoteBusy}
                    onClick={() => setCreditNoteConfirmOpen(true)}
                  >
                    {creditNoteBusy ? "Creating…" : "Create credit note"}
                  </Button>
                ) : null}
              </div>
              <div className="rounded-md border p-3 space-y-2">
                <div className="text-xs text-muted-foreground">Collection workflow</div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => workflowMutation.mutate({ stage: "reminded" })}>Set Reminded</Button>
                  <Button size="sm" variant="outline" onClick={() => workflowMutation.mutate({ stage: "escalated" })}>Set Escalated</Button>
                  <Button size="sm" variant="outline" onClick={() => workflowMutation.mutate({ stage: "resolved" })}>Set Resolved</Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input type="date" value={promiseDateInput} onChange={(e) => setPromiseDateInput(e.target.value)} />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => workflowMutation.mutate({ stage: "promise_to_pay", promiseDate: promiseDateInput || null })}
                    disabled={!promiseDateInput}
                  >
                    Set Promise Date
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3">
              {historyQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading history...</div>
              ) : null}
              {!historyQuery.isLoading && timelineItems.length === 0 && (
                <div className="text-sm text-muted-foreground">No history available.</div>
              )}
              <div className="space-y-3">
                {timelineItems.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <div className="text-sm">
                      <span className="font-medium mr-2">{h.label}</span>
                      <span className="text-muted-foreground">{h.date ? new Date(h.date).toLocaleString() : "—"}</span>
                      {h.actor ? <span className="ml-2 text-xs text-muted-foreground">by {h.actor}</span> : null}
                      {h.detail ? <div className="text-xs text-muted-foreground mt-0.5 break-all">{h.detail}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </DialogContent>
      <Dialog
        open={Boolean(creditNoteToVoid)}
        onOpenChange={(open) => {
          if (voidCreditNoteMutation.isPending) return;
          if (!open) {
            setCreditNoteToVoid(null);
            setVoidReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void credit note #{creditNoteToVoid?.id}</DialogTitle>
            <DialogDescription>
              The credit note will remain visible for audit purposes but will no longer affect financial totals.
              This does not refund a wallet or payment transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="credit-note-void-reason">Reason</Label>
            <Input
              id="credit-note-void-reason"
              autoFocus
              maxLength={255}
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="For example: created for the wrong invoice"
            />
            <p className="text-xs text-muted-foreground">
              Required · {voidReason.trim().length}/255 characters
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={voidCreditNoteMutation.isPending}
              onClick={() => setCreditNoteToVoid(null)}
            >
              Keep credit note
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={voidReason.trim().length < 3 || voidCreditNoteMutation.isPending}
              onClick={() => voidCreditNoteMutation.mutate()}
            >
              {voidCreditNoteMutation.isPending ? "Voiding…" : "Void credit note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExternalInvoiceAddDebitDialog
        invoice={invoice}
        open={isAddDebitOpen}
        onOpenChange={setIsAddDebitOpen}
        onCreated={() => {
          paymentLinesQuery.refetch();
          refetch();
        }}
      />
      <SendWhatsAppDialog
        open={isWhatsAppOpen}
        onOpenChange={setIsWhatsAppOpen}
        recipientPhone={editedInvoice.phoneNumber || ""}
        recipientName={editedInvoice.fullName || editedInvoice.username || ""}
        invoiceNumber={String(editedInvoice.id)}
        invoiceAmount={editedInvoice.amount || 0}
        currency="USD"
        dueDate={editedInvoice.payDueDate || ""}
        defaultTemplate={editedInvoice.status === "paid" ? "payment_receipt" : "payment_reminder"}
      />
      <AlertDialog open={creditNoteConfirmOpen} onOpenChange={setCreditNoteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              Create a credit note for invoice #{editedInvoice.id}? This adds a linked credit_note document.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setCreditNoteConfirmOpen(false);
                setCreditNoteBusy(true);
                try {
                  const { data } = await apiClient.post(
                    `/invoices/external/${editedInvoice.id}/credit-note`
                  );
                  notify.success(
                    "Credit note created",
                    data?.data?.id ? `Document #${data.data.id}` : "Saved."
                  );
                  await Promise.all([
                    paymentLinesQuery.refetch(),
                    historyQuery.refetch(),
                    refetch(),
                  ]);
                } catch (e: any) {
                  notify.error(
                    "Credit note failed",
                    e?.response?.data?.message || e?.message || "Could not create credit note"
                  );
                } finally {
                  setCreditNoteBusy(false);
                }
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

export default ExternalInvoiceDetailView;
