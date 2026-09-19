/**
 * Frontend version constants - kept in sync with package.json.
 * Displayed in the Settings page, About screen, and browser console on app boot.
 */
// Version is injected at build time by next.config.ts (DefinePlugin: __APP_VERSION__).
export const FRONTEND_VERSION: string =
  typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "0.0.0";
export const BACKEND_API_VERSION = 'v1';
export const APP_BUILD_DATE: string = new Date().toISOString();

/** Full human-readable version string, e.g. "XNet Radius Pro v1.5.2" */
export const VERSION_LABEL = `XNet Radius Pro v${FRONTEND_VERSION}`;
