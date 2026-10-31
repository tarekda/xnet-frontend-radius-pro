"use client";

import { PermissionGate } from "@/components/auth/PermissionGate";
import RadiusPacketAuditPage from "@/screens/RadiusPacketAudit";

export default function RadiusPacketAuditRoutePage() {
  return (
    <PermissionGate anyOf={["users.online.view", "reseller.users.view"]}>
      <RadiusPacketAuditPage />
    </PermissionGate>
  );
}
