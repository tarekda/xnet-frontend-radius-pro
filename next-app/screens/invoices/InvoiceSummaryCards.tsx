import React from 'react';
import { CheckCircle, DollarSign, FileText, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Invoice } from './types';

/** Summary row: paid/unpaid counts, total count, and total amount for the loaded page. */
const InvoiceSummaryCards: React.FC<{ invoices: Invoice[]; totalSum: number }> = ({ invoices, totalSum }) => {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
    const totalPaidCount = paidInvoices.length;
    const totalUnpaidCount = unpaidInvoices.length;
    const totalInvoices = invoices.length;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Paid Invoices</CardTitle>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalPaidCount}</div>
                    <p className="text-xs text-muted-foreground">
                        {((totalPaidCount / totalInvoices) * 100).toFixed(1)}% of total
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
                    <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalUnpaidCount}</div>
                    <p className="text-xs text-muted-foreground">
                        {((totalUnpaidCount / totalInvoices) * 100).toFixed(1)}% of total
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
                    <FileText className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{totalInvoices}</div>
                    <p className="text-xs text-muted-foreground">
                        All invoices
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sum</CardTitle>
                    <DollarSign className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${totalSum.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                        Total amount of all invoices
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default InvoiceSummaryCards;
