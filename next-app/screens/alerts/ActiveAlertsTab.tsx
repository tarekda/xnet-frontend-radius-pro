import React, { useState } from "react";
import { AlertTriangle, CheckCircle, Loader2, XCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import SearchBar from "@/components/SearchBar";
import FiltersBar from "@/components/FiltersBar";
import QueryState from "@/components/QueryState";
import { getSeverityColor, getSeverityBgColor } from "@/hooks/useAlerts";
import type { Alert } from "@/types/alerts";
import LoadingSpinner from "./LoadingSpinner";

type Props = {
  alerts: Alert[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onAcknowledge: (id: string) => void;
  acknowledgePending: boolean;
  onResolve: (id: string) => void;
  resolvePending: boolean;
};

/** "Active Alerts" tab: search/severity/status filters plus alert cards with ack/resolve actions. */
const ActiveAlertsTab: React.FC<Props> = ({
  alerts,
  isLoading,
  error,
  onRetry,
  onAcknowledge,
  acknowledgePending,
  onResolve,
  resolvePending,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredAlerts = alerts && Array.isArray(alerts)
    ? alerts.filter(alert => {
        const matchesSearch = alert.ruleName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             alert.message.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter;
        const matchesStatus = statusFilter === 'all' || 
                             (statusFilter === 'active' && !alert.resolved) ||
                             (statusFilter === 'resolved' && alert.resolved);
        
        return matchesSearch && matchesSeverity && matchesStatus;
      })
    : [];

  return (
    <>
      <FiltersBar
        left={
          <>
            <div className="w-full md:w-72">
              <SearchBar
                currentSearchTerm={searchTerm}
                onSearch={(term) => setSearchTerm(term)}
                placeholder="Search alerts..."
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
      />

      <QueryState
        isLoading={isLoading}
        error={error as any}
        isEmpty={!isLoading && !error && filteredAlerts.length === 0}
        onRetry={onRetry}
        loading={<LoadingSpinner />}
        errorTitle="Failed to load alerts"
        emptyTitle="No alerts found"
        emptyDescription="Try adjusting your filters, or check back later."
      >
        <div className="space-y-4">
          {filteredAlerts.map((alert) => (
            <Card key={alert.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${getSeverityBgColor(alert.severity)}`}>
                      <AlertTriangle className={`h-4 w-4 ${getSeverityColor(alert.severity)}`} />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{alert.ruleName}</CardTitle>
                      <CardDescription>{alert.message}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                      {alert.severity}
                    </Badge>
                    {alert.acknowledged && (
                      <Badge variant="secondary">
                        Acknowledged
                      </Badge>
                    )}
                    {alert.resolved && (
                      <Badge variant="default">
                        Resolved
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
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
                    <span className="font-medium">Status:</span>
                    <p className="text-muted-foreground">
                      {alert.resolved ? 'Resolved' : alert.acknowledged ? 'Acknowledged' : 'Active'}
                    </p>
                  </div>
                </div>
                
                {!alert.resolved && (
                  <div className="flex items-center gap-2">
                    {!alert.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onAcknowledge(alert.id)}
                        disabled={acknowledgePending}
                      >
                        {acknowledgePending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle className="mr-2 h-4 w-4" />
                        )}
                        Acknowledge
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onResolve(alert.id)}
                      disabled={resolvePending}
                    >
                      {resolvePending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      Resolve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </QueryState>
    </>
  );
};

export default ActiveAlertsTab;
