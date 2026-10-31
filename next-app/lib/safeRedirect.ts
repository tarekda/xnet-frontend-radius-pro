const AUTH_PATHS = new Set(["/login", "/subscriber"]);

/**
 * Only same-origin relative paths. Rejects protocol-relative (`//evil.com`)
 * and other schemes so post-login `from` / `redirectTo` cannot leave the app.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = "/"
): string {
  if (raw == null) return fallback;
  let value = String(raw).trim();
  if (!value) return fallback;
  try {
    value = decodeURIComponent(value);
  } catch {
    return fallback;
  }
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (value.includes("://")) return fallback;
  const pathname = value.split(/[?#]/)[0] || "/";
  if (AUTH_PATHS.has(pathname)) return fallback;
  return value;
}
