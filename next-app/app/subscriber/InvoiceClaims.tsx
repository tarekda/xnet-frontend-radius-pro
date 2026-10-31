"use client";

import { Badge } from "@/components/ui/badge";
import { useSubscriberInvoiceClaims } from "@/hooks/useSubscriberPortal";
import { formatDate, formatMoney } from "@/lib/format";
import { useTranslation } from "react-i18next";

function claimVariant(status: string): "outline" | "success" | "destructive" | "secondary" {
  const s = status.toLowerCase();
  if (s === "confirmed") return "success";
  if (s === "rejected") return "destructive";
  if (s === "pending") return "outline";
  return "secondary";
}

export function InvoiceClaims({ invoiceId, currency }: { invoiceId: number; currency: string }) {
  const { t } = useTranslation("screens");
  const { data: claims, isLoading } = useSubscriberInvoiceClaims(invoiceId, true);
  if (isLoading || !claims?.length) return null;

  return (
    <div className="mt-2 space-y-1 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("subscriber.claims")}
      </p>
      {claims.map((claim) => (
        <div key={claim.id} className="flex flex-wrap items-center gap-2 text-xs">
          <Badge variant={claimVariant(claim.status)} className="font-normal">
            {t(`subscriber.claim_${claim.status}` as "subscriber.claim_pending")}
          </Badge>
          <span className="font-mono">{claim.whishReference}</span>
          {claim.amount != null ? <span>{formatMoney(claim.amount, claim.currency || currency)}</span> : null}
          <span className="text-muted-foreground">{formatDate(claim.createdAt)}</span>
        </div>
      ))}
    </div>
  );
}
