import React from "react";
import { Bell, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import QueryState from "@/components/QueryState";
import { getSeverityColor, getSeverityBgColor } from "@/hooks/useAlerts";
import { ALERT_CONDITIONS, type AlertRule } from "@/types/alerts";
import LoadingSpinner from "./LoadingSpinner";

type Props = {
  alertRules: AlertRule[] | undefined;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  onEditRule: (rule: AlertRule) => void;
  onDeleteRule: (id: string) => void;
};

/** "Alert Rules" tab: rule cards with edit and delete actions. */
const AlertRulesTab: React.FC<Props> = ({
  alertRules,
  isLoading,
  error,
  onRetry,
  onEditRule,
  onDeleteRule,
}) => {
  return (
    <QueryState
      isLoading={isLoading}
      error={error as any}
      isEmpty={!isLoading && !error && (!alertRules || !Array.isArray(alertRules) || alertRules.length === 0)}
      onRetry={onRetry}
      loading={<LoadingSpinner />}
      errorTitle="Failed to load alert rules"
      emptyTitle="No alert rules yet"
      emptyDescription="Create your first rule to start monitoring metrics."
    >
      <div className="grid gap-4">
        {(alertRules && Array.isArray(alertRules) ? alertRules : []).map((rule) => (
          <Card key={rule.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${getSeverityBgColor(rule.severity)}`}>
                    <Bell className={`h-4 w-4 ${getSeverityColor(rule.severity)}`} />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{rule.name}</CardTitle>
                    <CardDescription>{rule.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={rule.enabled ? "default" : "secondary"}>
                    {rule.enabled ? "Active" : "Disabled"}
                  </Badge>
                  <Badge variant="outline" className={getSeverityColor(rule.severity)}>
                    {rule.severity}
                  </Badge>
                  <Button variant="ghost" size="sm" onClick={() => onEditRule(rule)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Alert Rule</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete &quot;{rule.name}&quot;? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDeleteRule(rule.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Metric:</span>
                  <p className="text-muted-foreground">{rule.metric.label}</p>
                </div>
                <div>
                  <span className="font-medium">Condition:</span>
                  <p className="text-muted-foreground">
                    {ALERT_CONDITIONS.find(c => c.value === rule.condition)?.label}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Threshold:</span>
                  <p className="text-muted-foreground">
                    {rule.threshold} {rule.metric.unit}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Duration:</span>
                  <p className="text-muted-foreground">{rule.duration} minutes</p>
                </div>
              </div>
              {rule.lastTriggered && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Last triggered: {formatDistanceToNow(rule.lastTriggered, { addSuffix: true })} 
                    ({rule.triggerCount} times total)
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </QueryState>
  );
};

export default AlertRulesTab;
