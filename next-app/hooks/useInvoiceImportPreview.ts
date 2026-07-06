import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ImportColumnMapping, ImportPreviewData } from '@/lib/externalInvoiceImport';

type PreviewResponse = {
  success: boolean;
  data: ImportPreviewData;
};

async function previewImport(params: {
  file: File;
  billingMonth?: string;
  columnMapping?: ImportColumnMapping;
}): Promise<ImportPreviewData> {
  const formData = new FormData();
  formData.append('file', params.file);
  if (params.billingMonth) formData.append('billingMonth', params.billingMonth);
  if (params.columnMapping && Object.keys(params.columnMapping).length > 0) {
    formData.append('columnMapping', JSON.stringify(params.columnMapping));
  }
  const resp = await apiClient.post<PreviewResponse>('/invoices/upload/preview', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return resp.data.data;
}

export function useInvoiceImportPreview() {
  return useMutation({
    mutationFn: previewImport,
  });
}
