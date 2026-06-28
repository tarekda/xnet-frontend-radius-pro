import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExternalInvoiceDebit } from "@/api/invoices";
import type { ExternalInvoice } from "@/types/api";
import { notify } from "@/lib/notify";

type Props = {
  invoice: ExternalInvoice;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
};

const ExternalInvoiceAddDebitDialog: React.FC<Props> = ({
  invoice,
  open,
  onOpenChange,
  onCreated,
}) => {
  const [debitLabel, setDebitLabel] = useState("carryover");
  const [amount, setAmount] = useState("");
  const [payDueDate, setPayDueDate] = useState(
    invoice.payDueDate ? String(invoice.payDueDate).slice(0, 10) : ""
  );

  const mutation = useMutation({
    mutationFn: () =>
      createExternalInvoiceDebit({
        sourceInvoiceId: invoice.id,
        debitLabel: debitLabel.trim(),
        amount: parseFloat(amount),
        payDueDate: payDueDate || null,
      }),
    onSuccess: () => {
      notify.success("Payment line added", "Another pending charge was created for this customer.");
      onCreated();
      onOpenChange(false);
      setAmount("");
    },
    onError: (e: unknown) => {
      notify.error("Could not add line", e instanceof Error ? e.message : "Request failed.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add payment line</DialogTitle>
          <DialogDescription>
            Create a second pending charge for {invoice.username} ({invoice.billingMonth?.slice(0, 7)}).
            Use this for carryover balances or split payments — each line is collected separately.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="debit-label">Line label</Label>
            <Input
              id="debit-label"
              value={debitLabel}
              onChange={(e) => setDebitLabel(e.target.value)}
              placeholder="carryover"
            />
            <p className="text-xs text-muted-foreground">
              Examples: carryover, equipment-fee, second-payment
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="debit-amount">Amount</Label>
            <Input
              id="debit-amount"
              type="number"
              min={0.01}
              step={0.01}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debit-pay-due">Pay due date</Label>
            <Input
              id="debit-pay-due"
              type="date"
              value={payDueDate}
              onChange={(e) => setPayDueDate(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!debitLabel.trim() || !amount || mutation.isPending}
          >
            {mutation.isPending ? "Adding…" : "Add payment line"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ExternalInvoiceAddDebitDialog;
