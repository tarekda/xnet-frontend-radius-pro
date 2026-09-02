import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import IconActionButton from "@/components/IconActionButton";
import StatCard from "@/components/StatCard";
import { CountUpNumber, ProgressRing, Sparkline } from "@/components/viz";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { fetchExternalInvoicesTrend, type AgingBucketKey, type ExternalAgingSummary } from "@/api/invoices";
import type { InvoiceMetrics } from "@/hooks/useExternalInvoices";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock as ClockIcon,
  DollarSign,
  FileCheck,
  FileText,
  Receipt,
} from "lucide-react";

const AGING_SEGMENTS: Array<{ key: AgingBucketKey; label: string; barClass: string; dotClass: string }> = [
  { key: "current", label: "Current", barClass: "bg-emerald-500/80 hover:bg-emerald-500", dotClass: "bg-emerald-500" },
  { key: "1_30", label: "1-30d", barClass: "bg-amber-400/85 hover:bg-amber-400", dotClass: "bg-amber-400" },
  { key: "31_60", label: "31-60d", barClass: "bg-orange-500/85 hover:bg-orange-500", dotClass: "bg-orange-500" },
  { key: "61_90", label: "61-90d", barClass: "bg-red-500/85 hover:bg-red-500", dotClass: "bg-red-500" },
  { key: "90_plus", label: "90d+", barClass: "bg-red-700/90 hover:bg-red-700", dotClass: "bg-red-700" },
];

export const WidgetSkeleton = () => (
  <Card className="border-border/60">
    <CardContent className="p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-16" />
      <Skeleton className="h-3 w-24" />
    </CardContent>
  </Card>
);

const InvoiceMetricLink = ({
  title,
  value,
  subtitle,
  icon: Icon,
  accentClass = "text-blue-600 dark:text-blue-400",
  glowClass = "bg-blue-500",
  to,
  className,
  style,
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ElementType;
  accentClass?: string;
  glowClass?: string;
  to: string;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <Link
    href={to}
    className={`group relative block overflow-hidden rounded-xl border border-border/70 bg-card/90 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md dark:bg-card/80 ${className || ""}`}
    style={style}
  >
    <div className={`pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08] ${glowClass}`} />
    <div className="relative flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">{title}</span>
        <div className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight sm:text-2xl ${accentClass}`}>{value}</div>
        {subtitle ? <div className="mt-1 truncate text-[11px] text-muted-foreground">{subtitle}</div> : null}
      </div>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 ${accentClass}`}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
    <ArrowUpRight className="absolute bottom-3 right-3 h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground" />
  </Link>
);

type Props = {
  metrics: InvoiceMetrics | undefined;
  isStatsLoading: boolean;
  canViewTotals: boolean;
  agingSummary: ExternalAgingSummary | undefined;
  searchTerm: string;
  ageFilterValue: string;
  onQuickFilter: (filter: string) => void;
  onAgeBucketFilter: (bucket: string) => void;
};

const METRICS_COLLAPSED_STORAGE_KEY = "ui.externalInvoices.metricsCollapsed";

export const InvoiceMetricsPanel = ({
  metrics,
  isStatsLoading,
  canViewTotals,
  agingSummary,
  searchTerm,
  ageFilterValue,
  onQuickFilter,
  onAgeBucketFilter,
}: Props) => {
  const [searchParams] = useSearchParams();
  const [metricsCollapsed, setMetricsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(METRICS_COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(METRICS_COLLAPSED_STORAGE_KEY, metricsCollapsed ? "1" : "0");
    } catch {}
  }, [metricsCollapsed]);

  const trendQuery = useQuery({
    queryKey: ["externalInvoicesTrend"],
    queryFn: () => fetchExternalInvoicesTrend(8),
    staleTime: 5 * 60 * 1000,
  });

  const trendPoints = useMemo(() => trendQuery.data ?? [], [trendQuery.data]);
  const sparkSeries = useMemo(() => ({
    total: trendPoints.map((p) => p.totalCount),
    open: trendPoints.map((p) => Math.max(0, p.totalCount - p.paidCount)),
    paid: trendPoints.map((p) => p.paidCount),
    paidAmount: trendPoints.map((p) => p.paidAmount),
  }), [trendPoints]);
  const trendMonthsLabel = trendPoints.length >= 2
    ? `${trendPoints[0]!.month} → ${trendPoints[trendPoints.length - 1]!.month}`
    : null;

  const collectionRate = useMemo(() => {
    const total = metrics?.totalInvoices ?? 0;
    const paid = metrics?.totalPaid ?? 0;
    const countRate = total > 0 ? (paid / total) * 100 : 0;
    const sumAmount = trendPoints.reduce((acc, p) => acc + p.totalAmount, 0);
    const sumPaidAmount = trendPoints.reduce((acc, p) => acc + p.paidAmount, 0);
    const amountRate = sumAmount > 0 ? (sumPaidAmount / sumAmount) * 100 : null;
    return { countRate, amountRate, sumAmount, sumPaidAmount };
  }, [metrics?.totalInvoices, metrics?.totalPaid, trendPoints]);

  const agingBarTotal = useMemo(
    () => (agingSummary?.buckets ?? []).reduce((acc, b) => acc + b.amount, 0),
    [agingSummary?.buckets]
  );

  const buildWidgetHref = useCallback((widgetKey: string, extras?: Record<string, string>) => {
    const params = new URLSearchParams();
    const q = searchTerm.trim();
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const status = searchParams.get("status");
    const age = searchParams.get("age");
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (status) params.set("status", status);
    if (age) params.set("age", age);
    Object.entries(extras || {}).forEach(([k, v]) => {
      if (v) params.set(k, v);
    });
    const suffix = params.toString();
    return `/external-invoices/widgets/${widgetKey}${suffix ? `?${suffix}` : ""}`;
  }, [searchParams, searchTerm]);

  const compactWidgets = useMemo(() => {
    const totalInvoices = metrics?.totalInvoices ?? 0;
    const totalAmount = metrics?.totalAmount ?? 0;
    const average = totalInvoices > 0 ? totalAmount / totalInvoices : 0;
    return [
      {
        key: "total-invoices",
        title: "Total Invoices",
        value: totalInvoices.toLocaleString(),
        subtitle: "All invoices in view",
        icon: FileCheck,
        accentClass: "text-blue-600 dark:text-blue-400",
        glowClass: "bg-blue-500",
        to: buildWidgetHref("total-invoices"),
      },
      {
        key: "total-amount",
        title: "Total Amount",
        value: `$${totalAmount.toLocaleString()}`,
        subtitle: "Gross invoice value",
        icon: DollarSign,
        accentClass: "text-emerald-600 dark:text-emerald-400",
        glowClass: "bg-emerald-500",
        to: buildWidgetHref("total-amount"),
      },
      {
        key: "average-amount",
        title: "Average",
        value: `$${Math.round(average).toLocaleString()}`,
        subtitle: "Average invoice amount",
        icon: Receipt,
        accentClass: "text-violet-600 dark:text-violet-400",
        glowClass: "bg-violet-500",
        to: buildWidgetHref("average-amount"),
      },
      {
        key: "paid",
        title: "Paid",
        value: (metrics?.totalPaid ?? 0).toLocaleString(),
        subtitle: "Paid invoices",
        icon: CheckCircle,
        accentClass: "text-green-600 dark:text-green-400",
        glowClass: "bg-green-500",
        to: buildWidgetHref("paid", { status: "paid" }),
      },
      {
        key: "pending",
        title: "Pending",
        value: (metrics?.totalPending ?? 0).toLocaleString(),
        subtitle: "Pending invoices",
        icon: ClockIcon,
        accentClass: "text-orange-600 dark:text-orange-400",
        glowClass: "bg-orange-500",
        to: buildWidgetHref("pending", { status: "pending" }),
      },
      {
        key: "unpaid",
        title: "Unpaid",
        value: (metrics?.totalUnpaid ?? 0).toLocaleString(),
        subtitle: "Open/unpaid invoices",
        icon: AlertCircle,
        accentClass: "text-amber-600 dark:text-amber-400",
        glowClass: "bg-amber-500",
        to: buildWidgetHref("unpaid", { status: "unpaid" }),
      },
    ];
  }, [buildWidgetHref, metrics?.totalAmount, metrics?.totalInvoices, metrics?.totalPaid, metrics?.totalPending, metrics?.totalUnpaid]);

  const totalInvoices = metrics?.totalInvoices ?? 0;

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex shrink-0 items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Invoice metrics</span>
            </div>
            {metricsCollapsed ? (
              isStatsLoading ? (
                <div className="flex flex-wrap items-center gap-2">
                  {[1, 2, 3, 4].map((i) => (
                    <WidgetSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { label: "Total", value: totalInvoices.toLocaleString(), icon: FileCheck },
                    { label: "Unpaid", value: (metrics?.totalUnpaid ?? 0).toLocaleString(), icon: AlertCircle },
                    { label: "Pending", value: (metrics?.totalPending ?? 0).toLocaleString(), icon: ClockIcon },
                    { label: "Paid", value: (metrics?.totalPaid ?? 0).toLocaleString(), icon: CheckCircle },
                    ...(canViewTotals
                      ? [{ label: "Collected", value: `${Math.round(collectionRate.countRate)}%`, icon: DollarSign }]
                      : []),
                  ].map((item) => (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-2.5 py-1 text-xs"
                    >
                      <item.icon className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-semibold tabular-nums text-foreground">{item.value}</span>
                    </span>
                  ))}
                </div>
              )
            ) : null}
          </div>
          <IconActionButton
            label={metricsCollapsed ? "Show metrics" : "Hide metrics"}
            onClick={() => setMetricsCollapsed((v) => !v)}
            icon={metricsCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          />
        </div>

        {!metricsCollapsed ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {isStatsLoading ? (
                <>
                  <WidgetSkeleton />
                  <WidgetSkeleton />
                  <WidgetSkeleton />
                  <WidgetSkeleton />
                </>
              ) : (
                <>
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 [animation-fill-mode:both] [animation-delay:50ms] transition-transform hover:-translate-y-1 hover:shadow-md rounded-xl">
                    <StatCard
                      label="Total invoices"
                      value={<CountUpNumber value={totalInvoices} />}
                      sublabel="In current filter scope"
                      onClick={() => onQuickFilter("all")}
                      icon={
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
                          <FileCheck className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        </div>
                      }
                      footer={
                        sparkSeries.total.length >= 2 ? (
                          <Sparkline data={sparkSeries.total} strokeClass="stroke-blue-500" />
                        ) : null
                      }
                    />
                  </div>
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 [animation-fill-mode:both] [animation-delay:100ms] transition-transform hover:-translate-y-1 hover:shadow-md rounded-xl">
                    <StatCard
                      label="Unpaid / overdue"
                      value={<CountUpNumber value={metrics?.totalUnpaid ?? 0} />}
                      sublabel={
                        agingSummary?.overdueAmount
                          ? `$${agingSummary.overdueAmount.toLocaleString()} overdue`
                          : "Open balances"
                      }
                      onClick={() => onQuickFilter("overdue")}
                      icon={
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                      }
                      footer={
                        sparkSeries.open.length >= 2 ? (
                          <Sparkline data={sparkSeries.open} strokeClass="stroke-amber-500" />
                        ) : null
                      }
                    />
                  </div>
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 [animation-fill-mode:both] [animation-delay:150ms] transition-transform hover:-translate-y-1 hover:shadow-md rounded-xl">
                    <StatCard
                      label="Pending"
                      value={<CountUpNumber value={metrics?.totalPending ?? 0} />}
                      sublabel="Awaiting payment confirmation"
                      onClick={() => onQuickFilter("pending")}
                      icon={
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                          <ClockIcon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                        </div>
                      }
                    />
                  </div>
                  <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 [animation-fill-mode:both] [animation-delay:200ms] transition-transform hover:-translate-y-1 hover:shadow-md rounded-xl">
                    <StatCard
                      label="Paid"
                      value={<CountUpNumber value={metrics?.totalPaid ?? 0} />}
                      sublabel={
                        totalInvoices > 0
                          ? `${Math.round(((metrics?.totalPaid ?? 0) / totalInvoices) * 100)}% collected`
                          : "Collected invoices"
                      }
                      onClick={() => onQuickFilter("paid")}
                      icon={
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                      }
                      footer={
                        sparkSeries.paid.length >= 2 ? (
                          <Sparkline data={sparkSeries.paid} strokeClass="stroke-emerald-500" />
                        ) : null
                      }
                    />
                  </div>
                </>
              )}
            </div>

            {agingSummary && !isStatsLoading ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="overflow-hidden border-border/70 shadow-sm lg:col-span-2">
                  <CardContent className="space-y-3 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ClockIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Aging breakdown</span>
                        <span className="text-xs text-muted-foreground">open balances by overdue age — click to filter</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="rounded-md border border-border/70 bg-muted/40 px-2 py-1">
                          Avg overdue <strong className="ml-1">{(agingSummary.avgDaysOverdue ?? 0).toFixed(1)}d</strong>
                        </span>
                        <span className="rounded-md border border-amber-200/80 bg-amber-50/80 px-2 py-1 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
                          ${(agingSummary.overdueAmount ?? 0).toLocaleString()} overdue
                        </span>
                      </div>
                    </div>

                    {agingBarTotal > 0 ? (
                      <div className="flex h-9 w-full overflow-hidden rounded-lg border border-border/50 shadow-inner">
                        {AGING_SEGMENTS.map((segment) => {
                          const bucket = agingSummary.buckets.find((b) => b.key === segment.key);
                          const amount = bucket?.amount ?? 0;
                          if (amount <= 0) return null;
                          const widthPercent = (amount / agingBarTotal) * 100;
                          const isActive = ageFilterValue === segment.key;
                          return (
                            <button
                              key={segment.key}
                              type="button"
                              className={`relative h-full transition-all duration-700 ease-out animate-in slide-in-from-left fade-in [animation-duration:1s] ${segment.barClass} ${
                                isActive ? "ring-2 ring-inset ring-foreground/60 z-10 shadow-[0_0_12px_rgba(255,255,255,0.4)] dark:shadow-[0_0_12px_rgba(255,255,255,0.2)]" : ""
                              }`}
                              style={{ width: `${Math.max(widthPercent, 2)}%` }}
                              title={`${segment.label}: ${bucket?.count ?? 0} invoices · $${amount.toLocaleString()}`}
                              onClick={() => onAgeBucketFilter(isActive ? "all" : segment.key)}
                            >
                              {widthPercent > 12 ? (
                                <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white drop-shadow-sm">
                                  {segment.label}
                                </span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex h-9 items-center justify-center rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground">
                        No open balances in the current filter scope
                      </div>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {AGING_SEGMENTS.map((segment) => {
                        const bucket = agingSummary.buckets.find((b) => b.key === segment.key);
                        const isActive = ageFilterValue === segment.key;
                        return (
                          <button
                            key={segment.key}
                            type="button"
                            onClick={() => onAgeBucketFilter(isActive ? "all" : segment.key)}
                            className={`flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-xs transition-colors hover:bg-muted ${
                              isActive ? "bg-muted font-semibold" : "text-muted-foreground"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${segment.dotClass}`} />
                            {segment.label}
                            <span className="tabular-nums">
                              {bucket?.count ?? 0} · ${(bucket?.amount ?? 0).toLocaleString()}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden border-border/70 shadow-sm">
                  <CardContent className="flex items-center gap-4 p-4 sm:p-5">
                    <div className="relative shrink-0 animate-in zoom-in-50 fade-in duration-700 [animation-fill-mode:both] [animation-delay:300ms]">
                      <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] dark:shadow-[0_0_20px_rgba(52,211,153,0.15)] pointer-events-none" />
                      <ProgressRing percent={collectionRate.countRate} />
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold tabular-nums">
                          {Math.round(collectionRate.countRate)}%
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">collected</span>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-1.5">
                      <div className="text-sm font-semibold">Collection rate</div>
                      <div className="text-xs text-muted-foreground">
                        {(metrics?.totalPaid ?? 0).toLocaleString()} of {totalInvoices.toLocaleString()} invoices paid in the current scope
                      </div>
                      {canViewTotals && collectionRate.amountRate !== null ? (
                        <div className="text-xs text-muted-foreground">
                          By value: <strong className="text-foreground">{Math.round(collectionRate.amountRate)}%</strong>{" "}
                          (${Math.round(collectionRate.sumPaidAmount).toLocaleString()} of $
                          {Math.round(collectionRate.sumAmount).toLocaleString()}
                          {trendMonthsLabel ? `, ${trendMonthsLabel}` : ""})
                        </div>
                      ) : null}
                      {sparkSeries.paidAmount.length >= 2 && canViewTotals ? (
                        <div className="pt-1">
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Cash collected trend</div>
                          <Sparkline data={sparkSeries.paidAmount} strokeClass="stroke-emerald-500" />
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-4 sm:grid-cols-3 xl:grid-cols-6">
              {isStatsLoading ? (
                <>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <WidgetSkeleton key={i} />
                  ))}
                </>
              ) : (
                compactWidgets
                  .filter((widget) => canViewTotals || (widget.key !== "total-amount" && widget.key !== "average-amount"))
                  .map((widget, i) => (
                    <InvoiceMetricLink
                      key={widget.key}
                      title={widget.title}
                      value={widget.value}
                      subtitle={widget.subtitle}
                      icon={widget.icon}
                      accentClass={widget.accentClass}
                      glowClass={widget.glowClass}
                      to={widget.to}
                      className={`animate-in slide-in-from-bottom-4 fade-in duration-500 [animation-fill-mode:both]`}
                      style={{ animationDelay: `${200 + i * 50}ms` } as React.CSSProperties}
                    />
                  ))
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
};
