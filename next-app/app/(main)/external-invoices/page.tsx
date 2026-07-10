"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import ExternalInvoicesComponent from "@/screens/external-invoices";

export default function ExternalInvoicesRoutePage() {
  return (
    <FeatureGate feature="external-invoices">
      <ExternalInvoicesComponent />
    </FeatureGate>
  );
}
