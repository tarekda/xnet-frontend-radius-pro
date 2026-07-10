import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from "react-i18next";
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
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
  Loader2
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

  const handleRefresh = () => {
    refetchChart();
    refetchMetrics();
    bandwidthQuery.refetch();
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
    <div className="w-full space-y-6 p-6">
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <>
              <div className="text-2xl font-bold text-blue-600">
                {currentActiveUsers.toLocaleString()}
              </div>
              <p className={`text-xs text-muted-foreground flex items-center gap-1`}>
                {activeUsersGrowth >= 0 ? (
                  <TrendingUp className={`h-3 w-3 ${getGrowthColor(activeUsersGrowth)}`} />
                ) : (
                  <TrendingDown className={`h-3 w-3 ${getGrowthColor(activeUsersGrowth)}`} />
                )}
                <span className={getGrowthColor(activeUsersGrowth)}>
                  {activeUsersGrowth > 0 ? '+' : ''}{activeUsersGrowth.toFixed(1)}% vs previous sample
                </span>
              </p>
            </>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth (Rx / Tx)</CardTitle>
            <Wifi className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {bandwidthQuery.isLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-blue-600">
                    Rx: {currentBandwidth.rx.toFixed(1)} Mbps
                  </div>
                  <div className="text-lg font-bold text-green-600">
                    Tx: {currentBandwidth.tx.toFixed(1)} Mbps
                  </div>
                </div>
                <div className="mt-1 flex flex-col gap-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    {rxGrowth >= 0 ? <TrendingUp className={`h-3 w-3 ${getGrowthColor(rxGrowth)}`} /> : <TrendingDown className={`h-3 w-3 ${getGrowthColor(rxGrowth)}`} />}
                    <span className={getGrowthColor(rxGrowth)}>{rxGrowth > 0 ? '+' : ''}{rxGrowth.toFixed(1)}% Rx</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {txGrowth >= 0 ? <TrendingUp className={`h-3 w-3 ${getGrowthColor(txGrowth)}`} /> : <TrendingDown className={`h-3 w-3 ${getGrowthColor(txGrowth)}`} />}
                    <span className={getGrowthColor(txGrowth)}>{txGrowth > 0 ? '+' : ''}{txGrowth.toFixed(1)}% Tx</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auth Success Rate</CardTitle>
            <Shield className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-purple-600">
                  {metrics?.authSuccessRate || 0}%
                </div>
                <p className={`text-xs text-muted-foreground flex items-center gap-1`}>
                  <TrendingUp className={`h-3 w-3 ${getGrowthColor(metrics?.authRateGrowth || 0)}`} />
                  <span className={getGrowthColor(metrics?.authRateGrowth || 0)}>
                    {metrics?.authRateGrowth && metrics.authRateGrowth > 0 ? '+' : ''}{metrics?.authRateGrowth || 0}% from last hour
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Attempts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="flex items-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-red-600">
                  {metrics?.failedAttempts || 0}
                </div>
                <p className={`text-xs text-muted-foreground flex items-center gap-1`}>
                  <TrendingDown className={`h-3 w-3 ${getGrowthColor(metrics?.failedAttemptsGrowth || 0)}`} />
                  <span className={getGrowthColor(metrics?.failedAttemptsGrowth || 0)}>
                    {metrics?.failedAttemptsGrowth && metrics.failedAttemptsGrowth > 0 ? '+' : ''}{metrics?.failedAttemptsGrowth || 0}% from last hour
                  </span>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
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
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
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

            <Card>
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
            <Card>
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

            <Card>
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
            <Card>
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

            <Card>
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
          <Card>
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
      </Tabs>
    </div>
  );
};

export default Analytics;