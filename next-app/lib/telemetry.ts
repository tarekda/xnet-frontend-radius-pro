import * as Sentry from "@sentry/react";
import { getAppVersionInfo } from "@/lib/version";

type RuntimeEnv = {
  SENTRY_DSN?: string;
  SENTRY_ENVIRONMENT?: string;
};

function readRuntimeEnv(): RuntimeEnv {
  try {
    return ((window as any)?.__ENV__ ?? {}) as RuntimeEnv;
  } catch {
    return {};
  }
}

let sentryEnabled = false;

export function initTelemetry() {
  if (sentryEnabled) return;
  const rt = readRuntimeEnv();
  const dsn = String(rt.SENTRY_DSN || "").trim();
  if (!dsn) return;

  const env = String(rt.SENTRY_ENVIRONMENT || "").trim() || "production";

  const v = getAppVersionInfo();
  const release = v.gitShaShort
    ? `xnet-frontend@${v.version}+${v.gitShaShort}`
    : `xnet-frontend@${v.version}`;

  Sentry.init({
    dsn,
    environment: env,
    release,
    enabled: true,
    // keep 0 by default; can be raised later if you want performance traces
    tracesSampleRate: 0,
  });

  // Helpful tags for filtering.
  Sentry.setTag("app", "xnet-frontend");
  Sentry.setTag("version", v.version);
  if (v.gitShaShort) Sentry.setTag("git_sha", v.gitShaShort);

  sentryEnabled = true;
}

export function setTelemetryUser(user: {
  id?: string | number | null;
  username?: string | null;
  email?: string | null;
  role?: string | null;
}) {
  if (!sentryEnabled) return;
  try {
    const id = user.id == null ? undefined : String(user.id);
    Sentry.setUser({
      id,
      username: user.username ?? undefined,
      email: user.email ?? undefined,
    });
    if (user.role) Sentry.setTag("role", String(user.role));
  } catch {
    // ignore
  }
}

export function clearTelemetryUser() {
  if (!sentryEnabled) return;
  try {
    Sentry.setUser(null);
    Sentry.setTag("role", "");
  } catch {
    // ignore
  }
}

export function captureException(error: unknown, extra?: Record<string, unknown>) {
  if (!sentryEnabled) return;
  try {
    Sentry.captureException(error, { extra });
  } catch {
    // ignore
  }
}

