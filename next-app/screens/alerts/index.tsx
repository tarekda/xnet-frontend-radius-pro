import React, { useState } from 'react';
import PageHeader from "@/components/PageHeader";
import IconActionButton from "@/components/IconActionButton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Plus,
  AlertTriangle,
  Users,
  Settings,
  Clock,
  RefreshCw,
} from 'lucide-react';
import {
  useAlertRules,
  useAlerts,
  useAlertSettings,
  useCreateAlertRule,
  useUpdateAlertRule,
  useDeleteAlertRule,
  useAcknowledgeAlert,
  useResolveAlert,
  useUpdateAlertSettings,
} from '@/hooks/useAlerts';
import { AlertRule, ALERT_METRICS } from '@/types/alerts';
import AlertStatsCards from './AlertStatsCards';
import AlertRulesTab from './AlertRulesTab';
import ActiveAlertsTab from './ActiveAlertsTab';
import QuotaExceededTab from './QuotaExceededTab';
import AlertRuleFormDialog, { emptyAlertRuleForm, type AlertRuleFormData } from './AlertRuleFormDialog';
import AlertSettingsDialog from './AlertSettingsDialog';
import { useTranslation } from 'react-i18next';

const Alerts: React.FC = () => {
  const { t } = useTranslation("screens");
  const [activeTab, setActiveTab] = useState('rules');

  // Data hooks
  const { data: alertRules, isLoading: rulesLoading, error: rulesError, refetch: refetchRules } = useAlertRules();
  const { data: alerts, isLoading: alertsLoading, error: alertsError, refetch: refetchAlerts } = useAlerts();
  const { data: settings, isLoading: settingsLoading, refetch: refetchSettings } = useAlertSettings();

  // Mutation hooks
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const deleteRule = useDeleteAlertRule();
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const updateSettings = useUpdateAlertSettings();

  // Dialog + form state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSettingsDialogOpen, setIsSettingsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const [formData, setFormData] = useState<AlertRuleFormData>(emptyAlertRuleForm);

  const handleCreateRule = () => {
    const newRule = {
      name: formData.name,
      description: formData.description,
      metric: ALERT_METRICS.find(m => m.type === formData.metric)!,
      condition: formData.condition as any,
      threshold: parseFloat(formData.threshold),
      duration: parseInt(formData.duration),
      severity: formData.severity as any,
      enabled: formData.enabled
    };

    createRule.mutate(newRule, {
      onSuccess: () => {
        setIsCreateDialogOpen(false);
        setFormData(emptyAlertRuleForm);
      }
    });
  };

  const handleUpdateRule = () => {
    if (!editingRule) return;

    const updates = {
      name: formData.name,
      description: formData.description,
      metric: ALERT_METRICS.find(m => m.type === formData.metric)!,
      condition: formData.condition as any,
      threshold: parseFloat(formData.threshold),
      duration: parseInt(formData.duration),
      severity: formData.severity as any,
      enabled: formData.enabled
    };

    updateRule.mutate({ id: editingRule.id, updates }, {
      onSuccess: () => {
        setIsEditDialogOpen(false);
        setEditingRule(null);
        setFormData(emptyAlertRuleForm);
      }
    });
  };

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description,
      metric: rule.metric.type,
      condition: rule.condition,
      threshold: rule.threshold.toString(),
      duration: rule.duration.toString(),
      severity: rule.severity,
      enabled: rule.enabled
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="w-full space-y-6 p-6">
      <PageHeader
        title={t("alerts.title")}
        subtitle={t("alerts.subtitle")}
        icon={AlertTriangle}
        actions={(
          <div className="flex items-center gap-2">
            <IconActionButton
              label="Refresh"
              onClick={() => {
                refetchRules?.();
                refetchAlerts?.();
                refetchSettings?.();
              }}
              icon={<RefreshCw className="h-4 w-4" />}
            />
            <IconActionButton
              label="Settings"
              onClick={() => setIsSettingsDialogOpen(true)}
              icon={<Settings className="h-4 w-4" />}
            />
            <IconActionButton
              label="Create alert rule"
              onClick={() => setIsCreateDialogOpen(true)}
              variant="default"
              icon={<Plus className="h-4 w-4" />}
            />
          </div>
        )}
      />

      <AlertStatsCards
        alertRules={alertRules}
        rulesLoading={rulesLoading}
        alerts={alerts}
        alertsLoading={alertsLoading}
        settings={settings}
        settingsLoading={settingsLoading}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Alert Rules
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Active Alerts
          </TabsTrigger>
          <TabsTrigger value="quota" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Quota Exceeded
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Alert History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          <AlertRulesTab
            alertRules={alertRules}
            isLoading={rulesLoading}
            error={rulesError}
            onRetry={() => refetchRules?.()}
            onEditRule={handleEditRule}
            onDeleteRule={(id) => deleteRule.mutate(id)}
          />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <ActiveAlertsTab
            alerts={alerts}
            isLoading={alertsLoading}
            error={alertsError}
            onRetry={() => refetchAlerts?.()}
            onAcknowledge={(id) => acknowledgeAlert.mutate({ id, acknowledgedBy: 'current-user@example.com' })}
            acknowledgePending={acknowledgeAlert.isPending}
            onResolve={(id) => resolveAlert.mutate(id)}
            resolvePending={resolveAlert.isPending}
          />
        </TabsContent>

        <TabsContent value="quota" className="space-y-4">
          <QuotaExceededTab active={activeTab === "quota"} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Historical view of all alerts and their resolution</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Alert history feature coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertRuleFormDialog
        mode="create"
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleCreateRule}
        isPending={createRule.isPending}
      />

      <AlertRuleFormDialog
        mode="edit"
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleUpdateRule}
        isPending={updateRule.isPending}
      />

      <AlertSettingsDialog
        open={isSettingsDialogOpen}
        onOpenChange={setIsSettingsDialogOpen}
        settings={settings}
        settingsLoading={settingsLoading}
        onUpdateSettings={(next) => updateSettings.mutate(next)}
      />
    </div>
  );
};

export default Alerts;
