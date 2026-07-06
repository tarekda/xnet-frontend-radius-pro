export type ImportCanonicalField =
  | 'username'
  | 'fullName'
  | 'email'
  | 'phoneNumber'
  | 'address'
  | 'provider'
  | 'debitLabel'
  | 'amount'
  | 'payDueDate'
  | 'billingMonth'
  | 'status';

export type ImportColumnMapping = Partial<Record<ImportCanonicalField, string>>;

export type ImportPreviewIssue = {
  row: number;
  field: string;
  message: string;
  severity: 'warning' | 'error';
};

export type ImportPreviewData = {
  sheetName: string;
  headers: string[];
  suggestedMapping: ImportColumnMapping;
  rawPreview: Record<string, unknown>[];
  mappedPreview: Array<Record<string, unknown>>;
  totalRows: number;
  issues: ImportPreviewIssue[];
  validRowCount: number;
  skippedRowCount: number;
};

export const IMPORT_FIELD_META: Array<{ key: ImportCanonicalField; label: string; required?: boolean }> = [
  { key: 'username', label: 'Username', required: true },
  { key: 'fullName', label: 'Full name' },
  { key: 'email', label: 'Email' },
  { key: 'phoneNumber', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'provider', label: 'Provider' },
  { key: 'debitLabel', label: 'Debit label' },
  { key: 'amount', label: 'Amount' },
  { key: 'payDueDate', label: 'Pay due date' },
  { key: 'billingMonth', label: 'Billing month' },
  { key: 'status', label: 'Status' },
];

const STORAGE_PREFIX = 'externalInvoiceImport.mapping.';

export function loadSavedMapping(provider: string): ImportColumnMapping | null {
  if (typeof window === 'undefined' || !provider.trim()) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${provider.trim().toLowerCase()}`);
    if (!raw) return null;
    return JSON.parse(raw) as ImportColumnMapping;
  } catch {
    return null;
  }
}

export function saveMappingForProvider(provider: string, mapping: ImportColumnMapping): void {
  if (typeof window === 'undefined' || !provider.trim()) return;
  localStorage.setItem(`${STORAGE_PREFIX}${provider.trim().toLowerCase()}`, JSON.stringify(mapping));
}

export function detectProviderFromMapping(mapping: ImportColumnMapping, previewRows: Array<Record<string, unknown>>): string {
  const fromPreview = previewRows.map((r) => String(r.provider ?? '').trim()).find(Boolean);
  if (fromPreview) return fromPreview;
  return '';
}
