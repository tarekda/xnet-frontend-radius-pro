"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import AgingReport from "@/screens/AgingReport";

export default function AgingReportRoutePage() {
  return (
    <FeatureGate feature="external-invoices">
      <AgingReport />
    </FeatureGate>
  );
}
