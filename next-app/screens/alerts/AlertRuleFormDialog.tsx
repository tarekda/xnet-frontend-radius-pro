import React from "react";
import { Edit, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALERT_CONDITIONS, ALERT_METRICS, ALERT_SEVERITIES } from "@/types/alerts";

export type AlertRuleFormData = {
  name: string;
  description: string;
  metric: string;
  condition: string;
  threshold: string;
  duration: string;
  severity: string;
  enabled: boolean;
};

export const emptyAlertRuleForm: AlertRuleFormData = {
  name: '',
  description: '',
  metric: '',
  condition: '',
  threshold: '',
  duration: '',
  severity: '',
  enabled: true,
};

type Props = {
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: AlertRuleFormData;
  onFormDataChange: (data: AlertRuleFormData) => void;
  onSubmit: () => void;
  isPending: boolean;
};

/** Create/edit dialog for an alert rule; both modes share the same fields and validation. */
const AlertRuleFormDialog: React.FC<Props> = ({
  mode,
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  isPending,
}) => {
  const isEdit = mode === "edit";
  const idPrefix = isEdit ? "edit-" : "";
  const isIncomplete =
    !formData.name || !formData.metric || !formData.condition || !formData.threshold || !formData.duration || !formData.severity;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Alert Rule" : "Create Alert Rule"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modify the alert rule configuration."
              : "Configure a new alert rule to monitor system metrics."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor={`${idPrefix}name`}>Rule Name</Label>
            <Input
              id={`${idPrefix}name`}
              value={formData.name}
              onChange={(e) => onFormDataChange({ ...formData, name: e.target.value })}
              placeholder="Enter rule name"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}description`}>Description</Label>
            <Input
              id={`${idPrefix}description`}
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="Enter description"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}metric`}>Metric</Label>
            <Select value={formData.metric} onValueChange={(value) => onFormDataChange({ ...formData, metric: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select metric" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_METRICS.map((metric) => (
                  <SelectItem key={metric.type} value={metric.type}>
                    {metric.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}condition`}>Condition</Label>
            <Select value={formData.condition} onValueChange={(value) => onFormDataChange({ ...formData, condition: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select condition" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_CONDITIONS.map((condition) => (
                  <SelectItem key={condition.value} value={condition.value}>
                    {condition.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor={`${idPrefix}threshold`}>Threshold</Label>
            <Input
              id={`${idPrefix}threshold`}
              type="number"
              value={formData.threshold}
              onChange={(e) => onFormDataChange({ ...formData, threshold: e.target.value })}
              placeholder="Enter threshold value"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}duration`}>Duration (minutes)</Label>
            <Input
              id={`${idPrefix}duration`}
              type="number"
              value={formData.duration}
              onChange={(e) => onFormDataChange({ ...formData, duration: e.target.value })}
              placeholder="Enter duration"
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}severity`}>Severity</Label>
            <Select value={formData.severity} onValueChange={(value) => onFormDataChange({ ...formData, severity: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Select severity" />
              </SelectTrigger>
              <SelectContent>
                {ALERT_SEVERITIES.map((severity) => (
                  <SelectItem key={severity.value} value={severity.value}>
                    {severity.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id={`${idPrefix}enabled`}
              checked={formData.enabled}
              onCheckedChange={(checked) => onFormDataChange({ ...formData, enabled: checked })}
            />
            <Label htmlFor={`${idPrefix}enabled`}>Enable rule</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isPending || isIncomplete}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isEdit ? (
              <Edit className="mr-2 h-4 w-4" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            {isEdit ? "Update Rule" : "Create Rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AlertRuleFormDialog;
