import { Button } from '@/components/ui/button';
import React, { useState } from 'react';
import Link from 'next/link';
import PageHeader from "@/components/PageHeader";
import { Settings as SettingsIcon, Shield } from "lucide-react";
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n/config';

interface ServerSettings {
  serverHost: string;
  authPort: string;
  accountingPort: string;
  secretKey: string;
}

interface UserPreferences {
  enableNotifications: boolean;
  language: string;
}

const Setting: React.FC = () => {
  const { t } = useTranslation('common');
  const { t: tScreens } = useTranslation('screens');
  const { density, setDensity, showHealthStrip, setShowHealthStrip } = useAppPreferences();

  const [serverSettings, setServerSettings] = useState<ServerSettings>({
    serverHost: 'localhost',
    authPort: '1812',
    accountingPort: '1813',
    secretKey: '',
  });

  const [userPreferences, setUserPreferences] = useState<UserPreferences>({
    enableNotifications: true,
    language: i18n.language || 'en',
  });

  const handleServerSettingsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setServerSettings((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePreferencesChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setUserPreferences((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implement settings update logic
    console.log('Server Settings:', serverSettings);
    console.log('User Preferences:', userPreferences);
  };

  return (
    <div className="w-full py-5">
      <div className="mb-6 px-6">
        <PageHeader
          title={tScreens("settings.title")}
          subtitle={tScreens("settings.subtitle")}
          icon={SettingsIcon}
        />
        <div className="mt-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/security">
              <Shield className="h-4 w-4" />
              Security & MFA
            </Link>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md dark:shadow-[var(--shop-shadow,0_4px_24px_rgba(0,0,0,0.35))]">
          <h2 className="mb-4 text-xl font-semibold">Server Settings</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="serverHost" className="block text-sm font-medium text-foreground/90">
                Server Host
              </label>
              <input
                type="text"
                id="serverHost"
                name="serverHost"
                value={serverSettings.serverHost}
                onChange={handleServerSettingsChange}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="authPort" className="block text-sm font-medium text-foreground/90">
                Authentication Port
              </label>
              <input
                type="text"
                id="authPort"
                name="authPort"
                value={serverSettings.authPort}
                onChange={handleServerSettingsChange}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="accountingPort" className="block text-sm font-medium text-foreground/90">
                Accounting Port
              </label>
              <input
                type="text"
                id="accountingPort"
                name="accountingPort"
                value={serverSettings.accountingPort}
                onChange={handleServerSettingsChange}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label htmlFor="secretKey" className="block text-sm font-medium text-foreground/90">
                Secret Key
              </label>
              <input
                type="password"
                id="secretKey"
                name="secretKey"
                value={serverSettings.secretKey}
                onChange={handleServerSettingsChange}
                className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md dark:shadow-[var(--shop-shadow,0_4px_24px_rgba(0,0,0,0.35))]">
          <h2 className="mb-4 text-xl font-semibold">Appearance &amp; UI</h2>
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-foreground/90">Theme</span>
              <DarkModeToggle />
            </div>

            <div className="space-y-2 max-w-xs">
              <Label htmlFor="density">{t('density_label')}</Label>
              <Select value={density} onValueChange={(v) => setDensity(v as 'comfortable' | 'compact')}>
                <SelectTrigger id="density" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comfortable">{t('density_comfortable')}</SelectItem>
                  <SelectItem value="compact">{t('density_compact')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex max-w-md items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="show-health-strip" className="text-base">
                  {t('health_strip_label')}
                </Label>
                <p className="text-xs text-muted-foreground">{t('health_strip_hint')}</p>
              </div>
              <Switch
                id="show-health-strip"
                checked={showHealthStrip}
                onCheckedChange={(v) => setShowHealthStrip(Boolean(v))}
              />
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-md dark:shadow-[var(--shop-shadow,0_4px_24px_rgba(0,0,0,0.35))]">
          <h2 className="mb-4 text-xl font-semibold">User Preferences</h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="enableNotifications"
                name="enableNotifications"
                checked={userPreferences.enableNotifications}
                onChange={handlePreferencesChange}
                className="h-4 w-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring"
              />
              <label htmlFor="enableNotifications" className="ml-2 block text-sm text-foreground/90">
                Enable Notifications
              </label>
            </div>
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-foreground/90">
                Language
              </label>
              <select
                id="language"
                name="language"
                value={userPreferences.language}
                onChange={(e) => {
                  const v = e.target.value;
                  setUserPreferences((p) => ({ ...p, language: v }));
                  void i18n.changeLanguage(v);
                  try {
                    localStorage.setItem('app.lang', v);
                  } catch {
                    /* ignore */
                  }
                }}
                className="mt-1 block w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button type="submit" variant="outline">
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
};

export default Setting;
