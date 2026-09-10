import React, { useState } from "react";
import { Bell, Mail, Smartphone, Webhook, Loader2, Send } from "lucide-react";
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
import type { AlertSettings } from "@/types/alerts";
import LoadingSpinner from "./LoadingSpinner";
import { apiClient } from "@/api/client";
import { notify } from "@/lib/notify";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AlertSettings | undefined;
  settingsLoading: boolean;
  onUpdateSettings: (settings: AlertSettings) => void;
};

/** Settings dialog: notification channels, quiet hours, and escalation policy. */
const AlertSettingsDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  settings,
  settingsLoading,
  onUpdateSettings,
}) => {
  const [testingWebhook, setTestingWebhook] = useState(false);

  const handleTestWebhook = async () => {
    const url = (settings?.webhookUrl || "").trim();
    if (!url) {
      notify.error("Missing URL", "Please enter a webhook URL first.");
      return;
    }
    setTestingWebhook(true);
    try {
      const resp = await apiClient.post("/alerts/test-webhook", { url });
      notify.success("Webhook Connected", resp.data?.message || "Webhook endpoint verified successfully!");
    } catch (err: any) {
      notify.error("Webhook Test Failed", err?.response?.data?.message || err?.message || "Could not reach webhook endpoint");
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alert Settings</DialogTitle>
          <DialogDescription>
            Configure notification channels, quiet hours, and escalation policies.
          </DialogDescription>
        </DialogHeader>
        {settingsLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            {/* Notification Channels */}
            <div>
              <h3 className="text-lg font-medium mb-4">Notification Channels</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-sky-500" />
                      <span>Email Notifications</span>
                    </div>
                    <Switch
                      checked={settings?.emailNotifications || false}
                      onCheckedChange={(checked) => 
                        settings && onUpdateSettings({ ...settings, emailNotifications: checked })
                      }
                    />
                  </div>
                  {settings?.emailNotifications && (
                    <div className="pl-6 space-y-1">
                      <Label className="text-xs text-muted-foreground">Email Recipients (comma-separated)</Label>
                      <Input
                        placeholder="ops@example.com, oncall@example.com"
                        value={settings.emailRecipients?.join(", ") || ""}
                        onChange={(e) =>
                          onUpdateSettings({
                            ...settings,
                            emailRecipients: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                          })
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-500" />
                    <span>SMS Notifications</span>
                  </div>
                  <Switch
                    checked={settings?.smsNotifications || false}
                    onCheckedChange={(checked) => 
                      settings && onUpdateSettings({ ...settings, smsNotifications: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Webhook className="h-4 w-4 text-purple-500" />
                      <div>
                        <span>Webhook Notifications</span>
                        <p className="text-xs text-muted-foreground">Dispatch incident alerts & escalations to Slack, Discord, or OpsGenie</p>
                      </div>
                    </div>
                    <Switch
                      checked={settings?.webhookNotifications || false}
                      onCheckedChange={(checked) => 
                        settings && onUpdateSettings({ ...settings, webhookNotifications: checked })
                      }
                    />
                  </div>
                  {settings?.webhookNotifications && (
                    <div className="pl-6 space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Webhook Endpoint URL</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://hooks.slack.com/services/... or https://api.ops.com/webhook"
                          value={settings.webhookUrl || ""}
                          onChange={(e) =>
                            onUpdateSettings({ ...settings, webhookUrl: e.target.value })
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={testingWebhook || !settings.webhookUrl}
                          onClick={handleTestWebhook}
                          className="shrink-0 gap-1.5"
                        >
                          {testingWebhook ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                          Test
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-amber-500" />
                    <span>In-App Notifications</span>
                  </div>
                  <Switch
                    checked={settings?.inAppNotifications || false}
                    onCheckedChange={(checked) => 
                      settings && onUpdateSettings({ ...settings, inAppNotifications: checked })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Quiet Hours */}
            <div>
              <h3 className="text-lg font-medium mb-4">Quiet Hours</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Enable Quiet Hours</span>
                  <Switch
                    checked={settings?.quietHours?.enabled || false}
                    onCheckedChange={(checked) => 
                      settings && onUpdateSettings({ 
                        ...settings, 
                        quietHours: { ...settings.quietHours, enabled: checked }
                      })
                    }
                  />
                </div>
                {settings?.quietHours?.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Start Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.startTime}
                        onChange={(e) => 
                          onUpdateSettings({ 
                            ...settings, 
                            quietHours: { ...settings.quietHours, startTime: e.target.value }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>End Time</Label>
                      <Input
                        type="time"
                        value={settings.quietHours.endTime}
                        onChange={(e) => 
                          onUpdateSettings({ 
                            ...settings, 
                            quietHours: { ...settings.quietHours, endTime: e.target.value }
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Escalation Policy */}
            <div>
              <h3 className="text-lg font-medium mb-4">Escalation Policy</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Enable Escalation</span>
                  <Switch
                    checked={settings?.escalationPolicy?.enabled || false}
                    onCheckedChange={(checked) => 
                      settings && onUpdateSettings({ 
                        ...settings, 
                        escalationPolicy: { ...settings.escalationPolicy, enabled: checked }
                      })
                    }
                  />
                </div>
                {settings?.escalationPolicy?.enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Escalation Delay (minutes)</Label>
                      <Input
                        type="number"
                        value={settings.escalationPolicy.escalationDelay}
                        onChange={(e) => 
                          onUpdateSettings({ 
                            ...settings, 
                            escalationPolicy: { 
                              ...settings.escalationPolicy, 
                              escalationDelay: parseInt(e.target.value) 
                            }
                          })
                        }
                      />
                    </div>
                    <div>
                      <Label>Max Escalations</Label>
                      <Input
                        type="number"
                        value={settings.escalationPolicy.maxEscalations}
                        onChange={(e) => 
                          onUpdateSettings({ 
                            ...settings, 
                            escalationPolicy: { 
                              ...settings.escalationPolicy, 
                              maxEscalations: parseInt(e.target.value) 
                            }
                          })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AlertSettingsDialog;
