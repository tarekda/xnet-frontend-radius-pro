import { Button } from '@/components/ui/button';
import React from 'react';
import Link from 'next/link';
import PageHeader from "@/components/PageHeader";
import { Settings as SettingsIcon, Shield, Tag } from "lucide-react";
import DarkModeToggle from '@/components/ui/DarkModeToggle';
import { useAppPreferences } from '@/context/AppPreferencesContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTranslation } from 'react-i18next';
import { VERSION_LABEL } from '@/constants/version';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';


const Setting: React.FC = () => {
  const { t } = useTranslation('common');
  const { t: tScreens } = useTranslation('screens');
  const { density, setDensity, showHealthStrip, setShowHealthStrip } = useAppPreferences();

  return (
    <div className="w-full space-y-5">
      <PageHeader
        title={tScreens("settings.title")}
        subtitle={tScreens("settings.subtitle")}
        icon={SettingsIcon}
        actions={(
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings/security">
              <Shield className="h-4 w-4" />
              Security & MFA
            </Link>
          </Button>
        )}
      />

      <div className="space-y-4">
        <div className="rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-none">
          <h2 className="mb-4 text-base font-semibold">Appearance &amp; UI</h2>
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-foreground/90">Theme</span>
              <DarkModeToggle />
            </div>

            <div className="max-w-xs space-y-2">
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

        <div className="rounded-xl border border-border/80 bg-card p-5 text-card-foreground shadow-none">
          <h2 className="mb-4 text-base font-semibold">{t("language")}</h2>
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="language">{t("language")}</Label>
            <LanguageSwitcher />
          </div>
        </div>

        {/* Version footer */}
        <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3 w-3" />
            Build version
          </span>
          <span className="font-mono font-semibold text-foreground/70">{VERSION_LABEL}</span>
        </div>
      </div>
    </div>
  );
};

export default Setting;
