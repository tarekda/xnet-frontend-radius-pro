import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { 
  Activity, 
  Users, 
  Shield, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Download,
  RefreshCw,
  Wifi,
  Globe,
  LineChart as LineChartIcon,
  Loader2,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { 
  useAnalyticsData, 
  useAnalyticsMetrics, 
  useAuthDistribution, 
  useGeographicData, 
  usePeakHoursData,
  getGrowthColor
} from '@/hooks/useAnalytics';
import { useOnlineMetrics } from '@/hooks/useOnlineMetrics';
import { useBandwidthMetrics } from '@/hooks/useBandwidth';
import { useExternalInvoicesTrend, useExternalAgingSummary } from '@/hooks/useInvoices';

const Analytics: React.FC = () => {
  const { t } = useTranslation("screens");
  const [timeRange, setTimeRange] = useState('24h');
  
  // Fetch data using hooks
  const { data: chartData, isLoading: chartLoading, refetch: refetchChart } = useAnalyticsData(timeRange);
  const { data: metrics, isLoading: metricsLoading, refetch: refetchMetrics } = useAnalyticsMetrics();
  const { data: authData, isLoading: authLoading } = useAuthDistribution();
  const { data: geographicData, isLoading: geoLoading } = useGeographicData();
  const { data: peakHoursData, isLoading: peakLoading } = usePeakHoursData();
  const onlineMetrics = useOnlineMetrics();
  const bandwidthQuery = useBandwidthMetrics();

  // Live series for this page (active users + rx/tx rate)
  const [activeUsersSeries, setActiveUsersSeries] = useState<Array<{ time: string; activeUsers: number }>>([]);
  const [bandwidthSeries, setBandwidthSeries] = useState<Array<{ time: string; rx: number; tx: number }>>([]);

  const currentActiveUsers = onlineMetrics.totalActiveUsers ?? 0;

  const currentBandwidth = useMemo(() => {
    const m = bandwidthQuery.data;
    if (!m) return { rx: 0, tx: 0 };
    const iface = Array.isArray(m.interfaces) ? m.interfaces[0] : undefined;
    const rx = Number((iface?.rxRate ?? m.bandwidth.download.rate) || 0);
    const tx = Number((iface?.txRate ?? m.bandwidth.upload.rate) || 0);
    return { rx, tx };
  }, [bandwidthQuery.data]);

  const activeUsersGrowth = useMemo(() => {
    const prev = activeUsersSeries[activeUsersSeries.length - 2]?.activeUsers ?? currentActiveUsers;
    return prev > 0 ? ((currentActiveUsers - prev) / prev) * 100 : 0;
  }, [activeUsersSeries, currentActiveUsers]);

  const rxGrowth = useMemo(() => {
    const prev = bandwidthSeries[bandwidthSeries.length - 2]?.rx ?? currentBandwidth.rx;
    return prev > 0 ? ((currentBandwidth.rx - prev) / prev) * 100 : 0;
  }, [bandwidthSeries, currentBandwidth.rx]);

  const txGrowth = useMemo(() => {
    const prev = bandwidthSeries[bandwidthSeries.length - 2]?.tx ?? currentBandwidth.tx;
    return prev > 0 ? ((currentBandwidth.tx - prev) / prev) * 100 : 0;
  }, [bandwidthSeries, currentBandwidth.tx]);

  useEffect(() => {
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setActiveUsersSeries((prev) => [...prev, { time: label, activeUsers: currentActiveUsers }].slice(-60));
  }, [currentActiveUsers]);

  useEffect(() => {
    if (!bandwidthQuery.data) return;
    const now = new Date();
    const label = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setBandwidthSeries((prev) => [...prev, { time: label, rx: currentBandwidth.rx, tx: currentBandwidth.tx }].slice(-60));
  }, [bandwidthQuery.data, currentBandwidth.rx, currentBandwidth.tx]);

  // Revenue tab data
  const [revenueTrendMonths, setRevenueTrendMonths] = useState(6);
  const trendQuery = useExternalInvoicesTrend(revenueTrendMonths);
  const agingQuery = useExternalAgingSummary();

  const revenueTrendData = useMemo(() => {
    if (!trendQuery.data) return [];
    return trendQuery.data.map(pt => ({
      name: pt.month,
      Billed: Number(pt.totalAmount),
      Collected: Number(pt.paidAmount),
    }));
  }, [trendQuery.data]);

  const agingBuckets = useMemo(() => {
    const LABELS: Record<string, string> = {
      current: 'Current', '1_30': '1–30d', '31_60': '31–60d', '61_90': '61–90d', '90_plus': '90d+',
    };
    const COLORS: Record<string, string> = {
      current: '#10b981', '1_30': '#f59e0b', '31_60': '#f97316', '61_90': '#ef4444', '90_plus': '#7c3aed',
    };
    return (agingQuery.data?.buckets ?? []).map(b => ({
      name: LABELS[b.key] ?? b.key,
      Amount: Number(b.amount),
      Count: b.count,
      fill: COLORS[b.key] ?? '#94a3b8',
    }));
  }, [agingQuery.data]);

  const handleRefresh = () => {
    refetchChart();
    refetchMetrics();
    bandwidthQuery.refetch();
    trendQuery.refetch();
    agingQuery.refetch();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && Array.isArray(payload) && payload.length) {
      return (
        <div className="rounded-lg border border-border bg-card p-3 text-card-foreground shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const LoadingSpinner = () => (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={t("analytics.title")}
        subtitle={t("analytics.subtitle")}
        icon={Activity}
        rightContent={(
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        )}
        actions={(
          <div className="flex items-center gap-2">
            <IconActionButton
              label="Refresh"
              onClick={handleRefresh}
              disabled={chartLoading || metricsLoading}
              icon={<RefreshCw className={`h-4 w-4 ${(chartLoading || metricsLoading) ? 'animate-spin' : ''}`} />}
            />
            <IconActionButton
              label="Export"
              icon={<Download className="h-4 w-4" />}
            />
          </div>
        )}
      />

      {/* Key Metrics */}
      <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Users"
          value={currentActiveUsers.toLocaleString()}
          icon={<Users className="h-4 w-4" />}
          footer={(
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              {activeUsersGrowth >= 0 ? (
                <TrendingUp className={`h-3 w-3 ${getGrowthColor(activeUsersGrowth)}`} />
              ) : (
                <TrendingDown className={`h-3 w-3 ${getGrowthColor(activeUsersGrowth)}`} />
              )}
              <span className={getGrowthColor(activeUsersGrowth)}>
                {activeUsersGrowth > 0 ? "+" : ""}{activeUsersGrowth.toFixed(1)}% vs previous sample
              </span>
            </p>
          )}
        />

        <StatCard
          label="Bandwidth (Rx / Tx)"
          value={bandwidthQuery.isLoading ? "..." : `${currentBandwidth.rx.toFixed(1)} / ${currentBandwidth.tx.toFixed(1)}`}
          sublabel={bandwidthQuery.isLoading ? "Loading..." : "Mbps Rx / Tx"}
          icon={<Wifi className="h-4 w-4" />}
          footer={
            bandwidthQuery.isLoading ? null : (
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  {rxGrowth >= 0 ? <TrendingUp className={`h-3 w-3 ${getGrowthColor(rxGrowth)}`} /> : <TrendingDown className={`h-3 w-3 ${getGrowthColor(rxGrowth)}`} />}
                  <span className={getGrowthColor(rxGrowth)}>{rxGrowth > 0 ? "+" : ""}{rxGrowth.toFixed(1)}% Rx</span>
                </div>
                <div className="flex items-center gap-1">
                  {txGrowth >= 0 ? <TrendingUp className={`h-3 w-3 ${getGrowthColor(txGrowth)}`} /> : <TrendingDown className={`h-3 w-3 ${getGrowthColor(txGrowth)}`} />}
                  <span className={getGrowthColor(txGrowth)}>{txGrowth > 0 ? "+" : ""}{txGrowth.toFixed(1)}% Tx</span>
                </div>
              </div>
            )
          }
        />

        <StatCard
          label="Auth Success Rate"
          value={metricsLoading ? "..." : `${metrics?.authSuccessRate || 0}%`}
          icon={<Shield className="h-4 w-4" />}
          footer={
            metricsLoading ? null : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingUp className={`h-3 w-3 ${getGrowthColor(metrics?.authRateGrowth || 0)}`} />
                <span className={getGrowthColor(metrics?.authRateGrowth || 0)}>
                  {metrics?.authRateGrowth && metrics.authRateGrowth > 0 ? "+" : ""}{metrics?.authRateGrowth || 0}% from last hour
                </span>
              </p>
            )
          }
        />

        <StatCard
          label="Failed Attempts"
          value={metricsLoading ? "..." : (metrics?.failedAttempts || 0)}
          icon={<AlertTriangle className="h-4 w-4" />}
          footer={
            metricsLoading ? null : (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <TrendingDown className={`h-3 w-3 ${getGrowthColor(metrics?.failedAttemptsGrowth || 0)}`} />
                <span className={getGrowthColor(metrics?.failedAttemptsGrowth || 0)}>
                  {metrics?.failedAttemptsGrowth && metrics.failedAttemptsGrowth > 0 ? "+" : ""}{metrics?.failedAttemptsGrowth || 0}% from last hour
                </span>
              </p>
            )
          }
        />
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="usage" className="flex items-center gap-2">
            <LineChartIcon className="h-4 w-4" />
            Usage Trends
          </TabsTrigger>
          <TabsTrigger value="auth" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="geographic" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            By NAS
          </TabsTrigger>
          <TabsTrigger value="peak" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Peak Hours
          </TabsTrigger>
          <TabsTrigger value="revenue" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Revenue
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>User Activity Over Time</CardTitle>
                <CardDescription>Real-time user count and activity patterns</CardDescription>
              </CardHeader>
              <CardContent>
                {activeUsersSeries.length < 2 ? (
                  <LoadingSpinner />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={activeUsersSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="activeUsers" 
                        name="Active Users"
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Bandwidth (Rx / Tx)</CardTitle>
                <CardDescription>Network bandwidth rates over time</CardDescription>
              </CardHeader>
              <CardContent>
                {bandwidthSeries.length < 2 ? (
                  <LoadingSpinner />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={bandwidthSeries}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="rx" 
                        name="Rx (Mbps)"
                        stroke="#2563eb" 
                        fill="#2563eb" 
                        fillOpacity={0.3}
                      />
                      <Area
                        type="monotone"
                        dataKey="tx"
                        name="Tx (Mbps)"
                        stroke="#16a34a"
                        fill="#16a34a"
                        fillOpacity={0.2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="auth" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Authentication Success Rate</CardTitle>
                <CardDescription>Distribution of authentication attempts</CardDescription>
              </CardHeader>
              <CardContent>
                {authLoading ? (
                  <LoadingSpinner />
                ) : authData && Array.isArray(authData) && authData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={authData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {authData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Authentication Trends</CardTitle>
                <CardDescription>Success vs failed authentication over time</CardDescription>
              </CardHeader>
              <CardContent>
                {chartLoading ? (
                  <LoadingSpinner />
                ) : chartData && Array.isArray(chartData) && chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Bar dataKey="authSuccess" fill="#10b981" />
                      <Bar dataKey="authFailed" fill="#ef4444" />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="geographic" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Distribution by NAS</CardTitle>
                <CardDescription>Accepted auths by NAS IP (last 7 days)</CardDescription>
              </CardHeader>
              <CardContent>
                {geoLoading ? (
                  <LoadingSpinner />
                ) : geographicData && Array.isArray(geographicData) && geographicData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={geographicData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, users }) => `${name}: ${users}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="users"
                      >
                        {geographicData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Top NAS by Users</CardTitle>
                <CardDescription>Distinct users with accepted auth per NAS</CardDescription>
              </CardHeader>
              <CardContent>
                {geoLoading ? (
                  <LoadingSpinner />
                ) : geographicData && Array.isArray(geographicData) && geographicData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={geographicData} layout="horizontal">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="users" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <p className="text-muted-foreground">No data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="peak" className="space-y-4">
          <Card className="border-border/80 shadow-none">
            <CardHeader>
              <CardTitle>Peak Usage Hours</CardTitle>
              <CardDescription>System usage patterns throughout the day</CardDescription>
            </CardHeader>
            <CardContent>
              {peakLoading ? (
                <LoadingSpinner />
              ) : peakHoursData && Array.isArray(peakHoursData) && peakHoursData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={peakHoursData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hour" />
                    <YAxis />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="usage" fill="#8b5cf6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64">
                  <p className="text-muted-foreground">No data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="revenue" className="space-y-4">
          {/* Revenue KPI strip */}
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="border-border/80 shadow-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Open Receivables</div>
                  <div className="text-xl font-bold mt-0.5">
                    {agingQuery.isLoading ? '…' : `$${Number(agingQuery.data?.openAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{agingQuery.data?.openInvoices ?? '—'} open invoices</div>
                </div>
                <DollarSign className="h-8 w-8 text-indigo-400 opacity-60" />
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Total Overdue</div>
                  <div className="text-xl font-bold mt-0.5 text-rose-600 dark:text-rose-400">
                    {agingQuery.isLoading ? '…' : `$${Number(agingQuery.data?.overdueAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{agingQuery.data?.overdueInvoices ?? '—'} overdue invoices</div>
                </div>
                <AlertCircle className="h-8 w-8 text-rose-400 opacity-60" />
              </CardContent>
            </Card>
            <Card className="border-border/80 shadow-none">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Overdue Rate</div>
                  <div className="text-xl font-bold mt-0.5">
                    {agingQuery.isLoading ? '…' : `${Number(agingQuery.data?.overdueRatePercent ?? 0).toFixed(1)}%`}
                  </div>
                  <div className="text-[11px] text-muted-foreground">Avg {agingQuery.data?.avgDaysOverdue?.toFixed(0) ?? '—'} days overdue</div>
                </div>
                <TrendingDown className="h-8 w-8 text-amber-400 opacity-60" />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Revenue vs Collections Trend */}
            <Card className="border-border/80 shadow-none">
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle>Revenue vs Collections</CardTitle>
                  <CardDescription>Monthly billed amount vs actual cash collected</CardDescription>
                </div>
                <Select value={String(revenueTrendMonths)} onValueChange={v => setRevenueTrendMonths(Number(v))}>
                  <SelectTrigger className="w-[110px] h-7 text-xs" id="analytics-revenue-months">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 months</SelectItem>
                    <SelectItem value="6">6 months</SelectItem>
                    <SelectItem value="12">12 months</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent>
                {trendQuery.isLoading ? (
                  <LoadingSpinner />
                ) : revenueTrendData.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>No billing data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revBilledGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="revCollectedGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} tickFormatter={v => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="Billed" stroke="#6366f1" strokeWidth={2} fill="url(#revBilledGrad)" fillOpacity={1} />
                      <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={2} fill="url(#revCollectedGrad)" fillOpacity={1} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Aging Buckets */}
            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle>Accounts Receivable Aging</CardTitle>
                <CardDescription>Outstanding overdue balances by age bracket</CardDescription>
              </CardHeader>
              <CardContent>
                {agingQuery.isLoading ? (
                  <LoadingSpinner />
                ) : agingBuckets.length === 0 ? (
                  <div className="flex items-center justify-center h-64 text-muted-foreground">
                    <p>No aging data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={agingBuckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={11} tickLine={false} tickFormatter={v => `$${Number(v).toLocaleString('en-US', { notation: 'compact' })}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                        formatter={(v: any, _n, props) => [`$${Number(v).toFixed(2)} (${props.payload?.Count} inv.)`, 'Overdue']}
                      />
                      <Bar dataKey="Amount" radius={[4, 4, 0, 0]}>
                        {agingBuckets.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Debtors */}
          {(agingQuery.data?.topDebtors ?? []).length > 0 && (
            <Card className="border-border/80 shadow-none">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                  Top Debtors
                </CardTitle>
                <CardDescription>Subscribers with the highest outstanding balances</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
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
                    {(agingQuery.data?.topDebtors ?? []).map((d, i) => (
                      <tr key={d.username} className={`border-b border-border/60 hover:bg-muted/30 ${i % 2 !== 0 ? 'bg-muted/10' : ''}`}>
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{d.fullName || d.username}</div>
                          <div className="text-xs text-muted-foreground font-mono">{d.username}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right text-muted-foreground">{d.invoices}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-rose-600 dark:text-rose-400">
                          ${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                            d.maxOverdueDays > 60
                              ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                              : d.maxOverdueDays > 30
                              ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                          }`}>{d.maxOverdueDays}d</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Analytics;