"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { CalendarClock, ChevronRight } from "lucide-react";
import { fetchExternalInvoicesPaymentDue } from "@/api/invoices";
import type { ExternalInvoice } from "@/types/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

function localYmd(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function bucketFor(inv: ExternalInvoice): "overdue" | "this_week" | "later" {
  const ymd = inv.payDueDate ? String(inv.payDueDate).slice(0, 10) : "";
  if (!ymd) return "later";
  const todayKey = localYmd();
  const limit = new Date();
  limit.setDate(limit.getDate() + 7);
  const limitKey = localYmd(limit);
  if (ymd < todayKey) return "overdue";
  if (ymd <= limitKey) return "this_week";
  return "later";
}

function InvoiceRow({ inv }: { inv: ExternalInvoice }) {
  const ymd = inv.payDueDate ? String(inv.payDueDate).slice(0, 10) : "";
  const b = bucketFor(inv);
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 py-3 text-sm last:border-0">
      <div className="min-w-[140px] font-mono text-xs text-muted-foreground">#{inv.id}</div>
      <div className="min-w-[160px] flex-1 font-medium">{inv.fullName}</div>
      <div className="text-muted-foreground">{inv.username}</div>
      <div className="font-semibold">${Number(inv.amount).toFixed(2)}</div>
      <Badge variant="outline" className={cn(b === "overdue" && "border-destructive/60 text-destructive")}>
        {ymd}
      </Badge>
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/external-invoices?q=${encodeURIComponent(String(inv.id))}`}>
          Open <ChevronRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function Section({
  title,
  description,
  tone,
  rows,
}: {
  title: string;
  description: string;
  tone: "danger" | "amber" | "muted";
  rows: ExternalInvoice[];
}) {
  if (!rows.length) return null;
  const border =
    tone === "danger"
      ? "border-l-4 border-l-destructive"
      : tone === "amber"
        ? "border-l-4 border-l-amber-500"
        : "border-l-4 border-l-muted-foreground/40";
  return (
    <Card className={cn("overflow-hidden", border)}>
      <div className="border-b bg-muted/30 px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="px-4">
        {rows.map((inv) => (
          <InvoiceRow key={inv.id} inv={inv} />
        ))}
      </div>
    </Card>
  );
}

export default function ExternalInvoicesPaymentDuePage() {
  const { t } = useTranslation("screens");
  const { data, isLoading, error } = useQuery({
    queryKey: ["externalInvoicesPaymentDue"],
    queryFn: fetchExternalInvoicesPaymentDue,
    staleTime: 60_000,
  });

  const grouped = useMemo(() => {
    const overdue: ExternalInvoice[] = [];
    const thisWeek: ExternalInvoice[] = [];
    const later: ExternalInvoice[] = [];
    for (const inv of data ?? []) {
      const b = bucketFor(inv);
      if (b === "overdue") overdue.push(inv);
      else if (b === "this_week") thisWeek.push(inv);
      else later.push(inv);
    }
    return { overdue, thisWeek, later };
  }, [data]);

  return (
    <div className="w-full space-y-6 py-2">
      <PageHeader
        title={t("paymentDue.title")}
        subtitle={t("paymentDue.subtitle")}
        icon={CalendarClock}
        actions={
          <Button variant="outline" asChild>
            <Link href="/notifications">Notifications</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/external-invoices">All external invoices</Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : error ? (
        <Card className="p-6 text-sm text-destructive">Could not load payment due list.</Card>
      ) : !data?.length ? (
        <Card className="p-8 text-center text-muted-foreground">
          No unpaid or pending invoices with a pay due date. Edit an invoice and set <strong>Pay due date</strong>, or include{" "}
          <strong>payDueDate</strong> / <strong>paydate</strong> on your import sheet.
        </Card>
      ) : (
        <div className="space-y-6">
          <Section title="Overdue" description="Pay due date is before today." tone="danger" rows={grouped.overdue} />
          <Section
            title="Due in the next 7 days"
            description="From today through the following week (local calendar)."
            tone="amber"
            rows={grouped.thisWeek}
          />
          <Section
            title="Upcoming"
            description="Due later than one week from today."
            tone="muted"
            rows={grouped.later}
          />
        </div>
      )}
    </div>
  );
}
