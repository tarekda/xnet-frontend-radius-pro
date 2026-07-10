import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const PromiseToPayDialog = ({
  open,
  onOpenChange,
  selectedCount,
  promiseDate,
  onPromiseDateChange,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  promiseDate: string;
  onPromiseDateChange: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Promise to pay</DialogTitle>
        <DialogDescription>
          Set a follow-up date for {selectedCount} selected invoice{selectedCount > 1 ? "s" : ""}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 py-2">
        <Label htmlFor="promise-date">Expected payment date</Label>
        <Input
          id="promise-date"
          type="date"
          value={promiseDate}
          onChange={(e) => onPromiseDateChange(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onSave} disabled={!promiseDate || isSaving}>
          {isSaving ? "Saving…" : "Save date"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const BulkPayDueDialog = ({
  open,
  onOpenChange,
  selectedCount,
  payDueDate,
  onPayDueDateChange,
  isSaving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  payDueDate: string;
  onPayDueDateChange: (value: string) => void;
  isSaving: boolean;
  onSave: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Set pay due date</DialogTitle>
        <DialogDescription>
          Apply a collection due date to {selectedCount} selected invoice{selectedCount > 1 ? "s" : ""}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-2 py-2">
        <Label htmlFor="bulk-pay-due-date">Pay due date</Label>
        <Input
          id="bulk-pay-due-date"
          type="date"
          value={payDueDate}
          onChange={(e) => onPayDueDateChange(e.target.value)}
        />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onSave} disabled={!payDueDate || isSaving}>
          {isSaving ? "Saving…" : "Save pay due date"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const ConfirmBulkPaidDialog = ({
  open,
  onOpenChange,
  selectedCount,
  disabled,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  disabled: boolean;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Mark selected invoices as paid?</DialogTitle>
      </DialogHeader>
      <div className="text-sm text-muted-foreground">
        This will mark {selectedCount} invoice{selectedCount > 1 ? "s" : ""} as paid. You can’t undo this action.
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button onClick={onConfirm} disabled={disabled} className="bg-green-600 hover:bg-green-700 text-white">
          Confirm
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export const ConfirmBulkDeleteDialog = ({
  open,
  onOpenChange,
  selectedIds,
  disabled,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: number[];
  disabled: boolean;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete selected invoices?</DialogTitle>
      </DialogHeader>
      <div className="text-sm text-muted-foreground space-y-2">
        <div>
          This will permanently delete <b>{selectedIds.length}</b> invoice{selectedIds.length > 1 ? "s" : ""}. This action cannot be undone.
        </div>
        <div className="text-xs">
          Example IDs: {selectedIds.slice(0, 6).map((id) => `#${id}`).join(", ")}{selectedIds.length > 6 ? "…" : ""}
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button variant="destructive" onClick={onConfirm} disabled={disabled}>
          Delete
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
