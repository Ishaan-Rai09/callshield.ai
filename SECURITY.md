# Security policy

## Supported versions

CallShield is a prototype maintained on `master`. Security fixes land on
`master`; there are no long-lived release branches.

## Reporting a vulnerability

Please use GitHub's private vulnerability reporting on
[Ishaan-Rai09/callshield.ai](https://github.com/Ishaan-Rai09/callshield.ai/security/advisories/new)
instead of opening a public issue. Include the affected route or file, steps to
reproduce, and the impact you believe is possible.

You can expect an acknowledgement within a few days. Please give us a chance to
ship a fix before public disclosure.

## Scope

In scope:

- Authentication and session handling (`src/lib/server/auth.ts`,
  `src/lib/server/session.ts`)
- Authorization and per-user data isolation in `src/app/api/user/*`
- Rate-limit bypasses (`src/lib/server/rateLimit.ts`,
  `src/lib/server/rateLimitCore.ts`)
- Audio validation bypasses in the STT route
- Secret exposure in client bundles, logs, or responses
- Injection, SSRF, and open-redirect issues in server routes
- CSP and security-header regressions

Out of scope:

- The simulated call experience itself: no real calls, numbers, or
  organisations are involved.
- Risk labels: these are heuristic signals, not fraud determinations.
- Missing provider credentials causing captions-only mode; this is documented
  behaviour.
- Denial of service through traffic volume rather than an application flaw.
- Findings in build-time dependencies with no runtime reachability (see the
  dependency advisory in `docs/FINAL_AUDIT_REPORT.md`).

## Handling secrets

- Never commit `.env.local` or provider keys. `.env.example` lists names only.
- Google OAuth secrets, `AUTH_SECRET`, `MONGODB_URI`, and Gnani keys are
  server-only. `NEXT_PUBLIC_*` variables must never hold secrets.
- Rotate any credential that may have been exposed, then review Git history
  before making a repository public.
- Test sessions in `scripts/` are signed with a locally supplied `AUTH_SECRET`
  and are never production credentials.

## Existing advisories

The production dependency tree is gated in CI with
`npm audit --omit=dev --audit-level=high`. A known build-time-only ReDoS
advisory in the Tailwind/PostCSS glob chain is documented in
`docs/FINAL_AUDIT_REPORT.md` with its reachability analysis.
