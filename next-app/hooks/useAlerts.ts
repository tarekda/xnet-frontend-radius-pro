import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { notify } from '@/lib/notify';
import { MESSAGES } from '@/constants/messages';
import { normalizeAlert, normalizeAlertRule } from '@/lib/alertNormalize';
import { 
  AlertRule, 
  Alert, 
  AlertSettings, 
  ALERT_METRICS, 
  ALERT_SEVERITIES 
} from '@/types/alerts';

function unwrapList<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)) {
    return (raw as { data: T[] }).data;
  }
  return [];
}

function unwrapEntity<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "data" in raw && (raw as { data: unknown }).data !== undefined) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}

const fetchAlertRules = async (): Promise<AlertRule[]> => {
  const response = await apiClient.get('/alerts/rules');
  return unwrapList<unknown>(response.data).map(normalizeAlertRule);
};

const fetchAlerts = async (): Promise<Alert[]> => {
  const response = await apiClient.get('/alerts', { params: { status: 'all', limit: 200 } });
  return unwrapList<unknown>(response.data).map(normalizeAlert);
};

const fetchAlertHistory = async (): Promise<Alert[]> => {
  const response = await apiClient.get('/alerts', { params: { status: 'resolved', limit: 200 } });
  return unwrapList<unknown>(response.data).map(normalizeAlert);
};

const fetchAlertSettings = async (): Promise<AlertSettings> => {
  const response = await apiClient.get('/alerts/settings');
  return unwrapEntity<AlertSettings>(response.data);
};

const createAlertRule = async (rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>): Promise<AlertRule> => {
  const response = await apiClient.post('/alerts/rules', rule);
  return normalizeAlertRule(unwrapEntity<unknown>(response.data));
};

const updateAlertRule = async (id: string, updates: Partial<AlertRule>): Promise<AlertRule> => {
  const response = await apiClient.put(`/alerts/rules/${id}`, updates);
  return normalizeAlertRule(unwrapEntity<unknown>(response.data));
};

const deleteAlertRule = async (id: string): Promise<void> => {
  await apiClient.delete(`/alerts/rules/${id}`);
};

const acknowledgeAlert = async (id: string, acknowledgedBy: string): Promise<Alert> => {
  const response = await apiClient.post(`/alerts/${id}/acknowledge`, { acknowledgedBy });
  return normalizeAlert(unwrapEntity<unknown>(response.data));
};

const resolveAlert = async (id: string): Promise<Alert> => {
  const response = await apiClient.post(`/alerts/${id}/resolve`);
  return normalizeAlert(unwrapEntity<unknown>(response.data));
};

const updateAlertSettings = async (settings: AlertSettings): Promise<AlertSettings> => {
  const response = await apiClient.put('/alerts/settings', settings);
  return unwrapEntity<AlertSettings>(response.data);
};

export const useAlertRules = () => {
  return useQuery({
    queryKey: ['alerts', 'rules'],
    queryFn: fetchAlertRules,
    refetchInterval: 30000,
    staleTime: 10000,
  });
};

export const useAlerts = () => {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: fetchAlerts,
    refetchInterval: 15000,
    staleTime: 5000,
  });
};

export const useAlertHistory = (enabled = true) => {
  return useQuery({
    queryKey: ['alerts', 'history'],
    queryFn: fetchAlertHistory,
    enabled,
    refetchInterval: enabled ? 30000 : false,
    staleTime: 10000,
  });
};

export const useAlertSettings = () => {
  return useQuery({
    queryKey: ['alerts', 'settings'],
    queryFn: fetchAlertSettings,
    staleTime: 60000,
  });
};

export const useCreateAlertRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
      notify.success("Created", MESSAGES.alerts.ruleCreated);
    },
    onError: (error: unknown) => {
      notify.error("Create failed", error instanceof Error ? error.message : MESSAGES.common.createFailed);
    },
  });
};

export const useUpdateAlertRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<AlertRule> }) => 
      updateAlertRule(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
      notify.success("Saved", MESSAGES.alerts.ruleUpdated);
    },
    onError: (error: unknown) => {
      notify.error("Save failed", error instanceof Error ? error.message : MESSAGES.common.updateFailed);
    },
  });
};

export const useDeleteAlertRule = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteAlertRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'rules'] });
      notify.success("Deleted", MESSAGES.alerts.ruleDeleted);
    },
    onError: (error: unknown) => {
      notify.error("Delete failed", error instanceof Error ? error.message : MESSAGES.common.deleteFailed);
    },
  });
};

const invalidateAlertLists = (queryClient: ReturnType<typeof useQueryClient>) => {
  queryClient.invalidateQueries({ queryKey: ['alerts'] });
};

export const useAcknowledgeAlert = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, acknowledgedBy }: { id: string; acknowledgedBy: string }) => 
      acknowledgeAlert(id, acknowledgedBy),
    onSuccess: () => {
      invalidateAlertLists(queryClient);
      notify.success("Success", MESSAGES.alerts.acknowledged);
    },
    onError: (error: unknown) => {
      notify.error("Action failed", error instanceof Error ? error.message : MESSAGES.common.actionFailed);
    },
  });
};

export const useResolveAlert = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => {
      invalidateAlertLists(queryClient);
      notify.success("Success", MESSAGES.alerts.resolved);
    },
    onError: (error: unknown) => {
      notify.error("Action failed", error instanceof Error ? error.message : MESSAGES.common.actionFailed);
    },
  });
};

export const useUpdateAlertSettings = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: updateAlertSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', 'settings'] });
      notify.success("Saved", MESSAGES.alerts.settingsUpdated);
    },
    onError: (error: unknown) => {
      notify.error("Save failed", error instanceof Error ? error.message : MESSAGES.common.updateFailed);
    },
  });
};

export const getSeverityColor = (severity: string): string => {
  const severityConfig = ALERT_SEVERITIES.find(s => s.value === severity);
  return severityConfig?.color || "text-muted-foreground";
};

export const getSeverityBgColor = (severity: string): string => {
  const severityConfig = ALERT_SEVERITIES.find(s => s.value === severity);
  return severityConfig?.bgColor || "bg-muted";
};

export const formatAlertMessage = (alert: Alert): string => {
  const metric = ALERT_METRICS.find(m => m.type === alert.metric);
  const unit = metric?.unit || '';
  
  return `${alert.metric} (${alert.value}${unit}) ${alert.message}`;
};

export const isInQuietHours = (settings: AlertSettings | undefined): boolean => {
  if (!settings || !settings.quietHours || !settings.quietHours.enabled) return false;
  
  const now = new Date();
  const currentTime = now.toLocaleTimeString('en-US', { 
    hour12: false, 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  const { startTime, endTime } = settings.quietHours;
  
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }
  return currentTime >= startTime && currentTime <= endTime;
};
