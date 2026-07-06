import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ImportColumnMapping } from '@/lib/externalInvoiceImport';

export type InvoiceUploadResult = {
  inserted: number;
  updated: number;
  removedFromScope: number;
  enrichedFromUserDetails: number;
  inheritedPayDueDates?: number;
  inheritedCarryoverLines?: number;
  mergedDuplicates?: number;
  skippedRows?: number;
};

interface UploadResponse {
  success: boolean;
  message: string;
  data?: InvoiceUploadResult;
}

export const useInvoiceUpload = () => {
  const uploadInvoiceMutation = useMutation<
    UploadResponse,
    Error,
    {
      file: File;
      billingMonth?: string;
      payDueDayOffset?: number;
      columnMapping?: ImportColumnMapping;
    }
  >({
    mutationFn: async ({ file, billingMonth, payDueDayOffset, columnMapping }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (billingMonth) formData.append('billingMonth', billingMonth);
      if (typeof payDueDayOffset === 'number' && Number.isFinite(payDueDayOffset) && payDueDayOffset >= 0) {
        formData.append('payDueDayOffset', String(Math.round(payDueDayOffset)));
      }
      if (columnMapping && Object.keys(columnMapping).length > 0) {
        formData.append('columnMapping', JSON.stringify(columnMapping));
      }

      const response = await apiClient.post<UploadResponse>('/invoices/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
  });

  return uploadInvoiceMutation;
};
