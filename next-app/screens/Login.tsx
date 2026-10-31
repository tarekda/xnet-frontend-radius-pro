"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import useLogin from "@/hooks/useLogin";
import { useRouter } from "next/navigation";
import { useSearchParams } from "@/navigation/urlSearchParams";
import { useAuth } from "@/context/AuthContext";
import {
  Loader2, Lock, User, Shield, Wifi, Activity,
  Database, Server, CheckCircle2, ArrowRight,
} from "lucide-react";
import Alert from "@/components/ui/Alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { safeRedirectPath } from "@/lib/safeRedirect";

// ─── Animated NOC Stats (left panel) ─────────────────────────────────────────
const NOC_STATS = [
  { icon: Wifi,       label: "Active Sessions",   value: "2,847",   color: "text-emerald-400" },
  { icon: Shield,     label: "Auth Success Rate", value: "99.4%",   color: "text-sky-400" },
  { icon: Database,   label: "DB Latency",        value: "8ms",     color: "text-indigo-400" },
  { icon: Server,     label: "NAS Devices",       value: "12 / 12", color: "text-violet-400" },
  { icon: Activity,   label: "Network Uptime",    value: "99.98%",  color: "text-emerald-400" },
];

const NOC_FEATURES = [
  "Real-time RADIUS AAA authentication monitoring",
  "MikroTik RouterOS integration & scripting",
  "Automated dunning & WhatsApp billing",
  "AI-powered network diagnostics copilot",
];

function NocPanel() {
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActiveIdx((i) => (i + 1) % NOC_STATS.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden lg:flex lg:w-[52%] flex-col justify-between p-10 xl:p-14 overflow-hidden bg-[#060a12]">
      {/* Animated mesh background */}
      <div className="absolute inset-0 animated-mesh-bg opacity-30" />
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid-pattern opacity-40" />
      {/* Radial glow */}
      <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 h-80 w-80 rounded-full bg-sky-600/15 blur-3xl" />

      {/* Logo */}
      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-black text-sm shadow-lg shadow-indigo-500/40">
            XN
          </div>
          <div>
            <div className="text-white font-bold text-lg leading-none">XNet Radius Pro</div>
            <div className="text-slate-400 text-xs font-mono">Network Operations Platform</div>
          </div>
        </div>
      </div>

      {/* Center content */}
      <div className="relative z-10 space-y-8">
        <div>
          <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight">
            Your NOC.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
              Intelligently Managed.
            </span>
          </h2>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed max-w-sm">
            Unified ISP operations — subscribers, billing, NAS, and AI-powered diagnostics in one platform.
          </p>
        </div>

        {/* Animated stat cards */}
        <div className="grid grid-cols-2 gap-3 max-w-sm">
          {NOC_STATS.slice(0, 4).map((stat, i) => {
            const Icon = stat.icon;
            const isActive = i === activeIdx % 4;
            return (
              <div
                key={stat.label}
                className={cn(
                  "rounded-xl border p-3 transition-all duration-500",
                  isActive
                    ? "border-indigo-500/50 bg-indigo-500/10 scale-[1.02]"
                    : "border-slate-800 bg-slate-900/60"
                )}
              >
                <Icon className={cn("h-4 w-4 mb-1.5", isActive ? stat.color : "text-slate-500")} />
                <div className={cn("text-lg font-bold font-mono tabular-nums", isActive ? stat.color : "text-slate-300")}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-slate-500 leading-none">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Feature list */}
        <ul className="space-y-2">
          {NOC_FEATURES.map((f, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-slate-400 animate-slide-up" style={{ animationDelay: `${i * 0.08}s` }}>
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              {f}
            </li>
          ))}
        </ul>
      </div>

      {/* Bottom badge */}
      <div className="relative z-10 flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-slate-500 font-mono">All systems operational</span>
      </div>
    </div>
  );
}

// ─── Login Form Panel ─────────────────────────────────────────────────────────
const Login: React.FC = () => {
  const { t } = useTranslation("screens");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const { login, verifyMfa, isLoading, error } = useLogin();
  const { login: authLogin, isAuthenticated } = useAuth();
  const router = useRouter();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const raw = localStorage.getItem("login.rememberMe");
    if (raw === null) return;
    setRememberMe(raw === "true");
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const from = searchParams.get("from");
    router.replace(safeRedirectPath(from));
  }, [isAuthenticated, router, searchParams]);

  const finishLogin = (user: any) => {
    localStorage.setItem("login.rememberMe", String(Boolean(rememberMe)));
    authLogin(user, undefined, rememberMe);
    const fromQs = searchParams.get("from");
    const storedPath = localStorage.getItem("redirectTo");
    const redirectPath = safeRedirectPath(fromQs) !== "/" ? safeRedirectPath(fromQs) : safeRedirectPath(storedPath);
    if (storedPath) localStorage.removeItem("redirectTo");
    router.replace(redirectPath);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mfaToken) {
      const resp = await verifyMfa(mfaToken, mfaCode, rememberMe);
      if (resp?.success && "user" in resp.data && resp.data.user) {
        finishLogin(resp.data.user);
      }
      return;
    }
    const resp = await login(username, password, rememberMe);
    if (!resp?.success) return;
    if ("mfaRequired" in resp.data && resp.data.mfaRequired) {
      setMfaToken(resp.data.mfaToken);
      return;
    }
    if ("user" in resp.data && resp.data.user) {
      finishLogin(resp.data.user);
    }
  };

  return (
    <div className="shop-app-shell flex min-h-full overflow-hidden">
      {/* Left: NOC Panel */}
      <NocPanel />

      {/* Right: Auth Form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 sm:p-10 bg-background">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center lg:hidden">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-black text-sm shadow-lg shadow-indigo-500/30 mb-3">
            XN
          </div>
          <h1 className="text-xl font-bold">{t("login.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("login.subtitle")}</p>
        </div>

        <div className="w-full max-w-[400px] animate-slide-up">
          {/* Card */}
          <div className="relative rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl overflow-hidden">
            {/* Top accent bar */}
            <div className={cn(
              "h-[3px] bg-gradient-to-r transition-all duration-500",
              mfaToken
                ? "from-violet-500 via-purple-500 to-indigo-500"
                : "from-indigo-500 via-sky-500 to-emerald-500"
            )} />

            <div className="p-6 sm:p-7">
              {/* Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300",
                  mfaToken
                    ? "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                    : "border-primary/20 bg-primary/10 text-primary"
                )}>
                  {mfaToken ? <Shield className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
                <div>
                  <h2 className="text-base font-bold leading-tight">
                    {mfaToken ? "Two-factor authentication" : "Welcome back"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mfaToken
                      ? "Enter the 6-digit code from your authenticator app"
                      : "Enter your credentials to access your account"}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!mfaToken ? (
                  <>
                    {/* Username */}
                    <div className="space-y-1.5">
                      <Label htmlFor="username" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</Label>
                      <div className="relative group">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter your username"
                          className="pl-9 h-11 border-border/70 focus:border-primary/50 transition-colors bg-background/60"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          required
                          autoComplete="username"
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-1.5">
                      <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Password</Label>
                      <div className="relative group">
                        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter your password"
                          className="pl-9 h-11 border-border/70 focus:border-primary/50 transition-colors bg-background/60"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          autoComplete="current-password"
                        />
                      </div>
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center gap-2 pt-0.5">
                      <Checkbox
                        id="rememberMe"
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(Boolean(v))}
                      />
                      <Label htmlFor="rememberMe" className="text-sm text-muted-foreground cursor-pointer">
                        Remember me on this device
                      </Label>
                    </div>
                  </>
                ) : (
                  /* MFA step */
                  <div className="space-y-3 animate-scale-in">
                    <div className="space-y-1.5">
                      <Label htmlFor="mfaCode" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticator code</Label>
                      <Input
                        id="mfaCode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="000 000"
                        maxLength={8}
                        className="h-11 text-center font-mono text-xl tracking-[0.5em] border-violet-500/30 focus:border-violet-500/60"
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-muted-foreground"
                      onClick={() => { setMfaToken(null); setMfaCode(""); }}
                    >
                      ← Back to password
                    </Button>
                  </div>
                )}

                {error && <Alert type="error" message={error} />}

                <Button
                  className={cn(
                    "w-full h-11 font-semibold transition-all",
                    !isLoading && "btn-glow-primary"
                  )}
                  disabled={isLoading}
                  type="submit"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {mfaToken ? "Verifying…" : "Signing in…"}
                    </>
                  ) : mfaToken ? (
                    <>Verify code <ArrowRight className="ml-2 h-4 w-4" /></>
                  ) : (
                    <>Sign in <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </form>
            </div>
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground/60">
            XNet Radius Pro · Secured session
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
