import type { ExternalInvoice } from "@/types/api";

/**
 * Groups external invoice rows that belong to the same customer
 * (same username + full name + provider) into one display record with
 * nested payment lines, so previous unpaid months show as "due" lines
 * and extra charges (carryover, second-payment, …) show as "debit" lines.
 */

export type PaymentLineKind = "current" | "due" | "debit" | "paid";

export type InvoicePaymentLine = {
  invoice: ExternalInvoice;
  kind: PaymentLineKind;
};

export type ExternalInvoiceGroup = {
  /** Row shown in the table — current-month primary line when available, else most recent line. */
  primary: ExternalInvoice;
  /** All lines for this customer, most recent billing month first. */
  lines: InvoicePaymentLine[];
  /** Sum of unpaid + pending line amounts. */
  outstandingTotal: number;
  /** Count of unpaid previous-month lines ("due") plus unpaid debit lines. */
  openLineCount: number;
  /** Most recent pay due date across lines (unpaid lines win over paid ones). */
  inheritedPayDueDate: string | null;
  /** Unpaid current-month line the Pay button should settle, if any. */
  currentMonthPayable: ExternalInvoice | null;
};

function normKey(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function invoiceGroupKey(inv: ExternalInvoice): string {
  return `${normKey(inv.username)}|${normKey(inv.fullName)}|${normKey(inv.provider)}`;
}

export function monthKey(value: string | null | undefined): string {
  const s = String(value ?? "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(s) ? s : "";
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function isOpen(inv: ExternalInvoice): boolean {
  return !inv.voidedAt && inv.status !== "paid";
}

export function classifyLine(inv: ExternalInvoice, nowMonth: string): PaymentLineKind {
  if (!isOpen(inv)) return "paid";
  if (String(inv.debitLabel ?? "").trim()) return "debit";
  const m = monthKey(inv.billingMonth);
  if (m && m < nowMonth) return "due";
  return "current";
}

function lineSortValue(inv: ExternalInvoice): string {
  return `${monthKey(inv.billingMonth)}|${String(inv.debitLabel ?? "")}`;
}

function latestDate(a: string | null, b: string | null | undefined): string | null {
  const bv = b && String(b).trim() ? String(b).slice(0, 10) : null;
  if (!a) return bv;
  if (!bv) return a;
  return a >= bv ? a : bv;
}

export function groupExternalInvoices(
  invoices: ExternalInvoice[],
  now: Date = new Date()
): ExternalInvoiceGroup[] {
  const nowMonth = currentMonthKey(now);
  const buckets = new Map<string, ExternalInvoice[]>();
  const order: string[] = [];

  for (const inv of invoices) {
    const key = invoiceGroupKey(inv);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(inv);
    } else {
      buckets.set(key, [inv]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const rows = [...(buckets.get(key) as ExternalInvoice[])].sort((a, b) =>
      lineSortValue(b).localeCompare(lineSortValue(a))
    );

    const lines: InvoicePaymentLine[] = rows.map((inv) => ({
      invoice: inv,
      kind: classifyLine(inv, nowMonth),
    }));

    const openLines = rows.filter(isOpen);
    const outstandingTotal = openLines.reduce((acc, inv) => acc + Number(inv.amount ?? 0), 0);

    // Primary row: unpaid primary line of the current month, else newest line.
    const primary =
      rows.find(
        (inv) => monthKey(inv.billingMonth) === nowMonth && !String(inv.debitLabel ?? "").trim()
      ) ?? rows[0]!;

    // Pay button target: unpaid current-month line (primary line preferred over debit lines).
    const currentMonthOpen = openLines
      .filter((inv) => monthKey(inv.billingMonth) === nowMonth)
      .sort((a, b) =>
        String(a.debitLabel ?? "").trim().length - String(b.debitLabel ?? "").trim().length
      );
    const currentMonthPayable = currentMonthOpen[0] ?? null;

    // Pay due date: latest among unpaid lines; fall back to latest overall.
    let inheritedPayDueDate: string | null = null;
    for (const inv of openLines) inheritedPayDueDate = latestDate(inheritedPayDueDate, inv.payDueDate);
    if (!inheritedPayDueDate) {
      for (const inv of rows) inheritedPayDueDate = latestDate(inheritedPayDueDate, inv.payDueDate);
    }

    return {
      primary,
      lines,
      outstandingTotal,
      openLineCount: lines.filter((l) => l.kind === "due" || l.kind === "debit").length,
      inheritedPayDueDate,
      currentMonthPayable,
    };
  });
}
