import { useState } from 'react';
import { apiClient } from '@/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export type InvoiceUploadResult = {
  inserted: number;
  updated: number;
  removedFromScope: number;
  enrichedFromUserDetails: number;
  inheritedPayDueDates?: number;
};

interface UploadResponse {
  success: boolean;
  message: string;
  data?: InvoiceUploadResult;
}

export const useInvoiceUpload = () => {
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const uploadInvoiceMutation = useMutation<
    UploadResponse,
    Error,
    { file: File; billingMonth?: string; payDueDayOffset?: number; inheritPayDue?: boolean }
  >({
    mutationFn: async ({ file, billingMonth, payDueDayOffset, inheritPayDue = true }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (billingMonth) {
        formData.append('billingMonth', billingMonth);
      }
      if (typeof payDueDayOffset === 'number' && Number.isFinite(payDueDayOffset) && payDueDayOffset >= 0) {
        formData.append('payDueDayOffset', String(Math.round(payDueDayOffset)));
      }
      formData.append('inheritPayDue', inheritPayDue ? 'true' : 'false');

      const response = await apiClient.post<UploadResponse>('/invoices/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['externalInvoices'] });
      queryClient.invalidateQueries({ queryKey: ['externalInvoicesPaymentDue'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (err) => {
      setError('An error occurred while uploading the file.');
      console.error(err);
    },
  });

  const uploadInvoice = (file: File, billingMonth?: string, payDueDayOffset?: number, inheritPayDue = true) => {
    setError(null);
    return uploadInvoiceMutation.mutateAsync({ file, billingMonth, payDueDayOffset, inheritPayDue });
  };

  return {
    uploadInvoice,
    isLoading: uploadInvoiceMutation.isPending,
    error,
    lastResult: uploadInvoiceMutation.data?.data ?? null,
  };
};
