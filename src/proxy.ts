import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge auth gate (Next.js 16 `proxy`, node runtime).
 *
 * Only checks for the presence of a session cookie to keep the middleware
 * fast and dependency-free — full JWT verification and tenancy authorization
 * happen in server components/actions via requireBusinessAccess(). Public
 * routes (login, API webhooks, health, static assets) are allowed through.
 */

const PUBLIC_PREFIXES = ["/login", "/api/webhooks", "/api/health", "/_next", "/favicon"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("nexora_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
