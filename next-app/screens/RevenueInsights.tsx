"use client";

import { useEffect, useState, useMemo } from "react";
import PageHeader from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { notify } from "@/lib/notify";
import {
  DollarSign,
  TrendingUp,
  CreditCard,
  Users,
  Download,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieIcon,
  ShieldCheck,
  Receipt,
  Wallet,
} from "lucide-react";
import { fetchRevenueInsights, type RevenueInsightsDto } from "@/api/analytics";

export default function RevenueInsights() {
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<RevenueInsightsDto | null>(null);

  const loadData = async (m = months) => {
    setLoading(true);
    try {
      const res = await fetchRevenueInsights(m);
      setData(res);
    } catch (e: any) {
      notify.error("Failed to load revenue insights", e?.message || "Could not fetch revenue analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(months);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months]);

  const handleExportCsv = () => {
    if (!data?.monthlyTrends) return;
    const header = "Month,Invoiced ($),Collected ($),Expenses ($),Net Profit ($)\n";
    const rows = data.monthlyTrends
      .map((r) => `"${r.month}",${r.invoiced.toFixed(2)},${r.collected.toFixed(2)},${r.expenses.toFixed(2)},${r.netProfit.toFixed(2)}`)
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `revenue_insights_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify.success("Exported", "Financial trend exported as CSV");
  };

  const summary = data?.summary;

  // Max value calculation for financial chart bars
  const maxBarValue = useMemo(() => {
    if (!data?.monthlyTrends?.length) return 1000;
    const max = Math.max(
      ...data.monthlyTrends.map((t) => Math.max(t.invoiced, t.collected, t.expenses, Math.abs(t.netProfit)))
    );
    return max > 0 ? max * 1.15 : 1000;
  }, [data]);

  return (
    <div className="w-full space-y-6 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          title="Revenue & Profit Insights"
          subtitle="Enterprise ISP billing analytics, collection efficiency, ARPU, and cash flow reconciliation"
        />
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border text-xs">
            {[3, 6, 12].map((m) => (
              <button
                key={m}
                onClick={() => setMonths(m)}
                className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                  months === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m} Months
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => loadData()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button variant="default" size="sm" onClick={handleExportCsv} disabled={!data}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Gross Invoiced</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(summary?.grossInvoiced ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className="font-mono font-medium text-foreground">
                ${(summary?.outstandingDue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span>outstanding balance</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collected Cash</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${(summary?.collectedCash ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-semibold">
                <ArrowUpRight className="h-3.5 w-3.5 mr-0.5" />
                {summary?.collectionRate ?? 0}%
              </div>
              <span className="text-muted-foreground">collection realization rate</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Net Operating Margin</span>
            <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(summary?.netMargin ?? 0) >= 0 ? "text-sky-600 dark:text-sky-400" : "text-rose-600"}`}>
              ${(summary?.netMargin ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span>Expenses:</span>
              <span className="font-mono text-foreground">${(summary?.totalExpenses ?? 0).toFixed(2)}</span>
              <span className="text-sky-600 dark:text-sky-400 font-medium">({summary?.marginPct ?? 0}% margin)</span>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-border/60">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Subscriber ARPU</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(summary?.arpu ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{summary?.activeSubscribers ?? 0}</span>
              <span>active paying subscribers</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Financial Performance Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Monthly Cash Flow & Profit Performance</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Comparison of Gross Invoiced, Realized Collections, Operating Expenses, and Net Profit
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-blue-500" />
              <span>Invoiced</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-emerald-500" />
              <span>Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-rose-400" />
              <span>Expenses</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-3 w-3 rounded bg-sky-500" />
              <span>Net Profit</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-24 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <RefreshCw className="h-5 w-5 animate-spin" /> Loading financial metrics...
            </div>
          ) : !data?.monthlyTrends?.length ? (
            <div className="py-24 text-center text-muted-foreground text-sm">
              No financial data available for this range.
            </div>
          ) : (
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.monthlyTrends.map((t) => {
                  const invHeight = Math.min(100, Math.round((t.invoiced / maxBarValue) * 100));
                  const colHeight = Math.min(100, Math.round((t.collected / maxBarValue) * 100));
                  const expHeight = Math.min(100, Math.round((t.expenses / maxBarValue) * 100));
                  const netHeight = Math.min(100, Math.round((Math.max(0, t.netProfit) / maxBarValue) * 100));

                  return (
                    <div
                      key={t.month}
                      className="p-3.5 rounded-xl border bg-card/70 hover:bg-muted/30 transition-all flex flex-col justify-between"
                    >
                      <div className="text-center font-semibold text-xs text-foreground mb-3">{t.month}</div>
                      
                      {/* Bar Visualization */}
                      <div className="h-28 flex items-end justify-center gap-1.5 py-1 border-b border-muted">
                        <div
                          title={`Invoiced: $${t.invoiced.toFixed(2)}`}
                          style={{ height: `${Math.max(6, invHeight)}%` }}
                          className="w-3.5 bg-blue-500 rounded-t transition-all"
                        />
                        <div
                          title={`Collected: $${t.collected.toFixed(2)}`}
                          style={{ height: `${Math.max(6, colHeight)}%` }}
                          className="w-3.5 bg-emerald-500 rounded-t transition-all"
                        />
                        <div
                          title={`Expenses: $${t.expenses.toFixed(2)}`}
                          style={{ height: `${Math.max(6, expHeight)}%` }}
                          className="w-3.5 bg-rose-400 rounded-t transition-all"
                        />
                        <div
                          title={`Net Profit: $${t.netProfit.toFixed(2)}`}
                          style={{ height: `${Math.max(6, netHeight)}%` }}
                          className="w-3.5 bg-sky-500 rounded-t transition-all"
                        />
                      </div>

                      {/* Detail Metrics */}
                      <div className="mt-3 space-y-1 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Invoiced:</span>
                          <span className="font-mono font-medium">${t.invoiced.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Collected:</span>
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">${t.collected.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expenses:</span>
                          <span className="font-mono text-rose-600 dark:text-rose-400">${t.expenses.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t font-semibold">
                          <span>Profit:</span>
                          <span className={`font-mono ${t.netProfit >= 0 ? "text-sky-600 dark:text-sky-400" : "text-rose-600"}`}>
                            ${t.netProfit.toFixed(0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Two Column Section: Status Breakdown & Top Enterprise Spenders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Breakdown Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-muted-foreground" />
              Invoice Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!data?.statusBreakdown?.length ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No invoices recorded.</div>
            ) : (
              data.statusBreakdown.map((item) => {
                const totalInvoiced = summary?.grossInvoiced || 1;
                const pct = Math.round((item.totalAmount / totalInvoiced) * 100);
                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="font-medium capitalize">{item.status}</span>
                        <span className="text-muted-foreground">({item.count})</span>
                      </div>
                      <span className="font-mono font-semibold">${item.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${Math.max(4, pct)}%`, backgroundColor: item.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Top Spenders Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
              Top Enterprise & VIP Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Subscriber</TableHead>
                  <TableHead className="text-xs text-center">Invoices</TableHead>
                  <TableHead className="text-xs text-right">Total Billed</TableHead>
                  <TableHead className="text-xs text-right">Cash Paid</TableHead>
                  <TableHead className="text-xs text-right">Payment Reliability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!data?.topSpenders?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                      No subscriber spending records found.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.topSpenders.map((s) => {
                    const ratio = s.totalBilled > 0 ? Math.round((s.totalPaid / s.totalBilled) * 100) : 100;
                    return (
                      <TableRow key={s.username}>
                        <TableCell className="py-2.5">
                          <div className="font-semibold text-xs text-foreground">{s.fullName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">@{s.username}</div>
                        </TableCell>
                        <TableCell className="py-2.5 text-center text-xs font-mono">{s.invoicesCount}</TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-medium text-xs">
                          ${s.totalBilled.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                          ${s.totalPaid.toFixed(2)}
                        </TableCell>
                        <TableCell className="py-2.5 text-right">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                              ratio >= 90
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : ratio >= 50
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                            }`}
                          >
                            {ratio}% Paid
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
