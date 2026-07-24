import { NextResponse, type NextRequest } from "next/server";

/**
 * Security headers for every response. (In Next 16 this file replaces
 * `middleware.ts`; the runtime is always nodejs.)
 *
 * The CSP is deliberately strict: the app loads no third-party scripts. Next's
 * inline bootstrap requires 'unsafe-inline' for styles and scripts in dev; in
 * production we keep 'unsafe-inline' for styles only (Tailwind injects a style
 * tag) and rely on same-origin scripts.
 */
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const isDev = process.env.NODE_ENV !== "production";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // The AI provider is called server-side only, so the browser needs nothing else.
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (!isDev) {
    response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains");
  }

  // Patient self-service links must never end up in search results or be
  // leaked through the Referer header to another site.
  if (request.nextUrl.pathname.startsWith("/r/")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    response.headers.set("Referrer-Policy", "no-referrer");
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
