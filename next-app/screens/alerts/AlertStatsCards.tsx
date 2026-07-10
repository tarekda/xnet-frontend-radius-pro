import React from "react";
import { AlertTriangle, Bell, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isInQuietHours } from "@/hooks/useAlerts";
import type { Alert, AlertRule, AlertSettings } from "@/types/alerts";

type Props = {
  alertRules: AlertRule[] | undefined;
  rulesLoading: boolean;
  alerts: Alert[] | undefined;
  alertsLoading: boolean;
  settings: AlertSettings | undefined;
  settingsLoading: boolean;
};

/** Top row of stat cards: rule counts, active/critical alerts, quiet-hours state. */
const AlertStatsCards: React.FC<Props> = ({
  alertRules,
  rulesLoading,
  alerts,
  alertsLoading,
  settings,
  settingsLoading,
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
          <Bell className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-blue-600">
            {rulesLoading ? '...' : (alertRules && Array.isArray(alertRules) ? alertRules.length : 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {alertRules && Array.isArray(alertRules) ? alertRules.filter(r => r.enabled).length : 0} active
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {alertsLoading ? '...' : (alerts && Array.isArray(alerts) ? alerts.filter(a => !a.resolved).length : 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            {alerts && Array.isArray(alerts) ? alerts.filter(a => !a.acknowledged && !a.resolved).length : 0} unacknowledged
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Alerts</CardTitle>
          <AlertTriangle className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {alertsLoading ? '...' : (alerts && Array.isArray(alerts) ? alerts.filter(a => a.severity === 'critical' && !a.resolved).length : 0)}
          </div>
          <p className="text-xs text-muted-foreground">
            Require immediate attention
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Quiet Hours</CardTitle>
          <Clock className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-purple-600">
            {settingsLoading ? '...' : (settings ? (isInQuietHours(settings) ? 'Active' : 'Inactive') : 'Disabled')}
          </div>
          <p className="text-xs text-muted-foreground">
            {settings?.quietHours?.enabled ? `${settings.quietHours.startTime} - ${settings.quietHours.endTime}` : 'Disabled'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AlertStatsCards;
