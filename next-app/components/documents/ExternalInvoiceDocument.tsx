import type { ExternalInvoice } from "@/types/api";

export type ExternalDocumentKind = "invoice" | "credit_note" | "receipt";

type Props = {
  invoice: ExternalInvoice;
  kind: ExternalDocumentKind;
};

const issuer = {
  name: process.env.NEXT_PUBLIC_INVOICE_ISSUER_NAME || "Xnet Billing",
  address: process.env.NEXT_PUBLIC_INVOICE_ISSUER_ADDRESS || "",
  phone: process.env.NEXT_PUBLIC_INVOICE_ISSUER_PHONE || "",
  email: process.env.NEXT_PUBLIC_INVOICE_ISSUER_EMAIL || "",
  taxId: process.env.NEXT_PUBLIC_INVOICE_ISSUER_TAX_ID || "",
  currency: process.env.NEXT_PUBLIC_PAYMENT_CURRENCY || "USD",
};

function formatMoney(value: number | null | undefined) {
  const amount = Number(value ?? 0);
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: issuer.currency,
      minimumFractionDigits: issuer.currency === "LBP" ? 0 : 2,
      maximumFractionDigits: issuer.currency === "LBP" ? 0 : 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch {
    return `${Number.isFinite(amount) ? amount.toFixed(2) : "0.00"} ${issuer.currency}`;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function documentTitle(kind: ExternalDocumentKind) {
  if (kind === "receipt") return "Payment Receipt";
  if (kind === "credit_note") return "Credit Note";
  return "Invoice";
}

function documentNumber(invoice: ExternalInvoice, kind: ExternalDocumentKind) {
  const prefix = kind === "receipt" ? "RCT" : kind === "credit_note" ? "CN" : "INV";
  return `${prefix}-${String(invoice.id).padStart(6, "0")}`;
}

export default function ExternalInvoiceDocument({ invoice, kind }: Props) {
  const subtotal = Number(invoice.subtotalAmount ?? invoice.totalAmount ?? invoice.amount ?? 0);
  const taxAmount = Number(invoice.taxAmount ?? 0);
  const total = Number(invoice.totalAmount ?? invoice.amount ?? 0);
  const taxRate = Number(invoice.taxRate ?? 0);
  const isVoided = Boolean(invoice.voidedAt);
  const isReceipt = kind === "receipt";
  const isCreditNote = kind === "credit_note";

  return (
    <article
      data-print-document
      className="relative mx-auto min-h-[297mm] w-full max-w-[210mm] overflow-hidden bg-white px-8 py-10 text-slate-900 shadow-xl print:min-h-0 print:max-w-none print:px-0 print:py-0 print:shadow-none"
    >
      {isVoided ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center overflow-hidden">
          <div className="-rotate-[35deg] border-8 border-red-500/20 px-12 py-4 text-7xl font-black uppercase tracking-[0.2em] text-red-500/20">
            Voided
          </div>
        </div>
      ) : null}

      <header className="flex items-start justify-between gap-8 border-b-2 border-slate-900 pb-6">
        <div>
          <div className="text-2xl font-black tracking-tight">{issuer.name}</div>
          <div className="mt-2 max-w-sm space-y-0.5 text-sm text-slate-600">
            {issuer.address ? <div>{issuer.address}</div> : null}
            {issuer.phone ? <div>{issuer.phone}</div> : null}
            {issuer.email ? <div>{issuer.email}</div> : null}
            {issuer.taxId ? <div>Tax ID: {issuer.taxId}</div> : null}
          </div>
        </div>
        <div className="text-right">
          <h1 className="text-3xl font-light uppercase tracking-wider">{documentTitle(kind)}</h1>
          <div className="mt-2 font-mono text-lg font-semibold">{documentNumber(invoice, kind)}</div>
          <div className="mt-2 text-sm text-slate-600">
            Issued {formatDate(String(invoice.createdAt))}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-8 py-7">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Bill to</div>
          <div className="mt-2 text-lg font-semibold">{invoice.fullName || invoice.username}</div>
          <div className="mt-1 space-y-0.5 text-sm text-slate-600">
            <div>Account: {invoice.username}</div>
            {invoice.address ? <div>{invoice.address}</div> : null}
            {invoice.phoneNumber ? <div>{invoice.phoneNumber}</div> : null}
            {invoice.email ? <div>{invoice.email}</div> : null}
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 text-sm">
          <dt className="text-slate-500">Billing month</dt>
          <dd className="text-right font-medium">{formatDate(invoice.billingMonth)}</dd>
          <dt className="text-slate-500">Payment due</dt>
          <dd className="text-right font-medium">{formatDate(invoice.payDueDate)}</dd>
          <dt className="text-slate-500">Provider</dt>
          <dd className="text-right font-medium uppercase">{invoice.provider || "—"}</dd>
          <dt className="text-slate-500">Status</dt>
          <dd className="text-right font-semibold uppercase">
            {isVoided ? "VOIDED" : invoice.status}
          </dd>
          {isCreditNote && invoice.parentInvoiceId ? (
            <>
              <dt className="text-slate-500">Original invoice</dt>
              <dd className="text-right font-mono font-medium">INV-{String(invoice.parentInvoiceId).padStart(6, "0")}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-y-2 border-slate-900 text-left text-xs uppercase tracking-wider">
            <th className="py-3 pr-4">Description</th>
            <th className="w-20 py-3 text-center">Qty</th>
            <th className="w-36 py-3 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-5 pr-4">
              <div className="font-medium">
                {isReceipt
                  ? `Payment for invoice INV-${String(invoice.id).padStart(6, "0")}`
                  : isCreditNote
                    ? `Credit against invoice INV-${String(invoice.parentInvoiceId ?? invoice.id).padStart(6, "0")}`
                    : invoice.debitLabel || `Internet service · ${formatDate(invoice.billingMonth)}`}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Customer account {invoice.username}
              </div>
            </td>
            <td className="py-5 text-center">1</td>
            <td className="py-5 text-right font-medium">{formatMoney(total)}</td>
          </tr>
        </tbody>
      </table>

      <section className="ml-auto mt-6 w-full max-w-sm text-sm">
        {taxRate > 0 ? (
          <>
            <div className="flex justify-between border-b border-slate-200 py-2">
              <span className="text-slate-600">Subtotal</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <div className="flex justify-between border-b border-slate-200 py-2">
              <span className="text-slate-600">Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span>{formatMoney(taxAmount)}</span>
            </div>
          </>
        ) : null}
        <div className="flex justify-between border-b-2 border-slate-900 py-3 text-lg font-bold">
          <span>{isReceipt ? "Amount paid" : "Total"}</span>
          <span>{formatMoney(total)}</span>
        </div>
      </section>

      {isReceipt ? (
        <section className="mt-8 rounded-lg border border-slate-300 bg-slate-50 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wider">Payment details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div>
              <dt className="text-slate-500">Paid on</dt>
              <dd className="font-medium">{formatDateTime(invoice.paidAt)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Method</dt>
              <dd className="font-medium capitalize">{invoice.paymentMethod || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Provider</dt>
              <dd className="font-medium capitalize">{invoice.paymentProvider || "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Reference</dt>
              <dd className="break-all font-mono font-medium">{invoice.paymentReference || "—"}</dd>
            </div>
            {invoice.collectedBy ? (
              <div>
                <dt className="text-slate-500">Collected by</dt>
                <dd className="font-medium">{invoice.collectedBy}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {isVoided ? (
        <section className="mt-8 border-2 border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-bold">This credit note is void and has no financial effect.</div>
          <div className="mt-1">
            Voided {formatDateTime(invoice.voidedAt)}
            {invoice.voidedBy ? ` by ${invoice.voidedBy}` : ""}
          </div>
          {invoice.voidReason ? <div className="mt-1">Reason: {invoice.voidReason}</div> : null}
        </section>
      ) : null}

      <footer className="mt-16 flex items-end justify-between border-t border-slate-300 pt-5 text-xs text-slate-500">
        <div>
          <div>Generated {formatDateTime(new Date().toISOString())}</div>
          <div className="mt-1">Document ID: {invoice.id}</div>
        </div>
        <div className="text-right">
          <div className="font-medium text-slate-700">Thank you</div>
          <div>This document was generated electronically.</div>
        </div>
      </footer>

      <style jsx global>{`
        @page {
          size: A4;
          margin: 14mm;
        }
        @media print {
          body {
            background: white !important;
          }
          body * {
            visibility: hidden !important;
          }
          [data-print-document],
          [data-print-document] * {
            visibility: visible !important;
          }
          [data-print-document] {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
          }
          [data-print-controls] {
            display: none !important;
          }
        }
      `}</style>
    </article>
  );
}
