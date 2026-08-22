import React from 'react';
import { CheckCircle, DollarSign, FileText, XCircle } from 'lucide-react';
import StatCard from '@/components/StatCard';
import type { Invoice } from './types';

/** Summary row: paid/unpaid counts, total count, and total amount for the loaded page. */
const InvoiceSummaryCards: React.FC<{ invoices: Invoice[]; totalSum: number }> = ({ invoices, totalSum }) => {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const unpaidInvoices = invoices.filter(inv => inv.status !== 'paid');
    const totalPaidCount = paidInvoices.length;
    const totalUnpaidCount = unpaidInvoices.length;
    const totalInvoices = invoices.length;

    return (
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <StatCard
                label="Paid invoices"
                value={totalPaidCount}
                sublabel={`${(totalInvoices ? (totalPaidCount / totalInvoices) * 100 : 0).toFixed(1)}% of total`}
                icon={<CheckCircle className="h-4 w-4" />}
            />
            <StatCard
                label="Unpaid invoices"
                value={totalUnpaidCount}
                sublabel={`${(totalInvoices ? (totalUnpaidCount / totalInvoices) * 100 : 0).toFixed(1)}% of total`}
                icon={<XCircle className="h-4 w-4" />}
            />
            <StatCard
                label="Total invoices"
                value={totalInvoices}
                sublabel="All invoices"
                icon={<FileText className="h-4 w-4" />}
            />
            <StatCard
                label="Total sum"
                value={`$${totalSum.toFixed(2)}`}
                sublabel="Total amount of all invoices"
                icon={<DollarSign className="h-4 w-4" />}
            />
        </div>
    );
};

export default InvoiceSummaryCards;
