// Runtime env template (production).
// This file is processed by envsubst at container start to generate /env.js.
window.__ENV__ = {
  API_URL: "${API_URL}",
  WS_URL: "${WS_URL}",
  // Feature flags (comma/space separated). Examples:
  // "alerts analytics"  -> enable only those explicitly (others default on, unless disabled)
  // "-alerts"           -> disable alerts
  // "alerts -analytics" -> explicitly enable alerts, disable analytics
  FEATURE_FLAGS: "${FEATURE_FLAGS}",
  // Optional: NAS IP / CoA port for display only. Never ship NAS secrets to the browser.
  DEFAULT_NAS_IP: "${DEFAULT_NAS_IP}",
  DEFAULT_NAS_COA_PORT: "${DEFAULT_NAS_COA_PORT}",
  // Optional: error reporting
  SENTRY_DSN: "${SENTRY_DSN}",
  SENTRY_ENVIRONMENT: "${SENTRY_ENVIRONMENT}",
  // Optional: app metadata (shown in UI)
  APP_VERSION: "${APP_VERSION}",
  APP_BUILD_TIME: "${APP_BUILD_TIME}",
  APP_GIT_SHA: "${APP_GIT_SHA}",
};
