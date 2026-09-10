"use client";

import { FeatureGate } from "@/components/auth/FeatureGate";
import RevenueInsights from "@/screens/RevenueInsights";

export default function RevenueInsightsPage() {
  return (
    <FeatureGate feature="analytics">
      <RevenueInsights />
    </FeatureGate>
  );
}
