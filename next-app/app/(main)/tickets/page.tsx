"use client";

import { PermissionGate } from "@/components/auth/PermissionGate";
import TicketsComponent from "@/screens/Tickets";

export default function TicketsRoutePage() {
  return (
    <PermissionGate anyOf={["support.tickets.view"]}>
      <TicketsComponent />
    </PermissionGate>
  );
}
