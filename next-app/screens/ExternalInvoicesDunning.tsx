import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import ActionConfirmDialog from "@/components/ActionConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import { useProfiles } from "@/hooks/useProfiles";
import { Settings, Clock, Filter, Zap, Play, CheckCircle2, Users, ShieldCheck, RefreshCw, Loader2 } from "lucide-react";
import {
  fetchExternalDunningPreview,
  runExternalDunningCampaign,
  restoreSubscriberLineApi,
  type DunningPreviewResponse,
  type DunningRunResponse,
  type DunningStage,
} from "@/api/invoices";

type DunningAction = "remind" | "throttle" | "suspend";

const ACTION_BADGE_CLASS: Record<DunningAction | "none", string> = {
  remind: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-900/50",
  throttle: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-900/50",
  suspend: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border-red-200 dark:border-red-900/50",
  none: "bg-muted text-muted-foreground border-border/60",
};

const RUN_STATUS_CLASS: Record<"sent" | "skipped" | "failed", string> = {
  sent: "text-emerald-700 dark:text-emerald-400",
  skipped: "text-amber-700 dark:text-amber-400",
  failed: "text-red-700 dark:text-red-400",
};

function formatDueDate(value?: string) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

export default function ExternalInvoicesDunningPage() {
  const { t } = useTranslation("screens");
  const { user } = useAuth();
  const canRunDunning = can(user, "billing.externalInvoices.dunning");
  const queryClient = useQueryClient();

  const [dunningGraceDays, setDunningGraceDays] = useState(7);
  const [dunningMaxCount, setDunningMaxCount] = useState(100);
  const [dunningMinAmount, setDunningMinAmount] = useState(0);
  const [dunningDryRun, setDunningDryRun] = useState(true);
  const [dunningActionFilter, setDunningActionFilter] = useState<DunningAction[]>([
    "remind",
    "throttle",
    "suspend",
  ]);
  const [dunningAsOfDate, setDunningAsOfDate] = useState("");
  const [dunningSecondReminderDay, setDunningSecondReminderDay] = useState(3);
  const [dunningThrottleDay, setDunningThrottleDay] = useState(7);
  const [dunningSuspendDay, setDunningSuspendDay] = useState(14);
  const [dunningThrottleProfileId, setDunningThrottleProfileId] = useState(0);
  const [dunningLastRun, setDunningLastRun] = useState<DunningRunResponse | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoringUsername, setRestoringUsername] = useState<string | null>(null);

  const handleRestoreLine = async (username: string) => {
    setRestoringUsername(username);
    try {
      const res = await restoreSubscriberLineApi(username, true);
      if (res.ok) {
        notify.success("Line Restored", `Subscriber @${username} was restored to default profile & re-authenticated`);
        queryClient.invalidateQueries({ queryKey: ["dunningPreview"] });
      } else {
        notify.error("Restore Failed", res.reason || "Could not restore line");
      }
    } catch (e: any) {
      notify.error("Restore Failed", e?.message || "Could not restore subscriber line");
    } finally {
      setRestoringUsername(null);
    }
  };

  const profilesQuery = useProfiles();
  const profiles = profilesQuery.data?.data ?? [];

  const dunningStages = useMemo<DunningStage[]>(
    () =>
      [
        { day: 0, action: "remind" as const, name: "First Reminder" },
        { day: Math.max(0, dunningSecondReminderDay), action: "remind" as const, name: "Second Reminder" },
        { day: Math.max(0, dunningThrottleDay), action: "throttle" as const, name: "Throttle Service" },
        { day: Math.max(0, dunningSuspendDay), action: "suspend" as const, name: "Suspend Service" },
      ].sort((a, b) => a.day - b.day),
    [dunningSecondReminderDay, dunningThrottleDay, dunningSuspendDay]
  );

  /**
   * The ladder must strictly escalate: first reminder (day 0) -> 2nd reminder -> throttle -> suspend.
   * Without this the sort above silently reorders a bad config into one that suspends before it reminds,
   * and equal days leave the backend picking between two stages for the same invoice.
   */
  const stageIssues = useMemo(() => {
    const issues: Partial<Record<"secondReminder" | "throttle" | "suspend", string>> = {};
    if (dunningSecondReminderDay <= 0) {
      issues.secondReminder = "Must be after day 0 (first reminder).";
    }
    if (dunningThrottleDay <= dunningSecondReminderDay) {
      issues.throttle = "Must be after the 2nd reminder day.";
    }
    if (dunningSuspendDay <= dunningThrottleDay) {
      issues.suspend = "Must be after the throttle day.";
    }
    return issues;
  }, [dunningSecondReminderDay, dunningThrottleDay, dunningSuspendDay]);

  const hasStageIssues = Object.keys(stageIssues).length > 0;

  const toggleDunningAction = (action: DunningAction, checked: boolean) => {
    setDunningActionFilter((prev) => {
      if (checked) return Array.from(new Set([...prev, action]));
      return prev.filter((a) => a !== action);
    });
  };

  const dunningPreviewQuery = useQuery<DunningPreviewResponse>({
    queryKey: ["dunningPreview", dunningGraceDays, dunningMaxCount, dunningMinAmount, dunningStages, dunningActionFilter, dunningAsOfDate],
    queryFn: () =>
      fetchExternalDunningPreview({
        graceDays: dunningGraceDays,
        limit: dunningMaxCount,
        minAmount: dunningMinAmount,
        stages: dunningStages,
        asOfDate: dunningAsOfDate || undefined,
        selectedActions: dunningActionFilter,
      }),
  });

  const candidates = dunningPreviewQuery.data?.data ?? [];
  const actionSummary = dunningPreviewQuery.data?.actionSummary;
  const throttleProfileMissing = dunningActionFilter.includes("throttle") && dunningThrottleProfileId <= 0;

  const runDetails = useMemo(() => {
    const rank: Record<string, number> = { failed: 0, skipped: 1, sent: 2 };
    return [...(dunningLastRun?.details ?? [])].sort(
      (a, b) => (rank[a.status] ?? 3) - (rank[b.status] ?? 3)
    );
  }, [dunningLastRun]);

  const dunningRunMutation = useMutation({
    mutationFn: () =>
      runExternalDunningCampaign({
        graceDays: dunningGraceDays,
        maxCount: dunningMaxCount,
        minAmount: dunningMinAmount,
        dryRun: dunningDryRun,
        stages: dunningStages,
        throttleProfileId: dunningThrottleProfileId > 0 ? dunningThrottleProfileId : undefined,
        asOfDate: dunningAsOfDate || undefined,
        selectedActions: dunningActionFilter,
      }),
    onSuccess: (result) => {
      setDunningLastRun(result);
      if (result.dryRun) {
        notify.success("Dry run complete", `Attempted ${result.attempted} invoice(s).`);
      } else {
        notify.success("Dunning completed", `Sent ${result.sent}, failed ${result.failed}, skipped ${result.skippedNoPhone}.`);
      }
      dunningPreviewQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["externalInvoices"] });
    },
    onError: (e: unknown) => {
      notify.error("Dunning failed", e instanceof Error ? e.message : "Failed to run dunning campaign.");
    },
  });

  const runDisabled =
    !canRunDunning ||
    dunningRunMutation.isPending ||
    dunningPreviewQuery.isLoading ||
    dunningActionFilter.length === 0 ||
    hasStageIssues;

  const handleRunClick = () => {
    if (dunningDryRun) {
      dunningRunMutation.mutate();
      return;
    }
    setConfirmOpen(true);
  };

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("dunning.title")}
        subtitle={t("dunning.subtitle")}
        icon={AlertCircle}
        actions={(
          <div className="w-full sm:w-auto">
            <IconActionButton
              label="Back to External Invoices"
              to="/external-invoices"
              icon={<ArrowLeft className="h-4 w-4" />}
            />
          </div>
        )}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                Campaign Constraints
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Grace days</Label>
                <Input type="number" min={0} value={dunningGraceDays} onChange={(e) => setDunningGraceDays(Math.max(0, Number(e.target.value || 0)))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Max invoices</Label>
                <Input type="number" min={1} max={500} value={dunningMaxCount} onChange={(e) => setDunningMaxCount(Math.min(500, Math.max(1, Number(e.target.value || 1))))} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Min amount ($)</Label>
                <Input type="number" min={0} value={dunningMinAmount} onChange={(e) => setDunningMinAmount(Math.max(0, Number(e.target.value || 0)))} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Workflow Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">2nd reminder day</Label>
                <Input type="number" min={0} value={dunningSecondReminderDay} onChange={(e) => setDunningSecondReminderDay(Math.max(0, Number(e.target.value || 0)))} className={stageIssues.secondReminder ? "border-red-500 focus-visible:ring-red-500" : undefined} />
                {stageIssues.secondReminder && (
                  <p className="text-xs text-red-600 dark:text-red-400">{stageIssues.secondReminder}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Throttle day</Label>
                <Input type="number" min={0} value={dunningThrottleDay} onChange={(e) => setDunningThrottleDay(Math.max(0, Number(e.target.value || 0)))} className={stageIssues.throttle ? "border-red-500 focus-visible:ring-red-500" : undefined} />
                {stageIssues.throttle && (
                  <p className="text-xs text-red-600 dark:text-red-400">{stageIssues.throttle}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Suspend day</Label>
                <Input type="number" min={0} value={dunningSuspendDay} onChange={(e) => setDunningSuspendDay(Math.max(0, Number(e.target.value || 0)))} className={stageIssues.suspend ? "border-red-500 focus-visible:ring-red-500" : undefined} />
                {stageIssues.suspend && (
                  <p className="text-xs text-red-600 dark:text-red-400">{stageIssues.suspend}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Throttle profile</Label>
                <Select
                  value={String(dunningThrottleProfileId)}
                  onValueChange={(value) => setDunningThrottleProfileId(Number(value) || 0)}
                  disabled={profilesQuery.isLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={profilesQuery.isLoading ? "Loading..." : "Select profile"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">None</SelectItem>
                    {profiles
                      .filter((p) => typeof p.id === "number")
                      .map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.profileName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {throttleProfileMissing && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Throttle is selected but no profile is set - throttle actions will be skipped.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="w-4 h-4 text-primary" />
                Scope &amp; Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">As-of date (simulation)</Label>
                <div className="flex items-center gap-2">
                  <Input type="date" value={dunningAsOfDate} onChange={(e) => setDunningAsOfDate(e.target.value)} />
                  <Button variant="outline" type="button" onClick={() => setDunningAsOfDate("")} className="shrink-0">
                    Use Today
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <Label className="text-xs text-muted-foreground">Run only actions</Label>
                <div className="flex flex-wrap gap-4 pt-1">
                  <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" checked={dunningActionFilter.includes("remind")} onChange={(e) => toggleDunningAction("remind", e.target.checked)} />
                    Remind
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" checked={dunningActionFilter.includes("throttle")} onChange={(e) => toggleDunningAction("throttle", e.target.checked)} />
                    Throttle
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input type="checkbox" className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4" checked={dunningActionFilter.includes("suspend")} onChange={(e) => toggleDunningAction("suspend", e.target.checked)} />
                    Suspend
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/60 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/50 bg-muted/20 p-4 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Affected Customers
              </CardTitle>
              <span className="text-xs text-muted-foreground">
                {candidates.length} shown of {dunningPreviewQuery.data?.totalCandidates ?? 0}
              </span>
            </CardHeader>
            <CardContent className="p-0">
              {dunningPreviewQuery.isLoading ? (
                <div className="p-5 text-sm text-muted-foreground">Loading candidates...</div>
              ) : dunningPreviewQuery.error ? (
                <div className="p-5 text-sm text-red-600">Failed to load candidates.</div>
              ) : candidates.length === 0 ? (
                <div className="p-5 text-sm text-muted-foreground">
                  No invoices match the current constraints.
                </div>
              ) : (
                <div className="max-h-[420px] overflow-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/40 backdrop-blur">
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead className="text-right">Billed</TableHead>
                        <TableHead className="text-right">Paid</TableHead>
                        <TableHead className="text-right">Due</TableHead>
                        <TableHead className="text-right">Overdue</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {candidates.map((c) => {
                        const action = (c.stage?.action ?? "none") as DunningAction | "none";
                        const paid = Number(c.amountPaid ?? 0);
                        // Older backends omit remainingDue; fall back to the billed amount.
                        const due = Number(c.remainingDue ?? c.amount ?? 0);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="py-2">
                              <div className="font-medium leading-tight">{c.fullName || c.username}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                                <span>@{c.username}</span>
                                <span className="text-muted-foreground/60">•</span>
                                <span className="font-mono text-[11px] bg-muted/60 dark:bg-muted/40 px-1.5 py-0.5 rounded text-foreground/80 font-medium">
                                  #{c.id} ({c.billingMonth ? String(c.billingMonth).slice(0, 7) : "—"})
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              {c.phoneNumber ? (
                                <span className="text-sm">{c.phoneNumber}</span>
                              ) : (
                                <span className="text-xs font-medium text-amber-600 dark:text-amber-400">Missing</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums text-muted-foreground">{Number(c.amount ?? 0).toFixed(2)}</TableCell>
                            <TableCell className="py-2 text-right tabular-nums">
                              {paid > 0 ? (
                                <span className="text-emerald-600 dark:text-emerald-400">{paid.toFixed(2)}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right tabular-nums font-semibold">{due.toFixed(2)}</TableCell>
                            <TableCell className="py-2 text-right tabular-nums">{c.overdueDays}d</TableCell>
                            <TableCell className="py-2 text-sm text-muted-foreground">{formatDueDate(c.dueDate)}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className={ACTION_BADGE_CLASS[action]}>
                                {c.stage?.name ?? "No action"}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={restoringUsername === c.username}
                                onClick={() => handleRestoreLine(c.username)}
                                title="Force Restore & Re-auth line on MikroTik"
                                className="h-7 px-2 text-xs text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                              >
                                {restoringUsername === c.username ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                                )}
                                Restore
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {dunningLastRun && runDetails.length > 0 && (
            <Card className="border-border/60 shadow-sm overflow-hidden">
              <CardHeader className="border-b border-border/50 bg-muted/20 p-4 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  Last Run Details
                </CardTitle>
                <span className="text-xs text-muted-foreground">
                  {dunningLastRun.dryRun ? "Dry run" : "Live run"} - {runDetails.length} record(s)
                </span>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[320px] overflow-auto divide-y divide-border/50">
                  {runDetails.map((d, idx) => (
                    <div key={`${d.id}-${idx}`} className="flex items-start justify-between gap-3 px-4 py-2 text-sm">
                      <div className="min-w-0">
                        <span className="font-medium">Invoice #{d.id}</span>
                        {d.action && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {d.action}
                            {typeof d.stageDay === "number" ? ` (day ${d.stageDay})` : ""}
                          </span>
                        )}
                        {d.reason && <div className="text-xs text-muted-foreground truncate">{d.reason}</div>}
                      </div>
                      <span className={`text-xs font-semibold shrink-0 ${RUN_STATUS_CLASS[d.status] ?? ""}`}>
                        {d.status}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Card className="border-border/60 shadow-sm overflow-hidden sticky top-4">
            <CardHeader className="border-b border-border/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-500" />
                Execution
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">

              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/30 text-xs text-emerald-800 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold block">Closed-Loop Enforcement Active</span>
                  <span>Throttled/suspended users are immediately disconnected on MikroTik. Upon invoice payment, their line is automatically self-healed.</span>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                <div className="space-y-0.5">
                  <Label className="text-sm font-semibold">Dry Run Mode</Label>
                  <p className="text-xs text-muted-foreground">Simulate actions without changes.</p>
                </div>
                <Switch checked={dunningDryRun} onCheckedChange={setDunningDryRun} />
              </div>

              <div className="space-y-3 border-t border-border/50 pt-4">
                <div className="flex justify-between items-center">
                   <Label className="text-sm font-semibold">Preview Statistics</Label>
                   <Button variant="ghost" size="sm" onClick={() => dunningPreviewQuery.refetch()} className="h-6 text-xs px-2 text-primary">
                     Refresh
                   </Button>
                </div>

                {dunningPreviewQuery.isLoading ? (
                  <div className="text-xs text-muted-foreground">Loading dunning preview...</div>
                ) : dunningPreviewQuery.error ? (
                  <div className="text-xs text-red-600">Failed to load preview.</div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between p-2 bg-muted/30 rounded-md border border-border/50">
                      <span className="text-muted-foreground text-xs">Candidates</span>
                      <span className="font-semibold">{dunningPreviewQuery.data?.totalCandidates ?? 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded-md border border-border/50">
                      <span className="text-muted-foreground text-xs">Ready</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{dunningPreviewQuery.data?.readyToSend ?? 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded-md border border-border/50">
                      <span className="text-muted-foreground text-xs">Missing Phone</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">{dunningPreviewQuery.data?.missingPhone ?? 0}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-muted/30 rounded-md border border-border/50">
                      <span className="text-muted-foreground text-xs">Outstanding ($)</span>
                      <span className="font-semibold">{(dunningPreviewQuery.data?.totalAmount ?? 0).toFixed(0)}</span>
                    </div>
                  </div>
                )}
              </div>

              {actionSummary && (
                <div className="space-y-2 border-t border-border/50 pt-4">
                  <Label className="text-sm font-semibold">Action Breakdown</Label>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center p-2 rounded-md border border-sky-200 dark:border-sky-900/50 bg-sky-50/60 dark:bg-sky-950/20">
                      <span className="text-xs text-sky-800 dark:text-sky-300">Remind</span>
                      <span className="text-sm font-semibold text-sky-800 dark:text-sky-300">{actionSummary.remind}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20">
                      <span className="text-xs text-amber-800 dark:text-amber-300">Throttle</span>
                      <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{actionSummary.throttle}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20">
                      <span className="text-xs text-red-800 dark:text-red-300">Suspend</span>
                      <span className="text-sm font-semibold text-red-800 dark:text-red-300">{actionSummary.suspend}</span>
                    </div>
                    <div className="flex justify-between items-center p-2 rounded-md border border-border/50 bg-muted/30">
                      <span className="text-xs text-muted-foreground">No action</span>
                      <span className="text-sm font-semibold text-muted-foreground">{actionSummary.none}</span>
                    </div>
                  </div>
                </div>
              )}

              {dunningLastRun && (
                <div className="p-3 text-xs bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                     <span className="font-semibold block mb-1">Last Run Successful</span>
                     Attempted: {dunningLastRun.attempted} | Sent: {dunningLastRun.sent} | Failed: {dunningLastRun.failed} | Skipped: {dunningLastRun.skippedNoPhone}
                  </div>
                </div>
              )}

              {hasStageIssues && (
                <div className="p-3 text-xs bg-red-50 dark:bg-red-950/30 text-red-800 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-900/50">
                  <span className="font-semibold block mb-1">Invalid workflow schedule</span>
                  Each stage must fall after the previous one: first reminder (day 0), then 2nd reminder, then throttle, then suspend.
                </div>
              )}

              {dunningActionFilter.length === 0 && (
                <div className="p-3 text-xs bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-900/50">
                  Select at least one action (remind, throttle, or suspend) to run dunning.
                </div>
              )}

              {!canRunDunning && (
                <div className="p-3 text-xs bg-muted/50 text-muted-foreground rounded-lg border border-border/60">
                  You can preview candidates. Running dunning requires permissions.
                </div>
              )}

              <Button
                size="lg"
                className={`w-full text-white font-medium shadow-sm transition-all ${dunningDryRun ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
                onClick={handleRunClick}
                disabled={runDisabled}
              >
                {dunningRunMutation.isPending ? (
                  "Executing..."
                ) : (
                  <>
                     <Play className="w-4 h-4 mr-2" />
                     {dunningDryRun ? "Run Dry Preview" : "Execute Dunning Run"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ActionConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Execute live dunning run?"
        description="This is not a dry run. Reminders will be sent and service changes applied immediately."
        confirmText="Execute now"
        confirmTone="destructive"
        isConfirming={dunningRunMutation.isPending}
        onConfirm={() => {
          dunningRunMutation.mutate();
        }}
      >
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Candidates in scope</span>
            <span className="font-semibold">{dunningPreviewQuery.data?.totalCandidates ?? 0}</span>
          </div>
          {actionSummary && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reminders sent</span>
                <span className="font-semibold text-sky-700 dark:text-sky-400">{actionSummary.remind}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Services throttled</span>
                <span className="font-semibold text-amber-700 dark:text-amber-400">{actionSummary.throttle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Services suspended</span>
                <span className="font-semibold text-red-700 dark:text-red-400">{actionSummary.suspend}</span>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Capped at</span>
            <span className="font-semibold">{dunningMaxCount} invoice(s)</span>
          </div>
          {throttleProfileMissing && (
            <p className="pt-1 text-xs text-amber-700 dark:text-amber-400">
              No throttle profile selected - throttle actions will be skipped.
            </p>
          )}
        </div>
      </ActionConfirmDialog>
    </div>
  );
}
