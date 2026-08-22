import React from "react";
import { AlertTriangle, Bell, Clock } from "lucide-react";
import StatCard from "@/components/StatCard";
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
  const rules = Array.isArray(alertRules) ? alertRules : [];
  const alertRows = Array.isArray(alerts) ? alerts : [];
  const activeAlerts = alertRows.filter((a) => !a.resolved);
  const quietLabel = settingsLoading
    ? "..."
    : settings
      ? (isInQuietHours(settings) ? "Active" : "Inactive")
      : "Disabled";

  return (
    <div className="grid gap-2.5 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Total Rules"
        value={rulesLoading ? "..." : rules.length}
        sublabel={`${rules.filter((r) => r.enabled).length} active`}
        icon={<Bell className="h-4 w-4" />}
      />
      <StatCard
        label="Active Alerts"
        value={alertsLoading ? "..." : activeAlerts.length}
        sublabel={`${alertRows.filter((a) => !a.acknowledged && !a.resolved).length} unacknowledged`}
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <StatCard
        label="Critical Alerts"
        value={alertsLoading ? "..." : alertRows.filter((a) => a.severity === "critical" && !a.resolved).length}
        sublabel="Require immediate attention"
        icon={<AlertTriangle className="h-4 w-4" />}
      />
      <StatCard
        label="Quiet Hours"
        value={quietLabel}
        sublabel={settings?.quietHours?.enabled ? `${settings.quietHours.startTime} - ${settings.quietHours.endTime}` : "Disabled"}
        icon={<Clock className="h-4 w-4" />}
      />
    </div>
  );
};

export default AlertStatsCards;
