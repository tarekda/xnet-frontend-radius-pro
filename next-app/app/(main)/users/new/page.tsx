"use client";

import { PermissionGate } from "@/components/auth/PermissionGate";
import AddUserComponent from "@/screens/AddUser";

export default function AddUserRoutePage() {
  return (
    <PermissionGate anyOf={["users.manage", "reseller.users.manage"]}>
      <AddUserComponent />
    </PermissionGate>
  );
}
