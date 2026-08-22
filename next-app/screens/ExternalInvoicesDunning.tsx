import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/context/AuthContext";
import { can } from "@/lib/permissions";
import {
  fetchExternalDunningPreview,
  runExternalDunningCampaign,
  type DunningPreviewResponse,
  type DunningRunResponse,
  type DunningStage,
} from "@/api/invoices";

type DunningAction = "remind" | "throttle" | "suspend";

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

      <Card className="space-y-4 border-border/80 p-4 shadow-none">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Grace days</div>
            <Input type="number" min={0} value={dunningGraceDays} onChange={(e) => setDunningGraceDays(Math.max(0, Number(e.target.value || 0)))} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Max invoices</div>
            <Input type="number" min={1} max={500} value={dunningMaxCount} onChange={(e) => setDunningMaxCount(Math.min(500, Math.max(1, Number(e.target.value || 1))))} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Min amount ($)</div>
            <Input type="number" min={0} value={dunningMinAmount} onChange={(e) => setDunningMinAmount(Math.max(0, Number(e.target.value || 0)))} />
          </div>
          <div className="flex items-end">
            <label className="text-sm inline-flex items-center gap-2">
              <input type="checkbox" checked={dunningDryRun} onChange={(e) => setDunningDryRun(e.target.checked)} />
              Dry run
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">As-of date (simulation)</div>
            <Input type="date" value={dunningAsOfDate} onChange={(e) => setDunningAsOfDate(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button variant="outline" type="button" onClick={() => setDunningAsOfDate("")}>
              Use Today
            </Button>
          </div>
          <div className="md:col-span-2">
            <div className="text-xs text-muted-foreground mb-1">Run only actions</div>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={dunningActionFilter.includes("remind")} onChange={(e) => toggleDunningAction("remind", e.target.checked)} />
                Remind
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={dunningActionFilter.includes("throttle")} onChange={(e) => toggleDunningAction("throttle", e.target.checked)} />
                Throttle
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={dunningActionFilter.includes("suspend")} onChange={(e) => toggleDunningAction("suspend", e.target.checked)} />
                Suspend
              </label>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">2nd reminder day</div>
            <Input type="number" min={0} value={dunningSecondReminderDay} onChange={(e) => setDunningSecondReminderDay(Math.max(0, Number(e.target.value || 0)))} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Throttle day</div>
            <Input type="number" min={0} value={dunningThrottleDay} onChange={(e) => setDunningThrottleDay(Math.max(0, Number(e.target.value || 0)))} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Suspend day</div>
            <Input type="number" min={0} value={dunningSuspendDay} onChange={(e) => setDunningSuspendDay(Math.max(0, Number(e.target.value || 0)))} />
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Throttle profile ID</div>
            <Input type="number" min={0} value={dunningThrottleProfileId} onChange={(e) => setDunningThrottleProfileId(Math.max(0, Number(e.target.value || 0)))} />
          </div>
        </div>

        <div className="rounded-md border p-3 text-sm">
          {dunningPreviewQuery.isLoading ? (
            <div className="text-muted-foreground">Loading dunning preview...</div>
          ) : dunningPreviewQuery.error ? (
            <div className="text-red-600">Failed to load preview.</div>
          ) : (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-3">
                <Badge variant="secondary">Candidates: {dunningPreviewQuery.data?.totalCandidates ?? 0}</Badge>
                <Badge variant="secondary">Ready: {dunningPreviewQuery.data?.readyToSend ?? 0}</Badge>
                <Badge variant="secondary">Missing phone: {dunningPreviewQuery.data?.missingPhone ?? 0}</Badge>
                <Badge variant="secondary">Amount: ${(dunningPreviewQuery.data?.totalAmount ?? 0).toFixed(2)}</Badge>
                <Badge variant="secondary">Remind: {dunningPreviewQuery.data?.actionSummary?.remind ?? 0}</Badge>
                <Badge variant="secondary">Throttle: {dunningPreviewQuery.data?.actionSummary?.throttle ?? 0}</Badge>
                <Badge variant="secondary">Suspend: {dunningPreviewQuery.data?.actionSummary?.suspend ?? 0}</Badge>
              </div>
              <div className="max-h-64 overflow-auto rounded border">
                {(dunningPreviewQuery.data?.data ?? []).slice(0, 30).map((c) => (
                  <div key={c.id} className="px-3 py-2 text-xs border-b last:border-b-0 flex items-center justify-between gap-3">
                    <div className="truncate">
                      #{c.id} {c.fullName || c.username} ({c.status})
                    </div>
                    <div className="text-muted-foreground whitespace-nowrap">
                      {c.overdueDays}d overdue - ${c.amount.toFixed(2)} - {c.stage ? `${c.stage.action}@D${c.stage.day}` : "no-stage"}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {dunningLastRun ? (
          <div className="rounded-md border p-3 text-xs bg-muted/30">
            Last run: attempted {dunningLastRun.attempted}, sent {dunningLastRun.sent}, failed {dunningLastRun.failed}, skipped no-phone {dunningLastRun.skippedNoPhone}, already-applied {dunningLastRun.skippedAlreadyApplied ?? 0}.
          </div>
        ) : null}
        {dunningActionFilter.length === 0 ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Select at least one action (remind, throttle, or suspend) to run dunning.
          </div>
        ) : null}
        {!canRunDunning ? (
          <div className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            You can preview candidates. Running dunning (remind, throttle, or suspend) requires the dunning permission.
          </div>
        ) : null}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => dunningPreviewQuery.refetch()}>
            Refresh Preview
          </Button>
          <Button
            onClick={() => dunningRunMutation.mutate()}
            disabled={!canRunDunning || dunningRunMutation.isPending || dunningPreviewQuery.isLoading || dunningActionFilter.length === 0}
          >
            {dunningRunMutation.isPending ? "Running..." : dunningDryRun ? "Run Dry Preview" : "Send Dunning Reminders"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
