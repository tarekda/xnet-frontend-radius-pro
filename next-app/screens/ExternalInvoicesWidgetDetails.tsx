import React, { useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, CheckCircle, Clock, DollarSign, FileCheck, ShieldAlert } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import ExternalInvoicesTable from "@/components/ExternalInvoicesTable";
import { useExternalInvoices } from "@/hooks/useExternalInvoices";
import { fetchExternalAgingSummary } from "@/api/invoices";

type WidgetConfig = {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  status?: "paid" | "pending" | "unpaid";
  age?: string;
};

const WidgetMetricMiniCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  valueClassName = "text-foreground",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ElementType;
  valueClassName?: string;
}) => (
  <div className="rounded-lg border p-3">
    <div className="flex items-center justify-between">
      <span className="text-[11px] sm:text-xs text-muted-foreground">{title}</span>
      <Icon className={`h-4 w-4 ${valueClassName}`} />
    </div>
    <div className={`mt-1 text-base sm:text-lg font-semibold ${valueClassName}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground truncate">{subtitle}</div>
  </div>
);

const WIDGETS: Record<string, WidgetConfig> = {
  "total-invoices": {
    title: "Total Invoices",
    subtitle: "Detailed list of all invoices in the current filter context.",
    icon: FileCheck,
  },
  "total-amount": {
    title: "Total Amount",
    subtitle: "All invoices contributing to gross billed value.",
    icon: DollarSign,
  },
  "average-amount": {
    title: "Average Amount",
    subtitle: "Distribution context for invoice value and average billing.",
    icon: DollarSign,
  },
  paid: {
    title: "Paid Invoices",
    subtitle: "Invoices completed successfully.",
    icon: CheckCircle,
    status: "paid",
  },
  pending: {
    title: "Pending Invoices",
    subtitle: "Invoices awaiting payment processing.",
    icon: Clock,
    status: "pending",
  },
  unpaid: {
    title: "Unpaid Invoices",
    subtitle: "Invoices still open and pending collection.",
    icon: AlertCircle,
    status: "unpaid",
  },
  "overdue-rate": {
    title: "Overdue Risk",
    subtitle: "Open invoices with overdue exposure signals.",
    icon: ShieldAlert,
    status: "unpaid",
  },
};

export default function ExternalInvoicesWidgetDetailsPage() {
  const { widgetKey = "" } = useParams<{ widgetKey: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const config = WIDGETS[widgetKey];

  const search = searchParams.get("q") || "";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;
  const status = searchParams.get("status") || undefined;
  const ageBucket = searchParams.get("age") || undefined;
  const apiStatus = status === "overdue" ? "unpaid" : status;

  useEffect(() => {
    if (!config) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (config.status) next.set("status", config.status);
      if (config.age) next.set("age", config.age);
      return next;
    }, { replace: true } as any);
  }, [config, setSearchParams]);

  const statsQuery = useExternalInvoices({
    initialPage: 1,
    pageSize: 1,
    search,
    from,
    to,
    status: apiStatus,
    ageBucket,
    graceDays: 7,
  });

  const agingSummaryQuery = useQuery({
    queryKey: ["externalWidgetAgingSummary", widgetKey, search, from, to, apiStatus],
    queryFn: () =>
      fetchExternalAgingSummary({
        search: search || undefined,
        from,
        to,
        status: apiStatus,
        graceDays: 7,
      }),
    enabled: widgetKey === "overdue-rate",
  });

  const metrics = statsQuery.data?.data.metrics;
  const infoBadges = useMemo(() => {
    const list = [];
    if (status) list.push(`Status: ${status}`);
    if (ageBucket) list.push(`Aging: ${ageBucket}`);
    if (from || to) list.push(`Date: ${from || "…"} → ${to || "…"}`);
    if (search) list.push(`Search: ${search}`);
    return list;
  }, [ageBucket, from, search, status, to]);

  if (!config) {
    return (
      <div className="w-full space-y-4 px-2 sm:px-0 py-2">
        <PageHeader
          title="Widget Not Found"
          subtitle="The requested widget details page does not exist."
          icon={AlertCircle}
          actions={(
            <IconActionButton
              label="Back to External Invoices"
              to="/external-invoices"
              icon={<ArrowLeft className="h-4 w-4" />}
            />
          )}
        />
      </div>
    );
  }

  return (
    <div className="w-full space-y-6 py-2 sm:py-2 px-2 sm:px-0 animate-in fade-in-50">
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        icon={config.icon}
        actions={(
          <IconActionButton
            label="Back to External Invoices"
            to="/external-invoices"
            icon={<ArrowLeft className="h-4 w-4" />}
          />
        )}
      />

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {infoBadges.map((badge) => (
            <Badge key={badge} variant="secondary">{badge}</Badge>
          ))}
          {infoBadges.length === 0 ? <Badge variant="outline">No extra filters applied</Badge> : null}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <WidgetMetricMiniCard
            title="Invoices"
            value={(metrics?.totalInvoices ?? 0).toLocaleString()}
            subtitle="Current filtered scope"
            icon={FileCheck}
            valueClassName="text-blue-600"
          />
          <WidgetMetricMiniCard
            title="Total Amount"
            value={`$${(metrics?.totalAmount ?? 0).toLocaleString()}`}
            subtitle="Gross billed value"
            icon={DollarSign}
            valueClassName="text-indigo-600"
          />
          <WidgetMetricMiniCard
            title="Paid"
            value={(metrics?.totalPaid ?? 0).toLocaleString()}
            subtitle="Collected invoices"
            icon={CheckCircle}
            valueClassName="text-green-600"
          />
          <WidgetMetricMiniCard
            title="Unpaid"
            value={(metrics?.totalUnpaid ?? 0).toLocaleString()}
            subtitle="Open collection queue"
            icon={AlertCircle}
            valueClassName="text-amber-600"
          />
        </div>
        {widgetKey === "overdue-rate" ? (
          <div className="rounded-lg border p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
              Overdue exposure
            </div>
            <div className="text-xs sm:text-sm">
              <span className="text-muted-foreground">Rate </span>
              <span className="font-semibold text-red-600">{(agingSummaryQuery.data?.overdueRatePercent ?? 0).toFixed(1)}%</span>
              <span className="text-muted-foreground"> · Avg days </span>
              <span className="font-semibold">{(agingSummaryQuery.data?.avgDaysOverdue ?? 0).toFixed(1)}d</span>
            </div>
          </div>
        ) : null}
      </Card>

      <ExternalInvoicesTable
        search={search}
        ageBucket={ageBucket}
        graceDays={7}
        hideBulkActions={false}
        pageSize={50}
      />
    </div>
  );
}

