"use client";

import { PermissionGate } from "@/components/auth/PermissionGate";
import UsersComponent from "@/screens/users";

export default function UsersListRoutePage() {
  return (
    <PermissionGate anyOf={["users.view", "reseller.users.view"]}>
      <UsersComponent />
    </PermissionGate>
  );
}
