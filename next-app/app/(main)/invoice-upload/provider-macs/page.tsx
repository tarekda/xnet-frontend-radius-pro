"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import ProviderMacListPage from "@/screens/ProviderMacList";

export default function ProviderMacListRoute() {
  return (
    <FeatureGate feature="invoice-upload">
      <ProviderMacListPage />
    </FeatureGate>
  );
}
