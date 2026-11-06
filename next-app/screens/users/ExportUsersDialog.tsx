import React, { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { notify } from "@/lib/notify";
import { MESSAGES } from "@/constants/messages";
import { fetchAllUsers } from "@/api/users";
import type { User } from "@/types/api";
import { canonicalAccountStatus } from "@/screens/users/lib";

type ExportStatus = "all" | "active" | "suspended" | "terminated" | "expired";

export const ExportUsersDialog = ({
  open,
  onOpenChange,
  filteredUsers,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The current filtered view, used when not exporting all pages. */
  filteredUsers: User[];
}) => {
  const [exportAllUsers, setExportAllUsers] = useState(false);
  const [exportStatus, setExportStatus] = useState<ExportStatus>("all");
  const [isExporting, setIsExporting] = useState(false);

  const executeExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const sourceUsers = exportAllUsers ? await fetchAllUsers() : filteredUsers;
      const exportableUsers = sourceUsers.filter((u) => {
        if (exportStatus === "all") return true;
        return canonicalAccountStatus(u.accountStatus) === exportStatus;
      });

      if (!exportableUsers.length) {
        notify.error(MESSAGES.users.exportEmptyTitle, MESSAGES.users.exportEmptyDescription);
        return;
      }

      const xlsx = await import("xlsx");
      const cols = [
        "username",
        "fullName",
        "phoneNumber",
        "email",
        "profile",
        "accountStatus",
        "isOnline",
        "macAddress",
        "lastTimeActive",
      ] as const;
      const aoa = [
        [...cols],
        ...exportableUsers.map((u) => [
          u.username ?? "",
          u.userDetails?.fullName ?? "",
          u.userDetails?.phoneNumber ?? "",
          u.userDetails?.email ?? "",
          u.profile?.profileName ?? "",
          u.accountStatus ?? "",
          u.isOnline ? "true" : "false",
          u.macAddress?.macAddress ?? "",
          u.lastTimeActive ?? "",
        ]),
      ];

      const ws = xlsx.utils.aoa_to_sheet(aoa);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, "Users");

      const date = new Date().toISOString().split("T")[0];
      const scopeSuffix = exportAllUsers ? "_all" : "_current";
      const statusSuffix = exportStatus === "all" ? "_status-all" : `_status-${exportStatus}`;
      const filename = `users${scopeSuffix}${statusSuffix}_${date}.xlsx`;
      xlsx.writeFile(wb, filename);

      notify.success(MESSAGES.users.exportSuccessTitle, `${exportableUsers.length} users exported to ${filename}`);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      notify.error("Export failed", "Could not generate Excel file.");
    } finally {
      setIsExporting(false);
    }
  }, [exportAllUsers, exportStatus, filteredUsers, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(next) => (isExporting ? null : onOpenChange(next))}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Export Users</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Checkbox
              id="export-all-users"
              checked={exportAllUsers}
              onCheckedChange={(checked) => setExportAllUsers(Boolean(checked))}
            />
            <Label htmlFor="export-all-users">Export all users (all pages)</Label>
          </div>
          <div className="space-y-2">
            <Label>Status filter</Label>
            <Select value={exportStatus} onValueChange={(v: ExportStatus) => setExportStatus(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="suspended">Suspended only</SelectItem>
                <SelectItem value="terminated">Terminated only</SelectItem>
                <SelectItem value="expired">Expired only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">
            Scope: {exportAllUsers ? "All users from server" : "Current filtered view"}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isExporting}>
            Cancel
          </Button>
          <Button onClick={() => void executeExport()} disabled={isExporting}>
            {isExporting ? "Exporting..." : "Export"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
