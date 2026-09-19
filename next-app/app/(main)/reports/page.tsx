"use client";

import { PermissionGate } from "@/components/auth/PermissionGate";
import ReportsComponent from "@/screens/Reports";

export default function ReportsRoutePage() {
  return (
    <PermissionGate anyOf={["admin.reports.view"]}>
      <ReportsComponent />
    </PermissionGate>
  );
}
