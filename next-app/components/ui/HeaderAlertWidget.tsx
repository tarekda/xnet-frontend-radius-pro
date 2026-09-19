import React, { useState } from 'react';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  AlertTriangle, 
  Bell, 
  X,
  Clock
} from 'lucide-react';
import { useAlerts, getSeverityColor, getSeverityBgColor } from '@/hooks/useAlerts';
import { formatDistanceToNow } from 'date-fns';

const HeaderAlertWidget: React.FC = () => {
  const { data: alerts } = useAlerts();
  const [isOpen, setIsOpen] = useState(false);

  // Get critical and high priority alerts
  const criticalAlerts = alerts && Array.isArray(alerts)
    ? alerts.filter(alert => 
        (alert.severity === 'critical' || alert.severity === 'high') && !alert.resolved
      )
    : [];

  const unacknowledgedAlerts = criticalAlerts.filter(alert => !alert.acknowledged);
  const acknowledgedAlerts = criticalAlerts.filter(alert => alert.acknowledged);

  const getStatusIcon = (alert: any) => {
    if (alert.acknowledged) {
      return <Clock className="h-3 w-3 text-yellow-600" />;
    }
    return <AlertTriangle className="h-3 w-3 text-red-600" />;
  };

  const getStatusText = (alert: any) => {
    if (alert.acknowledged) return 'Acknowledged';
    return 'Active';
  };

  if (criticalAlerts.length === 0) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unacknowledgedAlerts.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unacknowledgedAlerts.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Critical Alerts</h4>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {unacknowledgedAlerts.length} unacknowledged, {acknowledgedAlerts.length} acknowledged
          </p>
        </div>
        
        <div className="max-h-64 overflow-y-auto">
          {criticalAlerts.length > 0 ? (
            <div className="p-2 space-y-2">
              {criticalAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                  <div className={`p-1.5 rounded-full ${getSeverityBgColor(alert.severity)}`}>
                    <AlertTriangle className={`h-3 w-3 ${getSeverityColor(alert.severity)}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="text-sm font-medium truncate">{alert.ruleName}</h5>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {getStatusIcon(alert)}
                        {getStatusText(alert)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {alert.message}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{alert.value} / {alert.threshold}</span>
                      <span>{formatDistanceToNow(alert.timestamp, { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-sm text-muted-foreground">No critical alerts</p>
            </div>
          )}
        </div>
        
        <div className="p-3 border-t">
          <Button variant="outline" size="sm" className="w-full" asChild>
            <a href="/alerts" onClick={() => setIsOpen(false)}>
              View All Alerts
            </a>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default HeaderAlertWidget; 