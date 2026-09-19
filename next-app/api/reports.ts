import { apiClient } from "@/api/client";

export type ReportParamType = "date" | "month" | "number" | "select" | "text";

export type ReportParamSpec = {
  name: string;
  label: string;
  type: ReportParamType;
  required?: boolean;
  default?: string;
  options?: Array<{ value: string; label: string }>;
  help?: string;
};

export type ReportCategory = "billing" | "collections" | "expenses" | "subscribers";

export type ReportDescriptor = {
  key: string;
  title: string;
  description: string;
  category: ReportCategory;
  params: ReportParamSpec[];
};

export type ReportColumn = {
  key: string;
  label: string;
  type?: "string" | "number" | "currency" | "percent" | "date" | "datetime";
  width?: number;
};

export type ReportSummaryField = {
  label: string;
  value: string | number;
};

export type ReportResult = {
  key: string;
  title: string;
  subtitle?: string;
  generatedAt: string;
  summary: ReportSummaryField[];
  columns: ReportColumn[];
  rows: Array<Record<string, unknown>>;
  totals?: Record<string, number>;
};

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T;
};

function buildQuery(values: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") qs.set(key, value);
  }
  const serialized = qs.toString();
  return serialized ? `?${serialized}` : "";
}

export async function fetchReportCatalog(): Promise<ApiEnvelope<ReportDescriptor[]>> {
  const { data } = await apiClient.get<ApiEnvelope<ReportDescriptor[]>>("/reports");
  return data;
}

export async function generateReport(params: {
  key: string;
  query?: Record<string, string>;
}): Promise<ApiEnvelope<ReportResult>> {
  const { data } = await apiClient.get<ApiEnvelope<ReportResult>>(
    `/reports/${encodeURIComponent(params.key)}${buildQuery({ ...params.query, format: "json" })}`
  );
  return data;
}

/** Fetches the report as a binary file and triggers a browser download. */
export async function downloadReport(params: {
  key: string;
  format: "csv" | "xlsx";
  query?: Record<string, string>;
}): Promise<void> {
  const response = await apiClient.get<Blob>(
    `/reports/${encodeURIComponent(params.key)}${buildQuery({
      ...params.query,
      format: params.format,
    })}`,
    { responseType: "blob" }
  );

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
  const filename = `${params.key}-${stamp}.${params.format}`;

  const blob = response.data instanceof Blob ? response.data : new Blob([response.data]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/* ── Scheduled delivery ──────────────────────────────────────────────────── */

export type ReportScheduleFormat = "csv" | "xlsx";

export type ReportSchedule = {
  id: number;
  name: string;
  reportKey: string;
  format: ReportScheduleFormat;
  recipients: string[];
  cronExpr: string;
  params: Record<string, string>;
  enabled: boolean;
  lastRunAt: string | null;
  lastStatus: "success" | "failed" | null;
  lastError: string | null;
  lastDurationMs: number | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  /** Computed server-side from the cron task; null when the schedule is idle. */
  nextRunAt: string | null;
};

export type ReportScheduleInput = {
  name: string;
  reportKey: string;
  format: ReportScheduleFormat;
  recipients: string[];
  cronExpr: string;
  params?: Record<string, string> | null;
  enabled?: boolean;
};

export type ReportScheduleRunResult = {
  sent: boolean;
  reason: string | null;
  recipients: string[];
  rows: number;
  durationMs: number;
};

export async function fetchReportSchedules(): Promise<ApiEnvelope<ReportSchedule[]>> {
  const { data } = await apiClient.get<ApiEnvelope<ReportSchedule[]>>("/reports/schedules");
  return data;
}

export async function createReportSchedule(
  input: ReportScheduleInput
): Promise<ApiEnvelope<ReportSchedule>> {
  const { data } = await apiClient.post<ApiEnvelope<ReportSchedule>>("/reports/schedules", input);
  return data;
}

export async function updateReportSchedule(
  id: number,
  input: ReportScheduleInput
): Promise<ApiEnvelope<ReportSchedule>> {
  const { data } = await apiClient.put<ApiEnvelope<ReportSchedule>>(
    `/reports/schedules/${id}`,
    input
  );
  return data;
}

export async function deleteReportSchedule(
  id: number
): Promise<ApiEnvelope<{ ok: boolean }>> {
  const { data } = await apiClient.delete<ApiEnvelope<{ ok: boolean }>>(
    `/reports/schedules/${id}`
  );
  return data;
}

export async function runReportScheduleNow(
  id: number
): Promise<ApiEnvelope<ReportScheduleRunResult>> {
  const { data } = await apiClient.post<ApiEnvelope<ReportScheduleRunResult>>(
    `/reports/schedules/${id}/run`
  );
  return data;
}
