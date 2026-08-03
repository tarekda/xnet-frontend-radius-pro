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
  /** Provider login names — when set, only these accounts are imported (partial import). */
  usernames?: string;
  partialImport?: boolean;
};

function buildProviderImportBody(params: Pick<ProviderImportParams, 'billingMonth' | 'payDueDayOffset' | 'usernames' | 'partialImport'>) {
  const usernames = params.usernames?.trim();
  const hasFilter = Boolean(usernames);
  return {
    billingMonth: params.billingMonth,
    ...(typeof params.payDueDayOffset === 'number' ? { payDueDayOffset: params.payDueDayOffset } : {}),
    ...(hasFilter ? { usernames, partialImport: params.partialImport !== false } : {}),
  };
}

export function useProviderImportPreview() {
  return useMutation({
    mutationFn: async ({ source, billingMonth, usernames, partialImport }: Pick<ProviderImportParams, 'source' | 'billingMonth' | 'usernames' | 'partialImport'>) => {
      const response = await apiClient.post<PreviewResponse>(`/invoices/${source}/preview`, buildProviderImportBody({ billingMonth, usernames, partialImport }));
      return response.data.data;
    },
  });
}

export function useProviderInvoiceImport() {
  return useMutation({
    mutationFn: async ({ source, billingMonth, payDueDayOffset, usernames, partialImport }: ProviderImportParams) => {
      const response = await apiClient.post<ImportResponse>(`/invoices/${source}/import`, buildProviderImportBody({ billingMonth, payDueDayOffset, usernames, partialImport }));
      return response.data;
    },
  });
}
