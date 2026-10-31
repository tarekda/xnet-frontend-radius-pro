import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { Invoice } from './types';
import { collectInvoice } from '@/api/invoices';
import { notify } from '@/lib/notify';
import { useState } from 'react';

/** Read-only detail dialog for a single invoice. */
const InvoiceDetailDialog: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
    const [collecting, setCollecting] = useState(false);
    const unpaid = String(invoice.status || "").toLowerCase() !== "paid";

    const onCollect = async () => {
        setCollecting(true);
        try {
            await collectInvoice(invoice.id, "cash");
            notify.success("Collected", "Invoice marked as collected (cash).");
            onClose();
        } catch (e: any) {
            notify.error("Collect failed", e?.response?.data?.message || e?.message || "Failed to collect");
        } finally {
            setCollecting(false);
        }
    };
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Invoice Details</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="id" className="text-right">ID</Label>
                        <Input id="id" value={invoice.id} readOnly className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="username" className="text-right">Username</Label>
                        <Input id="username" value={invoice.userProfile.username} readOnly className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="profile" className="text-right">Profile</Label>
                        <Input id="profile" value={invoice.userProfile.profile.profileName} readOnly className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="billingMonth" className="text-right">Billing Month</Label>
                        <Input id="billingMonth" value={new Date(invoice.billingMonth).toLocaleDateString()} readOnly className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="amount" className="text-right">Amount</Label>
                        <Input id="amount" value={`$${invoice.amount.toFixed(2)}`} readOnly className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="status" className="text-right">Status</Label>
                        <Input id="status" value={invoice.status} readOnly className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    {unpaid ? (
                        <Button variant="outline" disabled={collecting} onClick={() => void onCollect()}>
                            {collecting ? "Collecting…" : "Collect cash"}
                        </Button>
                    ) : null}
                    <Button onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default InvoiceDetailDialog;
