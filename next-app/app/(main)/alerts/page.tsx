"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import AlertsComponent from "@/screens/alerts";

export default function AlertsRoutePage() {
  return (
    <FeatureGate feature="alerts">
      <AlertsComponent />
    </FeatureGate>
  );
}
