import React, { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import IconActionButton from "@/components/IconActionButton";
import { useAuth } from "@/context/AuthContext";
import { canAny } from "@/lib/permissions";
import { Download, RefreshCw, Trash2, UserCheck, UserX } from "lucide-react";
import type { User } from "@/types/api";

export const BulkActionsBar = ({
  selectedUsers,
  onBulkAction,
  onSelectAll,
  allUsers,
  profiles,
  isBulkActionInProgress = false,
}: {
  selectedUsers: Set<number>;
  onBulkAction: (action: string) => void;
  onSelectAll: (selected: boolean) => void;
  allUsers: User[];
  profiles: { id?: number; profileName: string }[];
  isBulkActionInProgress?: boolean;
}) => {
  const isAllSelected = selectedUsers.size === allUsers.length;
  const [profileId, setProfileId] = useState<string>("");
  const { user: authUser } = useAuth();
  const canManageUsers = useMemo(() => canAny(authUser, ["users.view", "reseller.users.manage"]), [authUser]);
  const manageUsersReason = "You don't have permission to manage users.";

  return (
    <div className="sticky top-2 z-10 overflow-hidden rounded-xl border border-border/80 bg-card p-3 shadow-[var(--shop-shadow)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={onSelectAll}
          />
          <div>
            <Label className="text-sm font-semibold text-foreground">
              {selectedUsers.size} of {allUsers.length} selected
            </Label>
            <p className="text-xs text-muted-foreground">Bulk actions apply to the current selection</p>
          </div>
        </div>

        {selectedUsers.size > 0 && (
          <div className="flex w-full flex-wrap gap-1.5 sm:w-auto sm:ml-4">
            <IconActionButton
              label={!canManageUsers ? manageUsersReason : "Suspend selected users"}
              onClick={() => onBulkAction("suspend")}
              disabled={!canManageUsers || isBulkActionInProgress}
              icon={<UserX className="h-4 w-4" />}
              className="border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            />
            <IconActionButton
              label={!canManageUsers ? manageUsersReason : "Activate selected users"}
              onClick={() => onBulkAction("activate")}
              disabled={!canManageUsers || isBulkActionInProgress}
              icon={<UserCheck className="h-4 w-4" />}
              className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            />
            <IconActionButton
              label="Export selected users"
              onClick={() => onBulkAction("export")}
              icon={<Download className="h-4 w-4" />}
              className="border-primary/20 bg-secondary text-secondary-foreground hover:bg-secondary/80"
            />
            <IconActionButton
              label={!canManageUsers ? manageUsersReason : "Reset MAC for selected users"}
              onClick={() => onBulkAction("reset-mac")}
              disabled={!canManageUsers || isBulkActionInProgress}
              icon={<RefreshCw className="h-4 w-4" />}
              className="border-border bg-card text-foreground hover:bg-muted"
            />

            <div className="flex items-center gap-1.5 ml-1">
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger className="h-8 w-full bg-card/95 text-xs sm:w-[160px] dark:bg-card/80">
                  <SelectValue placeholder="Assign profile..." />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={String(p.id)} value={String(p.id)}>
                      {p.profileName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <IconActionButton
                label={!canManageUsers ? manageUsersReason : !profileId ? "Select a profile first" : "Assign profile"}
                onClick={() => onBulkAction(`assign-profile:${profileId}`)}
                disabled={!profileId || !canManageUsers || isBulkActionInProgress}
                icon={<UserCheck className="h-4 w-4" />}
                className="border-border bg-card text-foreground hover:bg-muted"
              />
            </div>
            <IconActionButton
              label={!canManageUsers ? manageUsersReason : "Delete selected users"}
              onClick={() => onBulkAction("delete")}
              disabled={!canManageUsers || isBulkActionInProgress}
              icon={<Trash2 className="h-4 w-4" />}
              className="border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
            />
          </div>
        )}
      </div>
    </div>
  );
};
