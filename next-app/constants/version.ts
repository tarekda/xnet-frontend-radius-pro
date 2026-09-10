/**
 * Frontend version constants - kept in sync with package.json.
 * Displayed in the Settings page, About screen, and browser console on app boot.
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string; name: string };

export const FRONTEND_VERSION: string = pkg.version;
export const BACKEND_API_VERSION = 'v1';
export const APP_BUILD_DATE: string = new Date().toISOString();

/** Full human-readable version string, e.g. "XNet Radius Pro v1.5.2" */
export const VERSION_LABEL = `XNet Radius Pro v${FRONTEND_VERSION}`;
