import { NextResponse } from "next/server";
import type { RateLimitResult } from "@/lib/server/rateLimitCore";

/**
 * JSON response that must never be replayed from a shared cache or the
 * service worker — used for every per-user payload.
 */
export function jsonNoStore(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * Rejects state-changing requests whose Origin header does not match the Host
 * serving the app. Session cookies are SameSite=Lax, so this is a second layer
 * against cross-site request forgery (and same-site subdomain attacks).
 *
 * Requests without an Origin header (curl, server-to-server) are allowed —
 * they cannot ride a victim's browser cookies.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  if (origin === "null") return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenOrigin(): NextResponse {
  return jsonNoStore({ error: "FORBIDDEN_ORIGIN" }, 403);
}

/**
 * Converts a limiter result into a safe response: 429 when the caller is over
 * budget, 503 when the shared limiter is unavailable in production. Never
 * reveals the hashed key or backend internals.
 */
export function rateLimited(result: RateLimitResult, message: string): NextResponse {
  const response = jsonNoStore(
    {
      error: result.unavailable ? "RATE_LIMIT_UNAVAILABLE" : "RATE_LIMITED",
      message: result.unavailable
        ? "Request protection is temporarily unavailable. Try again shortly."
        : message,
    },
    result.unavailable ? 503 : 429
  );
  response.headers.set("Retry-After", String(result.retryAfterSec));
  return response;
}
