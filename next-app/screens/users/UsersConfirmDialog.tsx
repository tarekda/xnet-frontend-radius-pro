import React from "react";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";
import { notify } from "@/lib/notify";
import {
  bulkAssignProfile,
  bulkDeleteUsers,
  bulkResetMac,
  bulkSetStatus,
  resetDailyQuota,
  resetMonthlyQuota,
} from "@/api/users";
import type { ConfirmActionState } from "./usersPageReducer";

function confirmTitle(confirmAction: ConfirmActionState): string {
  if (!confirmAction) return "Confirm action";
  switch (confirmAction.kind) {
    case "delete-user":
      return "Delete user?";
    case "reset-mac":
      return "Reset MAC address?";
    case "reset-quota":
      return "Reset quota?";
    case "reset-monthly-quota":
      return "Reset monthly traffic?";
    case "bulk": {
      const n = confirmAction.usernames.length;
      switch (confirmAction.action) {
        case "delete":
          return `Delete ${n} users?`;
        case "suspend":
          return `Suspend ${n} users?`;
        case "activate":
          return `Activate ${n} users?`;
        case "reset-mac":
          return `Reset MAC for ${n} users?`;
        default:
          return `Assign profile to ${n} users?`;
      }
    }
  }
}

function confirmDescription(confirmAction: ConfirmActionState): string | undefined {
  if (!confirmAction) return undefined;
  switch (confirmAction.kind) {
    case "delete-user":
      return `This will permanently delete ${confirmAction.username}.`;
    case "reset-mac":
      return `This will clear the stored MAC binding for ${confirmAction.username}.`;
    case "reset-quota":
      return `This will reset the daily quota counters for ${confirmAction.username}.`;
    case "reset-monthly-quota":
      return `This will reset the monthly traffic counters for ${confirmAction.username}.`;
    case "bulk": {
      const profileLine =
        confirmAction.action === "assign-profile"
          ? `Profile: ${confirmAction.profileName ?? confirmAction.profileId}\n`
          : "";
      const preview = confirmAction.usernames.slice(0, 10).join(", ");
      const ellipsis = confirmAction.usernames.length > 10 ? "…" : "";
      return `${profileLine}Users affected: ${preview}${ellipsis}`;
    }
  }
}

function isDestructive(confirmAction: ConfirmActionState): boolean {
  return (
    confirmAction?.kind === "delete-user" ||
    (confirmAction?.kind === "bulk" && confirmAction.action === "delete")
  );
}

export const UsersConfirmDialog = ({
  confirmAction,
  onClose,
  onBusyChange,
  deleteUser,
  resetMacAddress,
  refetch,
  clearSelection,
}: {
  confirmAction: ConfirmActionState;
  onClose: () => void;
  onBusyChange: (busy: boolean) => void;
  deleteUser: (username: string) => Promise<unknown>;
  resetMacAddress: (username: string) => Promise<unknown>;
  refetch: () => Promise<unknown>;
  clearSelection: () => void;
}) => {
  const handleConfirm = async () => {
    if (!confirmAction) return;
    onBusyChange(true);
    try {
      if (confirmAction.kind === "delete-user") {
        await deleteUser(confirmAction.username);
        await refetch();
        return;
      }
      if (confirmAction.kind === "reset-mac") {
        await resetMacAddress(confirmAction.username);
        await refetch();
        return;
      }
      if (confirmAction.kind === "reset-quota") {
        await resetDailyQuota(confirmAction.username);
        await refetch();
        notify.success("Quota reset", `Daily quota reset for ${confirmAction.username}.`);
        return;
      }
      if (confirmAction.kind === "reset-monthly-quota") {
        await resetMonthlyQuota(confirmAction.username);
        await refetch();
        notify.success("Quota reset", `Monthly traffic reset for ${confirmAction.username}.`);
        return;
      }
      if (confirmAction.kind === "bulk") {
        const usernames = confirmAction.usernames;
        if (!usernames.length) return;

        try {
          if (confirmAction.action === "suspend" || confirmAction.action === "activate") {
            const accountStatus = confirmAction.action === "suspend" ? "suspended" : "active";
            const updated = await bulkSetStatus(usernames, accountStatus);
            await refetch();
            clearSelection();
            notify.success("Bulk action", `${updated} users set to ${accountStatus}.`);
            return;
          }

          if (confirmAction.action === "reset-mac") {
            const deleted = await bulkResetMac(usernames);
            await refetch();
            clearSelection();
            notify.success("Bulk action", `MAC reset for ${deleted} users.`);
            return;
          }

          if (confirmAction.action === "assign-profile") {
            const profileId = confirmAction.profileId;
            if (!profileId) {
              notify.error("Bulk action failed", "Missing profileId.");
              return;
            }
            const updated = await bulkAssignProfile(usernames, profileId);
            await refetch();
            clearSelection();
            notify.success(
              "Bulk action",
              `${updated} users assigned profile ${confirmAction.profileName ?? profileId}.`
            );
            return;
          }

          if (confirmAction.action === "delete") {
            const deleted = await bulkDeleteUsers(usernames);
            await refetch();
            clearSelection();
            notify.success("Bulk action", `${deleted} users deleted.`);
            return;
          }
        } catch (e: any) {
          notify.error("Bulk action failed", e?.response?.data?.message || e?.message || "Request failed");
        }
      }
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <ActionConfirmDialog
      open={Boolean(confirmAction)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={confirmTitle(confirmAction)}
      description={confirmDescription(confirmAction)}
      confirmText={isDestructive(confirmAction) ? "Delete" : "Confirm"}
      confirmTone={isDestructive(confirmAction) ? "destructive" : "default"}
      onConfirm={handleConfirm}
    />
  );
};
