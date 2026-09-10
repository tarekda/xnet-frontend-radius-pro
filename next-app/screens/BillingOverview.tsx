"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
} from 'recharts';
import {
  DollarSign, Users, TrendingUp, TrendingDown, CreditCard,
  AlertCircle, RefreshCw, Loader2, BarChart2, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useExternalInvoicesTrend, useExternalAgingSummary, useCollectedMetrics } from '@/hooks/useInvoices';
import PageHeader from '@/components/PageHeader';
import IconActionButton from '@/components/IconActionButton';

const AGING_COLORS: Record<string, string> = {
  current:  '#10b981',
  '1_30':   '#f59e0b',
  '31_60':  '#f97316',
  '61_90':  '#ef4444',
  '90_plus':'#7c3aed',
};

const AGING_LABELS: Record<string, string> = {
  current:  'Current',
  '1_30':   '1–30 days',
  '31_60':  '31–60 days',
  '61_90':  '61–90 days',
  '90_plus':'90+ days',
};

const fmt = (n: number | undefined | null) =>
  n == null ? '—' : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (n: number | undefined | null) =>
  n == null ? '—' : `${Number(n).toFixed(1)}%`;

function KpiCard({
  label,
  value,
  sublabel,
  icon,
  color,
  trend,
  trendLabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | null;
  trendLabel?: string;
}) {
  return (
    <Card className={`overflow-hidden relative group border-none shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br ${color} to-transparent`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-foreground/80">{label}</CardTitle>
        <div className="h-8 w-8 rounded-full bg-background/30 flex items-center justify-center">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
        {trendLabel && (
          <p className={`text-xs font-medium flex items-center mt-1 gap-1 ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-rose-500' : 'text-muted-foreground'}`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
            {trendLabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-xl text-sm">
      <p className="font-semibold mb-1.5">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} style={{ color: entry.color }} className="flex justify-between gap-4">
          <span>{entry.name}</span>
          <span className="font-medium">${Number(entry.value).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </p>
      ))}
    </div>
  );
};

export default function BillingOverview() {
  const [trendMonths, setTrendMonths] = useState(6);

  const trendQuery    = useExternalInvoicesTrend(trendMonths);
  const agingQuery    = useExternalAgingSummary();
  const collectedQuery = useCollectedMetrics();

  const isLoading = trendQuery.isLoading || agingQuery.isLoading || collectedQuery.isLoading;

  const trendData = useMemo(() => {
    if (!trendQuery.data) return [];
    return trendQuery.data.map(pt => ({
      name: pt.month,
      Billed: Number(pt.totalAmount),
      Collected: Number(pt.paidAmount),
    }));
  }, [trendQuery.data]);

  const agingBuckets = useMemo(() => {
    if (!agingQuery.data?.buckets) return [];
    return agingQuery.data.buckets.map(b => ({
      name: AGING_LABELS[b.key] ?? b.key,
      Amount: Number(b.amount),
      Count: b.count,
      key: b.key,
    }));
  }, [agingQuery.data]);

  const topDebtors = agingQuery.data?.topDebtors ?? [];

  // KPI values from real API
  const totalOpen       = agingQuery.data?.openAmount ?? null;
  const totalOverdue    = agingQuery.data?.overdueAmount ?? null;
  const overdueRate     = agingQuery.data?.overdueRatePercent ?? null;
  const totalCollected  = collectedQuery.data?.totalCashCollected ?? null;
  const openInvoices    = agingQuery.data?.openInvoices ?? null;
  const overdueInvoices = agingQuery.data?.overdueInvoices ?? null;

  const handleRefresh = () => {
    trendQuery.refetch();
    agingQuery.refetch();
    collectedQuery.refetch();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 320, damping: 26 } },
  };

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Billing Overview"
        subtitle="Live revenue, collection rates, and accounts receivable aging"
        icon={BarChart2}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(trendMonths)} onValueChange={v => setTrendMonths(Number(v))}>
              <SelectTrigger className="w-[130px]" id="billing-trend-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">Last 3 months</SelectItem>
                <SelectItem value="6">Last 6 months</SelectItem>
                <SelectItem value="12">Last 12 months</SelectItem>
              </SelectContent>
            </Select>
            <IconActionButton
              label="Refresh"
              onClick={handleRefresh}
              disabled={isLoading}
              icon={<RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />}
            />
          </div>
        }
      />

      {/* KPI Cards */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={itemVariants}>
          <KpiCard
            label="Total Open Receivables"
            value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(totalOpen)}
            sublabel={openInvoices != null ? `${openInvoices} open invoices` : undefined}
            icon={<DollarSign className="h-4 w-4 text-indigo-500" />}
            color="from-indigo-500/10 via-purple-500/5"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KpiCard
            label="Total Cash Collected"
            value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(totalCollected)}
            sublabel={collectedQuery.data?.totalCollectedInvoices != null
              ? `${collectedQuery.data.totalCollectedInvoices} invoices collected`
              : undefined}
            icon={<CreditCard className="h-4 w-4 text-emerald-500" />}
            color="from-emerald-500/10 via-teal-500/5"
            trend="up"
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KpiCard
            label="Overdue Amount"
            value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmt(totalOverdue)}
            sublabel={overdueInvoices != null ? `${overdueInvoices} overdue invoices` : undefined}
            icon={<AlertCircle className="h-4 w-4 text-rose-500" />}
            color="from-rose-500/10 via-pink-500/5"
            trend={overdueRate != null && overdueRate > 20 ? 'down' : null}
          />
        </motion.div>

        <motion.div variants={itemVariants}>
          <KpiCard
            label="Overdue Rate"
            value={isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : fmtPct(overdueRate)}
            sublabel={agingQuery.data?.avgDaysOverdue != null
              ? `Avg ${agingQuery.data.avgDaysOverdue.toFixed(0)} days overdue`
              : undefined}
            icon={<Clock className="h-4 w-4 text-amber-500" />}
            color="from-amber-500/10 via-yellow-500/5"
            trend={overdueRate != null && overdueRate > 25 ? 'down' : overdueRate != null && overdueRate < 10 ? 'up' : null}
            trendLabel={overdueRate != null && overdueRate > 25 ? 'Elevated — check dunning' : undefined}
          />
        </motion.div>
      </motion.div>

      {/* Revenue vs Collections Chart + Aging */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        {/* Revenue Trend Chart */}
        <motion.div
          className="col-span-4"
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
        >
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader>
              <CardTitle>Revenue vs Collections</CardTitle>
              <CardDescription>Monthly billed amount compared to actual collected cash.</CardDescription>
            </CardHeader>
            <CardContent className="pl-2">
              {trendQuery.isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : trendData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                  <BarChart2 className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No billing data available yet.</p>
                </div>
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="billedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="collectedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={v => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="Billed"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#billedGrad)"
                      />
                      <Area
                        type="monotone"
                        dataKey="Collected"
                        stroke="#10b981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#collectedGrad)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Aging Buckets + Top Debtors */}
        <motion.div
          className="col-span-3"
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.35, duration: 0.45 }}
        >
          <Card className="shadow-sm border-border/50 h-full">
            <CardHeader>
              <CardTitle>Accounts Receivable Aging</CardTitle>
              <CardDescription>Outstanding overdue amounts by age bracket.</CardDescription>
            </CardHeader>
            <CardContent>
              {agingQuery.isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : agingBuckets.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">No aging data available.</p>
                </div>
              ) : (
                <>
                  <div className="h-[190px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={agingBuckets} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} stroke="hsl(var(--muted-foreground))" />
                        <YAxis
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          stroke="hsl(var(--muted-foreground))"
                          tickFormatter={v => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any, _name, props) => [`$${Number(v).toFixed(2)} (${props.payload?.Count ?? 0} inv.)`, 'Overdue']}
                        />
                        <Bar dataKey="Amount" radius={[4, 4, 0, 0]}>
                          {agingBuckets.map(entry => (
                            <Cell key={entry.key} fill={AGING_COLORS[entry.key] ?? '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Bucket legend pills */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {agingBuckets.map(b => (
                      <Badge
                        key={b.key}
                        variant="outline"
                        className="text-[10px] font-medium gap-1.5"
                        style={{ borderColor: AGING_COLORS[b.key] + '50', color: AGING_COLORS[b.key] }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: AGING_COLORS[b.key] }} />
                        {b.name}: {b.Count} inv.
                      </Badge>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Top Debtors Table */}
      {topDebtors.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.45 }}
        >
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                Top Debtors
              </CardTitle>
              <CardDescription>Subscribers with the highest outstanding balances.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Subscriber</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Invoices</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Outstanding</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground">Max Days Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDebtors.map((d, i) => (
                      <tr
                        key={d.username}
                        className={`border-b border-border/60 transition-colors hover:bg-muted/30 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{d.fullName || d.username}</div>
                          <div className="text-xs text-muted-foreground font-mono">{d.username}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{d.invoices}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                          {fmt(d.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge
                            variant="outline"
                            className={`text-xs ${d.maxOverdueDays > 60 ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' : d.maxOverdueDays > 30 ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-muted text-muted-foreground'}`}
                          >
                            {d.maxOverdueDays}d
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
