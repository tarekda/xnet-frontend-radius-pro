import React from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import StatusPill from '@/components/StatusPill';
import type { Invoice } from './types';

/** Mobile card view for a single invoice. */
const InvoiceCard: React.FC<{ invoice: Invoice; onSetPaid: () => void }> = ({ invoice, onSetPaid }) => {
    const isPaid = invoice.status === 'paid';

    return (
        <Card className="overflow-hidden border-border/60 shadow-none">
            <CardHeader className="border-b border-border/50 bg-muted/15 p-4 pb-3">
                <CardTitle className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">Invoice #{invoice.id}</span>
                    <StatusPill
                        label={invoice.status}
                        tone={isPaid ? "success" : "danger"}
                        dot
                        className="capitalize"
                    />
                </CardTitle>
                <CardDescription className="text-xs">@{invoice.userProfile.username}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 pb-3">
                <div className="mb-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Profile</span>
                        {invoice.userProfile.profile.profileName}
                    </div>
                    <div>
                        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">Billing month</span>
                        {new Date(invoice.billingMonth).toLocaleDateString()}
                    </div>
                </div>
                <div className="border-t border-border/50 pt-3 text-xl font-semibold tabular-nums">
                    ${invoice.amount.toFixed(2)}
                </div>
            </CardContent>
            <CardFooter className="justify-end border-t border-border/50 p-3">
                <Button variant="outline" size="sm" disabled={isPaid} onClick={onSetPaid}>
                    <Check className="mr-2 h-4 w-4" /> Set as Paid
                </Button>
            </CardFooter>
        </Card>
    );
};

export default InvoiceCard;
