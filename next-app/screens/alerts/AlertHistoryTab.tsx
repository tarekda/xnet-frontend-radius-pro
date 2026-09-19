import React from "react";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import QueryState from "@/components/QueryState";
import { getSeverityColor, getSeverityBgColor } from "@/hooks/useAlerts";
import type { Alert } from "@/types/alerts";
import LoadingSpinner from "./LoadingSpinner";

type Props = {
  alerts: Alert[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
};

const AlertHistoryTab: React.FC<Props> = ({ alerts, isLoading, error, onRetry }) => {
  const rows = Array.isArray(alerts) ? alerts : [];

  return (
    <QueryState
      isLoading={isLoading}
      error={error as Error | undefined}
      isEmpty={!isLoading && !error && rows.length === 0}
      onRetry={onRetry}
      loading={<LoadingSpinner />}
      errorTitle="Failed to load alert history"
      emptyTitle="No resolved alerts yet"
      emptyDescription="Acknowledged and resolved incidents will show up here."
    >
      <div className="space-y-4">
        {rows.map((alert) => (
          <Card key={alert.id} className="border-border/80 shadow-none">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <div className={`p-2 rounded-full ${getSeverityBgColor(alert.severity)}`}>
                    <Clock className={`h-4 w-4 ${getSeverityColor(alert.severity)}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{alert.ruleName}</CardTitle>
                    <CardDescription>{alert.message}</CardDescription>
                  </div>
                </div>
                <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                  {alert.severity}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Value:</span>
                  <p className="text-muted-foreground">{alert.value}</p>
                </div>
                <div>
                  <span className="font-medium">Threshold:</span>
                  <p className="text-muted-foreground">{alert.threshold}</p>
                </div>
                <div>
                  <span className="font-medium">Triggered:</span>
                  <p className="text-muted-foreground">
                    {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Resolved:</span>
                  <p className="text-muted-foreground">
                    {alert.resolvedAt
                      ? formatDistanceToNow(alert.resolvedAt, { addSuffix: true })
                      : "—"}
                  </p>
                </div>
              </div>
              {alert.acknowledgedBy && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Acknowledged by {alert.acknowledgedBy}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </QueryState>
  );
};

export default AlertHistoryTab;
