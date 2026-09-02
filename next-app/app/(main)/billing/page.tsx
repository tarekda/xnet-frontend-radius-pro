"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import BillingOverview from "@/screens/BillingOverview";

export default function BillingRoutePage() {
  return (
    <FeatureGate feature="external-invoices">
      <BillingOverview />
    </FeatureGate>
  );
}
