import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Server-side route guard.
 *
 * Uses the presence-only `xnet_auth` cookie (set by AuthContext on login,
 * cleared on logout). This prevents protected pages from flashing before the
 * client-side redirect and makes deep links land on /login?from=... directly.
 * Real authorization is enforced by the backend on every API request.
 */
const AUTH_COOKIE = "xnet_auth";

const PUBLIC_PATHS = ["/login", "/healthz", "/expired", "/forbidden", "/subscriber"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isAuthed = req.cookies.get(AUTH_COOKIE)?.value === "1";

  if (!isAuthed && !isPublicPath(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") {
      url.searchParams.set("from", `${pathname}${search || ""}`);
    }
    return NextResponse.redirect(url);
  }

  if (isAuthed && pathname === "/login") {
    const url = req.nextUrl.clone();
    const from = url.searchParams.get("from");
    url.pathname = from && from.startsWith("/") && !from.startsWith("//") ? from.split("?")[0] : "/";
    url.search = from && from.includes("?") ? `?${from.split("?").slice(1).join("?")}` : "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except API routes, Next internals, and static files with extensions.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
