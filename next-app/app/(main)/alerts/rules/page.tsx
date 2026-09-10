"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import AlertRules from "@/screens/AlertRules";

export default function AlertRulesRoutePage() {
  return (
    <FeatureGate feature="alerts">
      <AlertRules />
    </FeatureGate>
  );
}
