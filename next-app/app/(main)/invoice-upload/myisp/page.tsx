"use client";

import { FeatureGate } from '@/components/auth/FeatureGate';
import MyISPInvoiceImport from '@/screens/MyISPInvoiceImport';

export default function MyISPInvoiceImportPage() {
  return (
    <FeatureGate feature="invoice-upload">
      <MyISPInvoiceImport />
    </FeatureGate>
  );
}
