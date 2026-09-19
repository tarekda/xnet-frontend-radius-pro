import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/PageHeader";
import QueryState from "@/components/QueryState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateReportSchedule,
  useDeleteReportSchedule,
  useDownloadReport,
  useGenerateReport,
  useReportCatalog,
  useReportSchedules,
  useRunReportSchedule,
  useUpdateReportSchedule,
} from "@/hooks/useReports";
import type {
  ReportCategory,
  ReportColumn,
  ReportDescriptor,
  ReportParamSpec,
  ReportResult,
  ReportSchedule,
  ReportScheduleFormat,
} from "@/api/reports";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  CalendarClock,
  Clock,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Pencil,
  Play,
  Plus,
  Send,
  Table2,
  Trash2,
} from "lucide-react";

/** Sentinel for the Radix Select, which rejects an empty-string item value. */
const ALL_OPTION = "__all";

/** Preview is capped so a 20k-row report cannot freeze the browser. */
const PREVIEW_ROW_LIMIT = 200;

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  billing: "Billing",
  collections: "Collections",
  expenses: "Expenses",
  subscribers: "Subscribers",
};

const CATEGORY_ORDER: ReportCategory[] = ["billing", "collections", "expenses", "subscribers"];

function formatCell(value: unknown, column: ReportColumn): string {
  if (value === null || value === undefined || value === "") return "—";

  switch (column.type) {
    case "currency": {
      const numeric = Number(value);
      return Number.isFinite(numeric)
        ? numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : String(value);
    }
    case "number": {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric.toLocaleString() : String(value);
    }
    case "percent":
      return `${value}%`;
    case "date":
    case "datetime": {
      const parsed = new Date(String(value));
      if (Number.isNaN(parsed.getTime())) return String(value);
      return column.type === "date" ? parsed.toLocaleDateString() : parsed.toLocaleString();
    }
    default:
      return String(value);
  }
}

function ParamField({
  spec,
  value,
  onChange,
}: {
  spec: ReportParamSpec;
  value: string;
  onChange: (next: string) => void;
}) {
  const inputId = `report-param-${spec.name}`;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={inputId}>{spec.label}</Label>
      {spec.type === "select" ? (
        <Select
          value={value === "" ? ALL_OPTION : value}
          onValueChange={(next) => onChange(next === ALL_OPTION ? "" : next)}
        >
          <SelectTrigger id={inputId}>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).map((option) => {
              const optionValue = option.value === "" ? ALL_OPTION : option.value;
              return (
                <SelectItem key={optionValue} value={optionValue}>
                  {option.label}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={inputId}
          type={
            spec.type === "date"
              ? "date"
              : spec.type === "month"
                ? "month"
                : spec.type === "number"
                  ? "number"
                  : "text"
          }
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {spec.help ? <p className="text-xs text-muted-foreground">{spec.help}</p> : null}
    </div>
  );
}

function ReportPreview({ report }: { report: ReportResult }) {
  const visibleRows = report.rows.slice(0, PREVIEW_ROW_LIMIT);
  const hiddenCount = report.rows.length - visibleRows.length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">{report.title}</h3>
          <p className="text-xs text-muted-foreground">
            {report.subtitle ? `${report.subtitle} · ` : ""}
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
        </div>
        <Badge variant="outline" className="gap-1.5">
          <Table2 className="h-3 w-3" />
          {report.rows.length.toLocaleString()} row{report.rows.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {report.summary.length > 0 ? (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {report.summary.map((field) => (
            <div
              key={field.label}
              className="rounded-xl border border-border/60 bg-muted/25 px-3 py-2"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {field.label}
              </div>
              <div className="mt-0.5 truncate text-base font-semibold tabular-nums">
                {typeof field.value === "number" ? field.value.toLocaleString() : field.value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {report.rows.length === 0 ? (
        <div className="rounded-xl border border-border/60 py-12 text-center text-sm text-muted-foreground">
          This report returned no rows for the selected filters.
        </div>
      ) : (
        <div className="w-full overflow-auto rounded-xl border border-border/60">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                {report.columns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap",
                      column.type === "number" ||
                        column.type === "currency" ||
                        column.type === "percent"
                        ? "text-right"
                        : ""
                    )}
                  >
                    {column.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, index) => (
                <TableRow key={String(row.id ?? index)}>
                  {report.columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap",
                        column.type === "number" ||
                          column.type === "currency" ||
                          column.type === "percent"
                          ? "text-right tabular-nums"
                          : ""
                      )}
                    >
                      {formatCell(row[column.key], column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              {report.totals ? (
                <TableRow className="bg-muted/40 font-semibold">
                  {report.columns.map((column, index) => (
                    <TableCell key={column.key} className="whitespace-nowrap">
                      {index === 0
                        ? "Totals"
                        : typeof report.totals?.[column.key] === "number"
                          ? formatCell(report.totals[column.key], column)
                          : ""}
                    </TableCell>
                  ))}
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      )}

      {hiddenCount > 0 ? (
        <p className="text-xs text-muted-foreground">
          Showing the first {PREVIEW_ROW_LIMIT} rows. Export the report to see all{" "}
          {report.rows.length.toLocaleString()} rows.
        </p>
      ) : null}
    </div>
  );
}

/* ── Scheduled delivery ──────────────────────────────────────────────────── */

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const CRON_PRESETS: Array<{ label: string; value: string }> = [
  { label: "Every day at 07:00", value: "0 7 * * *" },
  { label: "Every weekday at 08:00", value: "0 8 * * 1-5" },
  { label: "Every Monday at 08:00", value: "0 8 * * 1" },
  { label: "1st of the month at 06:00", value: "0 6 1 * *" },
];

/** Renders the common cron shapes in plain English; anything else echoes back. */
function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, , dayOfWeek] = parts;
  if (!/^\d+$/.test(minute) || !/^\d+$/.test(hour)) return expression;

  const at = `at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
  if (dayOfMonth === "*" && dayOfWeek === "*") return `Every day ${at}`;
  if (dayOfMonth === "*" && dayOfWeek === "1-5") return `Every weekday ${at}`;
  if (dayOfMonth === "*" && /^\d$/.test(dayOfWeek)) {
    return `Every ${WEEKDAY_NAMES[Number(dayOfWeek)]} ${at}`;
  }
  if (/^\d+$/.test(dayOfMonth) && dayOfWeek === "*") {
    return `Day ${dayOfMonth} of each month ${at}`;
  }
  return expression;
}

function formatMoment(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString();
}

type ScheduleFormState = {
  /** null while creating a new schedule. */
  id: number | null;
  name: string;
  reportKey: string;
  format: ReportScheduleFormat;
  recipients: string;
  cronExpr: string;
  enabled: boolean;
  params: Record<string, string>;
};

function defaultParams(definition: ReportDescriptor | null): Record<string, string> {
  const next: Record<string, string> = {};
  for (const spec of definition?.params ?? []) next[spec.name] = spec.default ?? "";
  return next;
}

function emptyScheduleForm(report: ReportDescriptor | undefined): ScheduleFormState {
  return {
    id: null,
    name: report ? `${report.title} — daily` : "",
    reportKey: report?.key ?? "",
    format: "xlsx",
    recipients: "",
    cronExpr: CRON_PRESETS[0].value,
    enabled: true,
    params: defaultParams(report ?? null),
  };
}

function formFromSchedule(schedule: ReportSchedule): ScheduleFormState {
  return {
    id: schedule.id,
    name: schedule.name,
    reportKey: schedule.reportKey,
    format: schedule.format,
    recipients: schedule.recipients.join(", "),
    cronExpr: schedule.cronExpr,
    enabled: schedule.enabled,
    params: { ...(schedule.params ?? {}) },
  };
}

function ScheduleFormDialog({
  form,
  reports,
  isSaving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: ScheduleFormState | null;
  reports: ReportDescriptor[];
  isSaving: boolean;
  onChange: (next: ScheduleFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const definition = form
    ? (reports.find((report) => report.key === form.reportKey) ?? null)
    : null;

  return (
    <Dialog open={form !== null} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{form?.id ? "Edit schedule" : "New scheduled report"}</DialogTitle>
          <DialogDescription>
            The report is generated on the cron schedule and emailed as an attachment.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="schedule-name">Name</Label>
                <Input
                  id="schedule-name"
                  value={form.name}
                  placeholder="Monthly revenue to finance"
                  onChange={(event) => onChange({ ...form, name: event.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schedule-report">Report</Label>
                <Select
                  value={form.reportKey}
                  onValueChange={(key) => {
                    const next = reports.find((report) => report.key === key) ?? null;
                    onChange({ ...form, reportKey: key, params: defaultParams(next) });
                  }}
                >
                  <SelectTrigger id="schedule-report">
                    <SelectValue placeholder="Select a report…" />
                  </SelectTrigger>
                  <SelectContent>
                    {reports.map((report) => (
                      <SelectItem key={report.key} value={report.key}>
                        {report.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schedule-format">Attachment format</Label>
                <Select
                  value={form.format}
                  onValueChange={(value) =>
                    onChange({ ...form, format: value as ReportScheduleFormat })
                  }
                >
                  <SelectTrigger id="schedule-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                    <SelectItem value="csv">CSV (.csv)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="schedule-cron">Cron expression</Label>
                <Input
                  id="schedule-cron"
                  value={form.cronExpr}
                  placeholder="0 7 * * *"
                  className="font-mono"
                  onChange={(event) => onChange({ ...form, cronExpr: event.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {form.cronExpr.trim()
                    ? describeCron(form.cronExpr)
                    : "Five fields: minute hour day month weekday."}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {CRON_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => onChange({ ...form, cronExpr: preset.value })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    form.cronExpr === preset.value
                      ? "border-primary/40 bg-primary/10 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="schedule-recipients">Recipients</Label>
              <Textarea
                id="schedule-recipients"
                value={form.recipients}
                placeholder="finance@example.com, ops@example.com"
                onChange={(event) => onChange({ ...form, recipients: event.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Separate addresses with a comma, semicolon, or space.
              </p>
            </div>

            {definition && definition.params.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Report parameters
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {definition.params.map((spec) => (
                    <ParamField
                      key={spec.name}
                      spec={spec}
                      value={form.params[spec.name] ?? ""}
                      onChange={(next) =>
                        onChange({ ...form, params: { ...form.params, [spec.name]: next } })
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <div className="text-sm font-medium">Enabled</div>
                <p className="text-xs text-muted-foreground">
                  Disabled schedules are kept but never delivered.
                </p>
              </div>
              <Switch
                checked={form.enabled}
                onCheckedChange={(checked) => onChange({ ...form, enabled: checked })}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {form?.id ? "Save changes" : "Create schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SchedulesTab({
  reports,
  canManage,
}: {
  reports: ReportDescriptor[];
  canManage: boolean;
}) {
  const schedulesQuery = useReportSchedules();
  const createMutation = useCreateReportSchedule();
  const updateMutation = useUpdateReportSchedule();
  const deleteMutation = useDeleteReportSchedule();
  const runMutation = useRunReportSchedule();

  const [form, setForm] = useState<ScheduleFormState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReportSchedule | null>(null);

  const schedules = schedulesQuery.data?.data ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const runningId = runMutation.isPending ? (runMutation.variables ?? null) : null;

  const reportTitle = (key: string) =>
    reports.find((report) => report.key === key)?.title ?? key;

  const submit = () => {
    if (!form) return;
    const input = {
      name: form.name.trim(),
      reportKey: form.reportKey,
      format: form.format,
      recipients: form.recipients
        .split(/[,;\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
      cronExpr: form.cronExpr.trim(),
      params: form.params,
      enabled: form.enabled,
    };

    if (form.id) {
      updateMutation.mutate({ id: form.id, input }, { onSuccess: () => setForm(null) });
    } else {
      createMutation.mutate(input, { onSuccess: () => setForm(null) });
    }
  };

  /** A PUT replaces the whole row, so the untouched fields are echoed back. */
  const toggleEnabled = (schedule: ReportSchedule, enabled: boolean) => {
    updateMutation.mutate({
      id: schedule.id,
      input: {
        name: schedule.name,
        reportKey: schedule.reportKey,
        format: schedule.format,
        recipients: schedule.recipients,
        cronExpr: schedule.cronExpr,
        params: schedule.params,
        enabled,
      },
    });
  };

  return (
    <Card className="glass-card">
      <CardHeader className="border-b border-border/50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">Scheduled delivery</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Recurring reports emailed automatically as CSV or Excel attachments.
            </p>
          </div>
          {canManage ? (
            <Button size="sm" onClick={() => setForm(emptyScheduleForm(reports[0]))}>
              <Plus className="mr-2 h-4 w-4" />
              New schedule
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        <QueryState
          isLoading={schedulesQuery.isLoading}
          error={schedulesQuery.error}
          isEmpty={!schedulesQuery.isLoading && !schedulesQuery.error && schedules.length === 0}
          onRetry={() => schedulesQuery.refetch()}
          skeletonType="table"
          errorTitle="Failed to load schedules"
          emptyTitle="No scheduled reports"
          emptyDescription="Create a schedule to have a report emailed to your team on a recurring basis."
        >
          <div className="w-full overflow-auto rounded-xl border border-border/60">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell className="align-top">
                      <div className="flex items-start gap-2">
                        <Switch
                          checked={schedule.enabled}
                          disabled={!canManage || updateMutation.isPending}
                          onCheckedChange={(checked) => toggleEnabled(schedule, checked)}
                          aria-label={`Toggle ${schedule.name}`}
                          className="mt-0.5"
                        />
                        <div>
                          <div className="text-sm font-medium">{schedule.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>{reportTitle(schedule.reportKey)}</span>
                            <Badge variant="outline" className="px-1.5 py-0 text-[10px] uppercase">
                              {schedule.format}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-1.5 text-sm">
                        <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                        {describeCron(schedule.cronExpr)}
                      </div>
                      <code className="mt-0.5 block font-mono text-[11px] text-muted-foreground">
                        {schedule.cronExpr}
                      </code>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex max-w-[16rem] flex-wrap gap-1">
                        {schedule.recipients.map((recipient) => (
                          <Badge key={recipient} variant="secondary" className="font-normal">
                            {recipient}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground">
                      {schedule.enabled ? formatMoment(schedule.nextRunAt) : "Paused"}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatMoment(schedule.lastRunAt)}
                        </div>
                        {schedule.lastStatus ? (
                          <Badge
                            className="mt-1"
                            variant={schedule.lastStatus === "success" ? "default" : "destructive"}
                          >
                            {schedule.lastStatus}
                          </Badge>
                        ) : null}
                        {schedule.lastError ? (
                          <p
                            className="mt-1 max-w-[14rem] text-[11px] text-destructive"
                            title={schedule.lastError}
                          >
                            {schedule.lastError}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canManage || runningId === schedule.id}
                          onClick={() => runMutation.mutate(schedule.id)}
                          title="Generate and email this report now"
                        >
                          {runningId === schedule.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canManage}
                          onClick={() => setForm(formFromSchedule(schedule))}
                          title="Edit schedule"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={!canManage}
                          onClick={() => setPendingDelete(schedule)}
                          title="Delete schedule"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </QueryState>
      </CardContent>

      <ScheduleFormDialog
        form={form}
        reports={reports}
        isSaving={isSaving}
        onChange={setForm}
        onClose={() => setForm(null)}
        onSubmit={submit}
      />

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => (next ? undefined : setPendingDelete(null))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this schedule?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will stop being delivered. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export default function ReportsPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canManageSchedules = can(user, "admin.reports.manage");
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ReportResult | null>(null);

  const catalogQuery = useReportCatalog();
  const generateMutation = useGenerateReport();
  const downloadMutation = useDownloadReport();

  const reports = useMemo(() => catalogQuery.data?.data ?? [], [catalogQuery.data]);

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: reports.filter((report) => report.category === category),
    })).filter((group) => group.items.length > 0);
  }, [reports]);

  const selected = useMemo(
    () => reports.find((report) => report.key === selectedKey) ?? null,
    [reports, selectedKey]
  );

  // Select the first report once the catalog resolves.
  useEffect(() => {
    if (!selectedKey && reports.length > 0) setSelectedKey(reports[0].key);
  }, [reports, selectedKey]);

  // Reset parameters and the stale preview whenever the chosen report changes.
  useEffect(() => {
    if (!selected) return;
    const next: Record<string, string> = {};
    for (const spec of selected.params) next[spec.name] = spec.default ?? "";
    setParams(next);
    setResult(null);
  }, [selected]);

  const runReport = async () => {
    if (!selected) return;
    try {
      const response = await generateMutation.mutateAsync({ key: selected.key, query: params });
      setResult(response.data);
    } catch {
      // Toast is raised by the hook.
    }
  };

  const exportReport = async (format: "csv" | "xlsx") => {
    if (!selected) return;
    try {
      await downloadMutation.mutateAsync({ key: selected.key, format, query: params });
    } catch {
      // Toast is raised by the hook.
    }
  };

  const isBusy = generateMutation.isPending || downloadMutation.isPending;

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("reports.title")}
        subtitle={t("reports.subtitle")}
        icon={BarChart3}
      />

      <div className="grid gap-4 lg:grid-cols-12">
        {/* ── Catalog ─────────────────────────────────────────────────────── */}
        <Card className="glass-card lg:col-span-4">
          <CardHeader className="border-b border-border/50 p-4">
            <CardTitle className="text-base">Available reports</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <QueryState
              isLoading={catalogQuery.isLoading}
              error={catalogQuery.error}
              isEmpty={!catalogQuery.isLoading && !catalogQuery.error && reports.length === 0}
              onRetry={() => catalogQuery.refetch()}
              skeletonType="card"
              errorTitle="Failed to load reports"
              emptyTitle="No reports available"
              emptyDescription="No report definitions are registered for your role."
            >
              <div className="max-h-[32rem] overflow-y-auto pr-1">
                <div className="space-y-4">
                  {grouped.map((group) => (
                    <div key={group.category} className="space-y-1.5">
                      <div className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[group.category]}
                      </div>
                      {group.items.map((report) => {
                        const isActive = report.key === selectedKey;
                        return (
                          <button
                            key={report.key}
                            type="button"
                            onClick={() => setSelectedKey(report.key)}
                            aria-pressed={isActive}
                            className={cn(
                              "w-full rounded-xl border px-3 py-2.5 text-left transition-all duration-200",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                              isActive
                                ? "border-primary/40 bg-primary/5 shadow-sm"
                                : "border-border/60 hover:border-primary/25 hover:bg-muted/40"
                            )}
                          >
                            <div
                              className={cn(
                                "text-sm font-medium",
                                isActive ? "text-primary" : "text-foreground"
                              )}
                            >
                              {report.title}
                            </div>
                            <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {report.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </QueryState>
          </CardContent>
        </Card>

        {/* ── Runner + preview ────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-8">
          <Card className="glass-card">
            <CardHeader className="border-b border-border/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-base">
                    {selected ? selected.title : "Select a report"}
                  </CardTitle>
                  {selected ? (
                    <p className="mt-1 text-xs text-muted-foreground">{selected.description}</p>
                  ) : null}
                </div>
                {selected ? (
                  <Badge
                    variant="outline"
                    className="border-primary/20 bg-primary/5 text-primary"
                  >
                    {CATEGORY_LABELS[selected.category]}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {selected && selected.params.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {selected.params.map((spec) => (
                    <ParamField
                      key={spec.name}
                      spec={spec}
                      value={params[spec.name] ?? ""}
                      onChange={(next) =>
                        setParams((previous) => ({ ...previous, [spec.name]: next }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {selected
                    ? "This report has no parameters — run it to see the latest data."
                    : "Pick a report from the list to configure and run it."}
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                <Button onClick={runReport} disabled={!selected || isBusy}>
                  {generateMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="mr-2 h-4 w-4" />
                  )}
                  Run report
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportReport("csv")}
                  disabled={!selected || isBusy}
                >
                  {downloadMutation.isPending && downloadMutation.variables?.format === "csv" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={() => exportReport("xlsx")}
                  disabled={!selected || isBusy}
                >
                  {downloadMutation.isPending && downloadMutation.variables?.format === "xlsx" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                  )}
                  Export Excel
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="border-b border-border/50 p-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-4 w-4 text-muted-foreground" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {generateMutation.isPending ? (
                <div className="space-y-3">
                  <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/50" />
                    ))}
                  </div>
                  <div className="h-64 animate-pulse rounded-xl bg-muted/50" />
                </div>
              ) : result ? (
                <ReportPreview report={result} />
              ) : (
                <div className="flex flex-col items-center gap-2 py-14 text-center">
                  <BarChart3 className="h-9 w-9 text-muted-foreground/30" />
                  <p className="text-sm font-medium text-muted-foreground">No report generated yet</p>
                  <p className="text-xs text-muted-foreground/70">
                    Configure the parameters and select “Run report”.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {canManageSchedules ? (
        <SchedulesTab reports={reports} canManage={canManageSchedules} />
      ) : null}
    </div>
  );
}
