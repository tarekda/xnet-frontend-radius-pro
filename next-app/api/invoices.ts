import { apiClient } from './client';
import type { ExternalInvoice } from '@/types/api';

export type CollectedMetrics = {
  totalCollectedInvoices: number;
  totalCashCollected: number;
};

export type CollectorBreakdown = Array<{
  collector: string;
  count: number;
  totalAmount: number;
}>;

export type CollectedInvoicesList = {
  data: Array<{
    id: number;
    amount: number;
    collectedBy: string | null;
    collectedAt: string | null;
    paymentMethod: string | null;
    cashReconciled?: boolean | 0 | 1 | '0' | '1' | null;
    reconciledBy?: string | null;
    reconciledAt?: string | null;
    username?: string;
    fullName?: string | null;
    status?: string;
  }>;
  total: number;
  page: number;
  totalPages: number;
  pageTotalAmount: number;
};

export async function fetchCollectedMetrics(params?: { dateFrom?: string; dateTo?: string }): Promise<CollectedMetrics> {
  const { data } = await apiClient.get('/invoices/collected/metrics', { params });
  return data.data as CollectedMetrics;
}

export async function fetchCollectorBreakdown(params?: { dateFrom?: string; dateTo?: string }): Promise<CollectorBreakdown> {
  const { data } = await apiClient.get('/invoices/collected/breakdown', { params });
  return data.data as CollectorBreakdown;
}

export async function fetchCollectedInvoicesList(params: { page?: number; limit?: number; dateFrom?: string; dateTo?: string }): Promise<CollectedInvoicesList> {
  const { data } = await apiClient.get('/invoices/collected/list', { params });
  return data.data as CollectedInvoicesList;
}

export async function reconcileCollectedInvoice(invoiceId: number): Promise<void> {
  await apiClient.post(`/invoices/reconcile/${invoiceId}`);
}

export async function fetchExternalInvoiceById(invoiceId: number): Promise<ExternalInvoice> {
  const { data } = await apiClient.get(`/invoices/external/${invoiceId}`);
  return data.data as ExternalInvoice;
}

export async function sharePaidExternalInvoice(invoiceId: number): Promise<void> {
  await apiClient.post(`/invoices/external/${invoiceId}/share-paid`);
}

export type ProviderMacList = {
  provider: string;
  billingMonth: string;
  macAddresses: string[];
  stats: {
    totalSubscribers: number;
    withMac: number;
    missingMac: number;
    invalidMac: number;
    uniqueMacs: number;
    duplicateAssignments: number;
  };
};

export async function fetchProviderMacOptions(billingMonth: string): Promise<string[]> {
  const { data } = await apiClient.get("/invoices/external/provider-macs/providers", {
    params: { billingMonth },
  });
  return Array.isArray(data?.data) ? data.data.map(String) : [];
}

export async function fetchProviderMacList(
  provider: string,
  billingMonth: string
): Promise<ProviderMacList> {
  const { data } = await apiClient.get("/invoices/external/provider-macs", {
    params: { provider, billingMonth },
  });
  return data.data as ProviderMacList;
}

export type ProviderMacSyncResult = {
  provider: string;
  billingMonth: string;
  providerMacs: number;
  matchedSubscribers: number;
  updatedInvoiceRows: number;
  missingSubscribers: number;
};

export async function syncProviderMacAddresses(
  provider: string,
  billingMonth: string
): Promise<ProviderMacSyncResult> {
  const { data } = await apiClient.post("/invoices/external/provider-macs/sync", {
    provider,
    billingMonth,
  });
  return data.data as ProviderMacSyncResult;
}

export async function voidExternalCreditNote(
  creditNoteId: number,
  voidReason: string
): Promise<ExternalInvoice> {
  const { data } = await apiClient.post(`/invoices/external/${creditNoteId}/void`, {
    voidReason,
  });
  return data.data as ExternalInvoice;
}

export type DunningCandidate = {
  id: number;
  username: string;
  fullName: string;
  phoneNumber: string;
  status: string;
  billingMonth: string;
  amount: number;
  overdueDays: number;
  dueDate: string;
  stage?: {
    day: number;
    action: "remind" | "throttle" | "suspend";
    name?: string;
  } | null;
};

export type DunningStage = {
  day: number;
  action: "remind" | "throttle" | "suspend";
  name?: string;
};

export type DunningPreviewResponse = {
  graceDays: number;
  asOfDate?: string | null;
  statuses: string[];
  stages?: DunningStage[];
  selectedActions?: Array<"remind" | "throttle" | "suspend">;
  totalCandidates: number;
  readyToSend: number;
  missingPhone: number;
  totalAmount: number;
  actionSummary?: {
    remind: number;
    throttle: number;
    suspend: number;
    none: number;
  };
  data: DunningCandidate[];
};

export type DunningRunResponse = {
  dryRun: boolean;
  attempted: number;
  sent: number;
  skippedNoPhone: number;
  skippedAlreadyApplied?: number;
  failed: number;
  actionSummary?: {
    remind: number;
    throttle: number;
    suspend: number;
    none: number;
  };
  details: Array<{ id: number; status: "sent" | "skipped" | "failed"; action?: "remind" | "throttle" | "suspend"; stageDay?: number; reason?: string }>;
};

export async function fetchExternalDunningPreview(params?: {
  graceDays?: number;
  limit?: number;
  minAmount?: number;
  statuses?: string[];
  stages?: DunningStage[];
  asOfDate?: string;
  selectedActions?: Array<"remind" | "throttle" | "suspend">;
}): Promise<DunningPreviewResponse> {
  const normalized = {
    graceDays: params?.graceDays ?? 7,
    limit: params?.limit ?? 100,
    minAmount: params?.minAmount ?? 0,
    statuses: (params?.statuses ?? ["unpaid", "pending"]).join(","),
    stages: JSON.stringify(params?.stages ?? []),
    asOfDate: params?.asOfDate,
    selectedActions: (params?.selectedActions ?? []).join(","),
  };
  const { data } = await apiClient.get("/invoices/external/dunning/preview", { params: normalized });
  return data.data as DunningPreviewResponse;
}

export async function runExternalDunningCampaign(payload?: {
  graceDays?: number;
  maxCount?: number;
  minAmount?: number;
  dryRun?: boolean;
  statuses?: string[];
  stages?: DunningStage[];
  throttleProfileId?: number;
  asOfDate?: string;
  selectedActions?: Array<"remind" | "throttle" | "suspend">;
}): Promise<DunningRunResponse> {
  const body = {
    graceDays: payload?.graceDays ?? 7,
    maxCount: payload?.maxCount ?? 100,
    minAmount: payload?.minAmount ?? 0,
    dryRun: payload?.dryRun ?? false,
    statuses: (payload?.statuses ?? ["unpaid", "pending"]).join(","),
    stages: payload?.stages ?? [],
    throttleProfileId: payload?.throttleProfileId,
    asOfDate: payload?.asOfDate,
    selectedActions: (payload?.selectedActions ?? []).join(","),
  };
  const { data } = await apiClient.post("/invoices/external/dunning/run", body);
  return data.data as DunningRunResponse;
}

export type AgingBucketKey = 'current' | '1_30' | '31_60' | '61_90' | '90_plus';

export type ExternalAgingSummary = {
  asOf: string;
  graceDays: number;
  openInvoices: number;
  openAmount: number;
  overdueInvoices: number;
  overdueAmount: number;
  overdueRatePercent: number;
  avgDaysOverdue: number;
  buckets: Array<{
    key: AgingBucketKey;
    label: string;
    count: number;
    amount: number;
  }>;
  topDebtors: Array<{
    username: string;
    fullName: string;
    amount: number;
    invoices: number;
    maxOverdueDays: number;
  }>;
};

export async function fetchExternalAgingSummary(params?: {
  search?: string;
  from?: string;
  to?: string;
  status?: string;
  graceDays?: number;
}): Promise<ExternalAgingSummary> {
  const { data } = await apiClient.get('/invoices/external/aging-summary', { params });
  return data.data as ExternalAgingSummary;
}

export type ExternalInvoiceTrendPoint = {
  month: string; // "YYYY-MM"
  totalCount: number;
  paidCount: number;
  totalAmount: number;
  paidAmount: number;
};

export async function fetchExternalInvoicesTrend(months = 6): Promise<ExternalInvoiceTrendPoint[]> {
  const { data } = await apiClient.get('/invoices/external/trend', { params: { months } });
  return data.data as ExternalInvoiceTrendPoint[];
}

export type ExternalInvoiceHistoryItem = {
  id: number;
  action: string;
  username: string;
  timestamp: string;
  changes?: Record<string, unknown> | null;
};

export async function fetchExternalInvoiceHistory(invoiceId: number, limit = 100): Promise<ExternalInvoiceHistoryItem[]> {
  const { data } = await apiClient.get(`/invoices/external/${invoiceId}/history`, {
    params: { limit },
  });
  return data.data as ExternalInvoiceHistoryItem[];
}

export type ExternalWorkflowStage = 'new' | 'reminded' | 'promise_to_pay' | 'escalated' | 'resolved';

export async function setExternalInvoiceWorkflow(
  invoiceId: number,
  payload: { stage: ExternalWorkflowStage; promiseDate?: string | null }
): Promise<void> {
  await apiClient.post(`/invoices/external/${invoiceId}/workflow`, payload);
}

export async function fetchExternalInvoicesPaymentDue(): Promise<ExternalInvoice[]> {
  const { data } = await apiClient.get('/invoices/external/payment-due');
  return data.data as ExternalInvoice[];
}

export type ExternalInvoiceListFilters = {
  search?: string;
  from?: string;
  to?: string;
  status?: string;
  ageBucket?: string;
  graceDays?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  missing?: string;
  payDue?: string;
};

function buildExternalInvoiceListParams(filters: ExternalInvoiceListFilters, page: number, limit: number): URLSearchParams {
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(limit));
  if (filters.search) params.set('search', filters.search);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  if (filters.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters.ageBucket && filters.ageBucket !== 'all') params.set('ageBucket', filters.ageBucket);
  if (typeof filters.graceDays === 'number') params.set('graceDays', String(Math.max(0, Math.round(filters.graceDays))));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortDir) params.set('sortDir', filters.sortDir);
  if (filters.missing && filters.missing !== 'all') params.set('missing', filters.missing);
  if (filters.payDue && filters.payDue !== 'all') params.set('payDue', filters.payDue);
  return params;
}

/** Fetch every page of the external invoices list matching the filters (for exports / full-dataset scans). */
export async function fetchAllExternalInvoicePages(
  filters: ExternalInvoiceListFilters,
  pageSize = 500
): Promise<ExternalInvoice[]> {
  const first = await apiClient.get(`/invoices/external?${buildExternalInvoiceListParams(filters, 1, pageSize).toString()}`);
  const payload = first?.data?.data ?? first?.data;
  const rows: ExternalInvoice[] = [...(payload?.data ?? [])];
  const totalPages = payload?.totalPages ?? 1;
  for (let page = 2; page <= totalPages; page++) {
    const next = await apiClient.get(`/invoices/external?${buildExternalInvoiceListParams(filters, page, pageSize).toString()}`);
    const nextPayload = next?.data?.data ?? next?.data;
    if (nextPayload?.data?.length) rows.push(...nextPayload.data);
  }
  return rows;
}

export async function remindExternalInvoice(invoiceId: number): Promise<void> {
  await apiClient.post(`/invoices/external/${invoiceId}/remind`);
}

export async function fetchExternalInvoicePaymentLines(
  username: string,
  billingMonth: string,
  provider?: string
): Promise<ExternalInvoice[]> {
  const { data } = await apiClient.get('/invoices/external/payment-lines', {
    params: { username, billingMonth, provider },
  });
  return data.data as ExternalInvoice[];
}

export type CreateExternalInvoiceDebitInput = {
  sourceInvoiceId?: number;
  debitLabel: string;
  amount: number;
  payDueDate?: string | null;
  status?: string;
};

export async function createExternalInvoiceDebit(
  input: CreateExternalInvoiceDebitInput
): Promise<ExternalInvoice> {
  const { data } = await apiClient.post('/invoices/external/debit', input);
  return data.data as ExternalInvoice;
}

