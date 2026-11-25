import { readFileSync } from "node:fs";
import { encode } from "next-auth/jwt";

/**
 * Creates a signed Auth.js session cookie for browser and API checks.
 * Requires AUTH_SECRET in the environment or .env.local. Values are never
 * printed. The cookie is a test credential — never a production secret.
 */

export const SESSION_COOKIE = "authjs.session-token";

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
      for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
        if (match && !(match[1] in process.env)) process.env[match[1]] = match[2];
      }
    } catch {
      // Missing env file: the caller reports the useful error.
    }
  }
}

export async function createSessionToken({ uid, email, name = "CallShield Test" }) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required. Set it in the environment or .env.local before running authenticated checks.",
    );
  }
  return encode({
    secret,
    salt: SESSION_COOKIE,
    maxAge: 60 * 60,
    token: { email, uid, sub: uid, name },
  });
}

export async function addSessionCookie(context, token) {
  await context.addCookies([
    { name: SESSION_COOKIE, value: token, domain: "localhost", path: "/" },
  ]);
}
