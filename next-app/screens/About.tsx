import React, { useEffect, useState } from 'react';
import PageHeader from "@/components/PageHeader";
import { Info, Server, Cpu, Clock, Shield, Zap, Globe, BarChart3, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FRONTEND_VERSION, VERSION_LABEL } from "@/constants/version";
import axios from "axios";

interface BackendHealth {
  status: string;
  version?: string;
  nodeVersion?: string;
  env?: string;
  uptime?: number;
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const FEATURES = [
  { icon: Zap, label: 'RADIUS AAA', desc: 'Full UDP RADIUS auth, accounting, and session management' },
  { icon: BarChart3, label: 'Analytics', desc: 'ClickHouse-powered bandwidth analytics and revenue insights' },
  { icon: Globe, label: 'MikroTik Integration', desc: 'RouterOS API: live disconnect, QoS, interface monitoring' },
  { icon: Shield, label: 'Enterprise Security', desc: 'JWT, MFA (OTP), rate limiting, IP whitelist, audit logs' },
  { icon: Server, label: 'Multi-Provider Billing', desc: 'MyISP, IDM, Terra, MISP invoice import and reconciliation' },
  { icon: Cpu, label: 'AI Copilot', desc: 'GPT-4o-powered diagnostics, ops briefs and natural language queries' },
];

const About: React.FC = () => {
  const { t } = useTranslation('screens');
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get<BackendHealth>('/api/health', { timeout: 5000 });
      setHealth(data);
    } catch {
      setHealth({ status: 'UNREACHABLE' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchHealth(); }, []);

  const statusColor =
    health?.status === 'UP' ? 'text-emerald-400' :
    health?.status === 'UNREACHABLE' ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className="w-full space-y-6 p-6">
      <PageHeader
        title={t('about.title')}
        subtitle={t('about.subtitle')}
        icon={Info}
        actions={
          <button
            onClick={() => void fetchHealth()}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Version badge row */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 px-4 py-1.5 text-sm font-semibold text-blue-400">
          <Zap className="h-3.5 w-3.5" />
          {VERSION_LABEL}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
          health?.status === 'UP'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400'
        }`}>
          <span className={`h-1.5 w-1.5 rounded-full ${health?.status === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          Backend {health?.status ?? '…'}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Runtime info */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Server className="h-4 w-4 text-blue-400" />
            Backend Runtime
          </h2>
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${60 + i * 8}%` }} />
              ))}
            </div>
          ) : (
            <dl className="space-y-3 text-sm">
              {[
                { label: 'Status', value: health?.status, cls: statusColor },
                { label: 'Backend Version', value: health?.version ? `v${health.version}` : '—', cls: '' },
                { label: 'Frontend Version', value: `v${FRONTEND_VERSION}`, cls: '' },
                { label: 'Node.js', value: health?.nodeVersion ?? '—', cls: '' },
                { label: 'Environment', value: health?.env ?? '—', cls: 'capitalize' },
                { label: 'Uptime', value: formatUptime(health?.uptime), cls: '' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={`font-mono font-medium text-foreground ${cls}`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {/* Stack details */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            Technology Stack
          </h2>
          <dl className="space-y-3 text-sm">
            {[
              { label: 'Frontend', value: 'Next.js 15 + React 19' },
              { label: 'Backend', value: 'Node.js + TypeScript' },
              { label: 'Database', value: 'MySQL + TypeORM' },
              { label: 'Analytics', value: 'ClickHouse' },
              { label: 'Cache / Queue', value: 'Redis + RabbitMQ' },
              { label: 'Observability', value: 'Prometheus + Grafana' },
              { label: 'Messaging', value: 'Twilio WhatsApp' },
              { label: 'License', value: 'ISC' },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium text-foreground text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Feature grid */}
      <div>
        <h2 className="text-base font-semibold text-foreground mb-4">Enterprise Feature Set</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="group rounded-xl border border-border bg-card p-4 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all duration-200"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
                  <Icon className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} XNet Radius Pro. All rights reserved.</span>
        <span className="font-mono flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {VERSION_LABEL}
        </span>
      </div>
    </div>
  );
};

export default About;