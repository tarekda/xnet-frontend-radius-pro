import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const AccountStatusFilterDialog = ({
  open,
  onOpenChange,
  currentStatus,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStatus: string;
  onApply: (accountStatus: string) => void;
}) => {
  const [draft, setDraft] = useState<string>("");

  useEffect(() => {
    if (open) setDraft(currentStatus || "");
  }, [open, currentStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Account status</Label>
            <Select value={draft || "all"} onValueChange={(v) => setDraft(v === "all" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="inactive">Inactive (disabled)</SelectItem>
                <SelectItem value="terminated">Terminated</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Matches the user&apos;s account status from RADIUS. Inactive covers legacy &quot;disabled&quot; rows in
              your data.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onOpenChange(false);
            }}
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
