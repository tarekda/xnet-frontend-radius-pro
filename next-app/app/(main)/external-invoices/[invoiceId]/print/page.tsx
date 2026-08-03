"use client";

import { useEffect, useMemo, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { fetchExternalInvoiceById } from "@/api/invoices";
import ExternalInvoiceDocument, {
  type ExternalDocumentKind,
} from "@/components/documents/ExternalInvoiceDocument";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { can, canAny } from "@/lib/permissions";

export default function ExternalInvoicePrintPage() {
  const params = useParams<{ invoiceId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const hasPrinted = useRef(false);
  const invoiceId = Number(params.invoiceId);
  const canOpen = canAny(user, [
    "billing.externalInvoices.view",
    "billing.externalInvoices.viewTotals",
    "billing.externalInvoices.pay",
    "billing.externalInvoices.unpay",
  ]);
  const canSeeAmounts = can(user, "billing.externalInvoices.viewTotals");

  const query = useQuery({
    queryKey: ["external-invoice-document", invoiceId],
    queryFn: () => fetchExternalInvoiceById(invoiceId),
    enabled: Number.isInteger(invoiceId) && invoiceId > 0 && canOpen && canSeeAmounts,
  });

  const kind = useMemo<ExternalDocumentKind>(() => {
    const requested = searchParams.get("kind");
    if (requested === "receipt") return "receipt";
    if (requested === "credit_note") return "credit_note";
    return "invoice";
  }, [searchParams]);

  const validationError = useMemo(() => {
    if (!query.data) return null;
    if (kind === "receipt" && query.data.status !== "paid") {
      return "A payment receipt is available only after the invoice is paid.";
    }
    if (kind === "credit_note" && query.data.documentType !== "credit_note") {
      return "This record is not a credit note.";
    }
    if (kind === "invoice" && query.data.documentType === "credit_note") {
      return "Credit notes must be printed as credit-note documents.";
    }
    return null;
  }, [kind, query.data]);

  useEffect(() => {
    if (
      searchParams.get("auto") === "1" &&
      query.data &&
      !validationError &&
      !hasPrinted.current
    ) {
      hasPrinted.current = true;
      const timer = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [query.data, searchParams, validationError]);

  const close = () => {
    if (window.opener) {
      window.close();
      return;
    }
    router.back();
  };

  if (!canOpen || !canSeeAmounts) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            You need invoice totals permission to create financial documents.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">Invalid invoice ID.</CardContent>
        </Card>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Preparing document…
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            The invoice document could not be loaded.
          </CardContent>
        </Card>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-sm text-destructive">{validationError}</p>
            <Button variant="outline" onClick={close}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:bg-white print:p-0">
      <div
        data-print-controls
        className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm"
      >
        <Button variant="outline" onClick={close}>
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="text-center text-sm text-muted-foreground">
          Choose “Save as PDF” in the print dialog to download a PDF.
        </div>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>
      <ExternalInvoiceDocument invoice={query.data} kind={kind} />
    </div>
  );
}
