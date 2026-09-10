"use client";
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell, Plus, Edit, Trash2, Play, Search, Filter,
  CheckCircle2, AlertTriangle, ShieldAlert, Clock,
  Layers, Settings, RefreshCw, Send, Check
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { apiClient } from "@/api/client";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";

export interface AlertRuleItem {
  id: string | number;
  name: string;
  description?: string;
  metric: string;
  condition: string;
  threshold: number;
  duration: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
  triggerCount?: number;
  lastTriggered?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

const METRIC_OPTIONS = [
  { value: "users", label: "Active Online Users", unit: "users" },
  { value: "bandwidth", label: "Bandwidth Usage", unit: "MB/s" },
  { value: "auth_success_rate", label: "Auth Success Rate", unit: "%" },
  { value: "auth_failed_attempts", label: "Auth Failed Attempts", unit: "attempts" },
  { value: "cpu_usage", label: "CPU Load", unit: "%" },
  { value: "memory_usage", label: "Memory Usage", unit: "%" },
  { value: "disk_usage", label: "Disk Space Usage", unit: "%" },
];

const CONDITION_OPTIONS = [
  { value: "greater_than", label: "Exceeds (>)" },
  { value: "less_than", label: "Drops below (<)" },
  { value: "equals", label: "Equals (=)" },
  { value: "not_equals", label: "Does not equal (≠)" },
];

const SEVERITY_CONFIG: Record<string, { label: string; badge: string; icon: any }> = {
  low: { label: "Low", badge: "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: Bell },
  medium: { label: "Medium", badge: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400", icon: AlertTriangle },
  high: { label: "High", badge: "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400", icon: AlertTriangle },
  critical: { label: "Critical", badge: "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400", icon: ShieldAlert },
};

export default function AlertRules() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [ruleToEdit, setRuleToEdit] = useState<AlertRuleItem | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<AlertRuleItem | null>(null);
  const [testResult, setTestResult] = useState<{ id: string | number; success: boolean; msg: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    metric: "auth_failed_attempts",
    condition: "greater_than",
    threshold: 10,
    duration: 5,
    severity: "high" as AlertRuleItem["severity"],
    enabled: true,
  });

  // Query rules
  const { data: rules = [], isLoading, refetch } = useQuery<AlertRuleItem[]>({
    queryKey: ["alert-rules"],
    queryFn: async () => {
      const resp = await apiClient.get("/alerts/rules");
      const raw = resp.data;
      return (Array.isArray(raw) ? raw : raw?.data ?? []) as AlertRuleItem[];
    },
  });

  // Create or Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (ruleToEdit) {
        await apiClient.put(`/alerts/rules/${ruleToEdit.id}`, formData);
      } else {
        await apiClient.post("/alerts/rules", formData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setIsDialogOpen(false);
      setRuleToEdit(null);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      await apiClient.delete(`/alerts/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
      setRuleToDelete(null);
    },
  });

  // Toggle enable mutation
  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string | number; enabled: boolean }) => {
      await apiClient.put(`/alerts/rules/${id}`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alert-rules"] });
    },
  });

  // Test trigger mutation
  const testMutation = useMutation({
    mutationFn: async (ruleId: string | number) => {
      const resp = await apiClient.post("/alerts/test", { ruleId });
      return resp.data;
    },
    onSuccess: (data, id) => {
      setTestResult({ id, success: true, msg: "Test alert triggered successfully!" });
      setTimeout(() => setTestResult(null), 4000);
    },
    onError: (err: any, id) => {
      setTestResult({ id, success: false, msg: err?.response?.data?.message || "Failed to trigger test" });
      setTimeout(() => setTestResult(null), 4000);
    },
  });

  const openCreateDialog = () => {
    setRuleToEdit(null);
    setFormData({
      name: "",
      description: "",
      metric: "auth_failed_attempts",
      condition: "greater_than",
      threshold: 10,
      duration: 5,
      severity: "high",
      enabled: true,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: AlertRuleItem) => {
    setRuleToEdit(rule);
    setFormData({
      name: rule.name,
      description: rule.description || "",
      metric: typeof rule.metric === "object" ? (rule.metric as any).type : rule.metric,
      condition: rule.condition,
      threshold: Number(rule.threshold),
      duration: Number(rule.duration || 5),
      severity: rule.severity,
      enabled: rule.enabled,
    });
    setIsDialogOpen(true);
  };

  // Filtered rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.description || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(r.metric).toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeverity = severityFilter === "all" || r.severity === severityFilter;
      return matchesSearch && matchesSeverity;
    });
  }, [rules, searchTerm, severityFilter]);

  const activeCount = rules.filter((r) => r.enabled).length;
  const criticalCount = rules.filter((r) => r.severity === "critical").length;

  return (
    <div className="w-full min-w-0 space-y-6 py-6">
      {/* Header */}
      <PageHeader
        title="Enterprise Alert Rules"
        subtitle="Configure multi-channel thresholds, metric triggers, and automatic escalation policies."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw className={cn("h-4 w-4 mr-1", isLoading && "animate-spin")} />
              Refresh
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              New Alert Rule
            </Button>
          </div>
        }
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Configured Rules</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono">{rules.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Active & Monitoring</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {activeCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Critical Tier Rules</CardDescription>
            <CardTitle className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
              {criticalCount}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-border/60 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Multi-Channel Routing</CardDescription>
            <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 px-1.5 py-0.5 text-indigo-600 dark:text-indigo-400">
                Webhook / Slack
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-blue-600 dark:text-blue-400">
                Email
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
                SMS
              </span>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search rules..."
            className="pl-9 h-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical Only</option>
            <option value="high">High Only</option>
            <option value="medium">Medium Only</option>
            <option value="low">Low Only</option>
          </select>
        </div>
      </div>

      {/* Rules Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading alert rules…</div>
      ) : filteredRules.length === 0 ? (
        <Card className="border-dashed border-border/70 p-12 text-center">
          <Bell className="mx-auto h-10 w-10 text-muted-foreground/50 mb-3" />
          <h3 className="text-base font-semibold">No alert rules found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {searchTerm ? "Try adjusting your search criteria." : "Create your first rule to start monitoring thresholds."}
          </p>
          <Button onClick={openCreateDialog}>Create Rule</Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRules.map((rule) => {
            const sevInfo = SEVERITY_CONFIG[rule.severity] || SEVERITY_CONFIG.medium;
            const SevIcon = sevInfo.icon;
            const metricObj = METRIC_OPTIONS.find((m) => m.value === rule.metric);
            const condObj = CONDITION_OPTIONS.find((c) => c.value === rule.condition);

            return (
              <Card
                key={rule.id}
                className={cn(
                  "border-border/60 shadow-sm transition-all flex flex-col justify-between",
                  !rule.enabled && "opacity-60 bg-muted/20"
                )}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-2 rounded-lg bg-muted/60 shrink-0">
                        <SevIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-base font-semibold truncate" title={rule.name}>
                          {rule.name}
                        </CardTitle>
                        <CardDescription className="text-xs truncate">
                          {rule.description || "Threshold monitor"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("shrink-0 text-[11px] font-semibold", sevInfo.badge)}>
                      {sevInfo.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pb-3 text-xs">
                  <div className="rounded-md border border-border/50 bg-muted/30 p-2.5 space-y-1 font-mono">
                    <div className="text-foreground font-medium">
                      {metricObj?.label || rule.metric}
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between">
                      <span>Condition:</span>
                      <span className="font-semibold text-foreground">
                        {condObj?.label || rule.condition} {rule.threshold} {metricObj?.unit}
                      </span>
                    </div>
                    <div className="text-muted-foreground flex items-center justify-between">
                      <span>Evaluation Window:</span>
                      <span>{rule.duration || 5} min</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 text-muted-foreground">
                    <span className="text-[11px]">
                      Triggered: <span className="font-semibold font-mono text-foreground">{rule.triggerCount || 0}</span> times
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleMutation.mutate({ id: rule.id, enabled: !rule.enabled })}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all",
                        rule.enabled
                          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                          : "border-muted-foreground/30 bg-muted text-muted-foreground"
                      )}
                    >
                      {rule.enabled ? "Enabled" : "Disabled"}
                    </button>
                  </div>

                  {testResult && testResult.id === rule.id && (
                    <div
                      className={cn(
                        "p-2 rounded text-[11px] font-medium animate-slide-up",
                        testResult.success ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
                      )}
                    >
                      {testResult.msg}
                    </div>
                  )}
                </CardContent>

                <CardFooter className="pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => testMutation.mutate(rule.id)}
                    disabled={testMutation.isPending}
                  >
                    <Play className="h-3 w-3 mr-1" />
                    Test Trigger
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => openEditDialog(rule)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                      onClick={() => setRuleToDelete(rule)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{ruleToEdit ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
            <DialogDescription>
              Specify the condition and threshold when an operational incident should be created.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g. High Authentication Failure Spike"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="rule-desc">Description (optional)</Label>
              <Input
                id="rule-desc"
                placeholder="Operational purpose or context"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Metric</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={formData.metric}
                  onChange={(e) => setFormData({ ...formData, metric: e.target.value })}
                >
                  {METRIC_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label>Condition</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={formData.condition}
                  onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                >
                  {CONDITION_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Threshold Value</Label>
                <Input
                  type="number"
                  value={formData.threshold}
                  onChange={(e) => setFormData({ ...formData, threshold: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-1">
                <Label>Duration Window (min)</Label>
                <Input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Severity</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={formData.severity}
                  onChange={(e) => setFormData({ ...formData, severity: e.target.value as any })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="rule-enabled"
                  className="h-4 w-4 rounded border-gray-300"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                <Label htmlFor="rule-enabled" className="cursor-pointer">
                  Enable immediately
                </Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formData.name.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : ruleToEdit ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert */}
      <AlertDialog open={Boolean(ruleToDelete)} onOpenChange={() => setRuleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Alert Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete rule <strong>{ruleToDelete?.name}</strong>? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => ruleToDelete && deleteMutation.mutate(ruleToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
