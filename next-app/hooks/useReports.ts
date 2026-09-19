import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createReportSchedule,
  deleteReportSchedule,
  downloadReport,
  fetchReportCatalog,
  fetchReportSchedules,
  generateReport,
  runReportScheduleNow,
  updateReportSchedule,
} from "@/api/reports";
import type { ReportScheduleInput } from "@/api/reports";
import { notify } from "@/lib/notify";

/** The list of report definitions the signed-in user is allowed to run. */
export function useReportCatalog() {
  return useQuery({
    queryKey: ["reports", "catalog"],
    queryFn: fetchReportCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

/** Builds a report and returns its rows for on-screen preview. */
export function useGenerateReport() {
  return useMutation({
    mutationFn: generateReport,
    onError: (error: unknown) => {
      notify.error(
        "Report failed",
        error instanceof Error ? error.message : "Could not generate the report."
      );
    },
  });
}

/** Downloads a report as CSV or XLSX. */
export function useDownloadReport() {
  return useMutation({
    mutationFn: downloadReport,
    onSuccess: (_data, variables) => {
      notify.success("Export ready", `Downloading ${variables.format.toUpperCase()} file.`);
    },
    onError: (error: unknown) => {
      notify.error(
        "Export failed",
        error instanceof Error ? error.message : "Could not export the report."
      );
    },
  });
}

/* ── Scheduled delivery ──────────────────────────────────────────────────── */

const SCHEDULES_KEY = ["reports", "schedules"] as const;

function messageFrom(error: unknown, fallback: string): string {
  const apiMessage = (error as { response?: { data?: { message?: string } } })?.response?.data
    ?.message;
  if (apiMessage) return apiMessage;
  return error instanceof Error ? error.message : fallback;
}

/** The recurring report deliveries configured on this instance. */
export function useReportSchedules() {
  return useQuery({
    queryKey: SCHEDULES_KEY,
    queryFn: fetchReportSchedules,
    staleTime: 30_000,
  });
}

export function useCreateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReportScheduleInput) => createReportSchedule(input),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY });
      notify.success("Schedule created", response.message);
    },
    onError: (error: unknown) => {
      notify.error("Could not create schedule", messageFrom(error, "Please review the form."));
    },
  });
}

export function useUpdateReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ReportScheduleInput }) =>
      updateReportSchedule(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY });
      notify.success("Schedule updated", "The new settings are active.");
    },
    onError: (error: unknown) => {
      notify.error("Could not update schedule", messageFrom(error, "Please review the form."));
    },
  });
}

export function useDeleteReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteReportSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY });
      notify.success("Schedule deleted", "It will no longer be delivered.");
    },
    onError: (error: unknown) => {
      notify.error("Could not delete schedule", messageFrom(error, "Please try again."));
    },
  });
}

/** Runs a schedule immediately, sending the report email right away. */
export function useRunReportSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => runReportScheduleNow(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: SCHEDULES_KEY });
      const result = response.data;
      if (result?.sent) {
        notify.success("Report sent", `Delivered to ${result.recipients.join(", ")}.`);
      } else {
        notify.error("Report not sent", result?.reason || "Unknown delivery error.");
      }
    },
    onError: (error: unknown) => {
      notify.error("Run failed", messageFrom(error, "Could not run the schedule."));
    },
  });
}
