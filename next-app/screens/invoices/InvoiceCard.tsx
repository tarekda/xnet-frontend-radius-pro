import React from 'react';
import { Check, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from './types';

/** Mobile card view for a single invoice. */
const InvoiceCard: React.FC<{ invoice: Invoice; onSetPaid: () => void }> = ({ invoice, onSetPaid }) => {
    return (
        <Card className="mb-4">
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    <span className="font-semibold text-blue-600">Invoice #{invoice.id}</span>
                    <div className={`flex items-center ${invoice.status === 'paid' ? 'text-green-600' : 'text-red-600'}`}>
                        {invoice.status === 'paid' ? (
                            <CheckCircle className="h-4 w-4 mr-2" />
                        ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                        )}
                        {invoice.status}
                    </div>
                </CardTitle>
                <CardDescription>{invoice.userProfile.username}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                        <span className="font-semibold">Profile:</span> {invoice.userProfile.profile.profileName}
                    </div>
                    <div>
                        <span className="font-semibold">Billing Month:</span> {new Date(invoice.billingMonth).toLocaleDateString()}
                    </div>
                </div>
                <div className="text-lg font-bold">
                    Amount: ${invoice.amount.toFixed(2)}
                </div>
            </CardContent>
            <CardFooter className="flex justify-end">
                <Button variant="outline" size="sm" disabled={invoice.status === 'paid'} onClick={onSetPaid}>
                    <Check className="h-4 w-4 mr-2" /> Set as Paid
                </Button>
            </CardFooter>
        </Card>
    );
};

export default InvoiceCard;
