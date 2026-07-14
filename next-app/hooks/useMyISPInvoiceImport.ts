import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ImportPreviewData } from '@/lib/externalInvoiceImport';
import type { InvoiceUploadResult } from '@/hooks/useInvoiceUpload';

type PreviewResponse = {
  success: boolean;
  data: ImportPreviewData;
};

type ImportResponse = {
  success: boolean;
  message: string;
  data?: InvoiceUploadResult;
};

export type InvoiceImportSource = 'myisp' | 'myisp2' | 'idm' | 'terra' | 'radius';

export type ProviderImportParams = {
  source: InvoiceImportSource;
  billingMonth: string;
  payDueDayOffset?: number;
};

export function useProviderImportPreview() {
  return useMutation({
    mutationFn: async ({ source, billingMonth }: Pick<ProviderImportParams, 'source' | 'billingMonth'>) => {
      const response = await apiClient.post<PreviewResponse>(`/invoices/${source}/preview`, {
        billingMonth,
      });
      return response.data.data;
    },
  });
}

export function useProviderInvoiceImport() {
  return useMutation({
    mutationFn: async ({ source, billingMonth, payDueDayOffset }: ProviderImportParams) => {
      const response = await apiClient.post<ImportResponse>(`/invoices/${source}/import`, {
        billingMonth,
        ...(typeof payDueDayOffset === 'number' ? { payDueDayOffset } : {}),
      });
      return response.data;
    },
  });
}
