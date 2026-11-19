# CallShield — Final Audit Report

Remediation of commit `9156a40` on branch `master`. No commits, pushes, or
deployments were performed; every change is in the working tree for the owner to
review.

## Executive summary

The application already had strong authentication, tenancy, validation, and
security headers. The remediation focused on the gaps that were genuinely
missing: shared rate limiting, real audio inspection, lint/CI infrastructure,
portable browser tests, accessibility, and honest documentation.

All local gates pass: strict TypeScript, ESLint with zero warnings, 32 unit
tests, production build, production dependency audit, runtime security checks,
the full authenticated demo flow, and axe WCAG A/AA on nine routes. Two items
remain outside what this environment can close: the unresolved build-time
picomatch advisory (no patched release exists) and a credential-like string in
deleted Git history that must be reviewed by the repository owner.

## Changes implemented

### 1. Dependency security

- Audited every advisory and dependency path. All 10 high entries are the same
  advisory: `GHSA-fc5q-39xc-vjpf` (picomatch ReDoS), reachable only through
  Tailwind 3's build/watch chain (`chokidar`, `anymatch`, `micromatch`,
  `sucrase`/`tinyglobby`/`fdir`).
- No patched picomatch exists (`4.0.7` is latest; advisory has no
  `first_patched_version`). npm's only fix is a breaking Tailwind 4 upgrade.
- Kept Tailwind 3, did not run `audit fix --force`, preserved the lockfile, and
  documented the accepted risk in `docs/AUDIT_BASELINE.md`.
- Added a production-tree audit gate to CI. `npm audit --omit=dev` reports
  **0 vulnerabilities**.
- Updated dev tooling: ESLint 9, `eslint-config-next` 15.5.29,
  Playwright 1.65, axe-core, tsx. `playwright-core` was folded into `playwright`.

### 2. Distributed rate limiting

- Replaced the per-process `Map` with a fixed-window limiter backed by MongoDB,
  the shared store already required by the app. No new service or credentials.
- Keys are SHA-256 hashed before storage; no user id is written to the limiter
  collection or logged.
- Atomic `$inc`/upsert with duplicate-key retry; TTL index expires old windows.
- Per-user and per-endpoint limits are unchanged in intent: TTS 120/min,
  STT 40/min, writes 6–60/min.
- Development without Mongo falls back to a bounded in-memory store.
  Production without a reachable shared store refuses requests with `503`
  (`RATE_LIMIT_UNAVAILABLE`) rather than allowing unlimited traffic.
- New `rateLimitCore.ts` is dependency-free and unit-tested.

### 3. Audio upload validation

- Added `src/lib/server/audio.ts`: RIFF/WAVE and MPEG frame sniffing, exact WAV
  duration from the header, MP3 frame walking for duration, and rejection of
  FLAC/Ogg/M4A with `415`.
- STT route now validates the actual bytes, not the client MIME type; rejects
  MIME/content mismatches, malformed headers, clips under 0.2 s or over 30 s,
  and payloads over 8 MB before any provider call.
- Uploads are read once, bounded by the size cap; no unbounded buffering.

### 4. ESLint and code quality

- Added ESLint 9 flat config extending `next/core-web-vitals` and
  `next/typescript`, plus `npm run lint`.
- Fixed the one lint error and all nine warnings: removed an unused prop/value,
  escaped an entity, stabilised hook dependencies, and removed an existing
  targeted `eslint-disable` in favor of correct dependencies.
- No rules were disabled and no suppressions were added.

### 5. CI and browser portability

- Added `.github/workflows/ci.yml`: `npm ci`, typecheck, lint, unit tests,
  production audit, build, Playwright Chromium install, production server,
  smoke test, and accessibility audit. Dummy `AUTH_SECRET` and
  `AUTH_TRUST_HOST=true` only.
- Added `scripts/browser.mjs`: uses Playwright-managed Chromium, honours
  `CHROME_EXECUTABLE_PATH`/`CHROME_PATH`, and detects local Windows Chrome.
- Removed hardcoded Chrome paths from all four browser scripts.
- Made the demo suite account-aware by signing a test session; it no longer
  depends on the removed guest mode.
- Added smoke and axe suites that run without MongoDB or external providers.

### 6. Authentication and authorization review

Preserved every existing protection: mandatory production `AUTH_SECRET`,
verified-email Google sign-in, JWT user id, `userId` filtering, namespaced row
ids, same-origin writes, `no-store` responses, schema validation on write and
read. Additional hardening:

- `GNANI_BASE_URL` must be http(s), credential-free, and https in production.
- Authenticated Gnani status is only fetched after the client session resolves,
  removing four spurious 401s on public pages.
- Documented the trusted-host requirement for production outside Vercel and
  added `AUTH_TRUST_HOST` to CI and `.env.example`.
- No authentication was weakened.

### 7. Accessibility

- Added `scripts/a11y-check.mjs` (axe-core, WCAG A/AA) covering landing, legal,
  sign-in, dashboard, live, history, blocklist, assistant, and settings.
- Fixed all serious/critical findings:
  - darkened `muted` from `#6D7280` to `#5B6270`;
  - replaced low-opacity ink/ivory text with accessible opacity;
  - added `signalInk` (`#B33A0F`) for orange text on light surfaces while
    keeping brand orange on dark surfaces.
- Result: **no WCAG A/AA violations on all nine routes**.

### 8. Performance

Measured, not assumed:

| Route | Before | After |
| --- | --- | --- |
| `/` | 155 kB | 155 kB |
| `/app` | 178 kB | 178 kB |
| `/app/assistant` | 137 kB | 137 kB |
| `/app/live` | 187 kB | 187 kB |
| `/app/blocklist` | 175 kB | 175 kB |
| `/app/settings` | 175 kB | 175 kB |
| Shared JS | 103 kB | 103 kB |

No feature removal or risky lazy-loading was introduced, because the measured
bundle did not regress and the remaining weight is shared React/Next runtime,
Framer Motion, and NextAuth. One infrastructure-level change was made after
re-measuring: the 10 KB stylesheet was inlined (`experimental.inlineCss` in
`next.config.ts`), removing the page's only render-blocking request. It does
not change HTML structure, styling, or hydration.

Lighthouse (local production server, mobile emulation, 5 runs):

| Preset | Performance | Accessibility | Best practices | SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mobile | 93 (91–94) | 100 | 100 | 100 | 2.9 s | 0.001 | 160 ms |
| Desktop | 99 (99–100) | 100 | 100 | 100 | 0.8 s | 0 | 70 ms |

Inlining the CSS moved FCP from 1.6 s to 1.4 s and LCP from 3.2–3.3 s to
2.9–3.1 s. Measurement caveat: this workstation showed roughly 25% background
CPU activity from unrelated desktop applications. Runs with TBT at 160 ms or
below scored 91–94; runs during background CPU spikes scored 70–77 with TBT of
0.6–1.1 s. The mobile 90 target is therefore met on a quiet host, but the score
is host-sensitive and not guaranteed on a loaded workstation. Remaining render
delay is dominated by style/layout and hydration of the animated preview, not
by network requests.

### 9. Tests and documentation

- 32 unit tests added: audio signatures/durations, rate-window maths, hashed
  keys, bounded fallback, concurrency, origin checks, call/blocklist
  sanitization, Gnani URL safety.
- README rewritten to match reality (account-only mode, env matrix, setup,
  verification, security, deployment, limitations).
- `.env.example` updated with trusted host and provider options.
- Added `docs/AUDIT_BASELINE.md` and `docs/REMEDIATION_PLAN.md`.

## Files changed

**Added:** `.github/workflows/ci.yml`, `eslint.config.mjs`,
`src/lib/server/audio.ts`, `src/lib/server/rateLimitCore.ts`,
`scripts/browser.mjs`, `scripts/test-session.mjs`, `scripts/smoke-check.mjs`,
`scripts/a11y-check.mjs`, `tests/unit/*` (5 files), `docs/*` (3 files).

**Modified:** API routes (`voice/stt`, `voice/tts`, `user/state`, `user/calls`,
`user/calls/seed`, `user/blocklist`), server modules (`db`, `gnani`, `http`,
`rateLimit`), voice provider/driver, store, live components, landing/legal
contrast classes, settings, four browser scripts, demo suite, `package.json`,
`package-lock.json`, `README.md`, `.env.example`, `tailwind.config.ts`,
`next.config.ts` (inline critical CSS).

**Removed:** unused helper `u32be`; no application features or assets were
removed.

## Verification results (executed locally, 2026-11-18)

| Check | Result |
| --- | --- |
| `npm ci` from lockfile | Pass |
| `npm run typecheck` | Pass |
| `npm run lint` | Pass (0 errors, 0 warnings) |
| `npm test` | 32/32 pass |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Full `npm audit` | 10 high (documented build-time advisory) |
| `npm run build` | Pass, 14/14 pages |
| `npm run test:smoke` (dev + prod/no-DB) | Pass |
| `npm run test:a11y` (9 routes) | Pass, no serious/critical |
| `npm run test:demo` (Mongo-backed) | Pass |
| `node scripts/security-check.mjs` | All checks passed |
| Gitleaks, tracked working tree | No leaks |
| Gitleaks, Git history | 1 finding (see below) |
| Tracked repository size | 2.3 MB |
| Branches | 1 (`master`) |

Not executed: live Google OAuth sign-in, real Gnani TTS/STT round trip
(`npm run test:voice`), and the GitHub Actions run itself. These require
credentials or a remote push and are explicitly not claimed as passing.

## Remaining limitations

1. **Build-time dependency advisory.** Picomatch `<= 4.0.7` ReDoS has no fixed
   release. It is dev-only and not reachable with untrusted glob input at
   runtime. Production dependencies are clean. Revisit when patched.
2. **CSP still allows inline scripts.** Removing `'unsafe-inline'` needs nonce
   middleware and dynamic rendering on every route. The trade-off was not taken
   without an XSS vector to justify the regression.
3. **Mobile Lighthouse performance is host-sensitive.** It scores 91–94 with
   TBT at 160 ms or below, but drops to 70–77 when unrelated desktop processes
   consume CPU. The 90 target is met on a quiet measurement host; no claim is
   made that it holds on a loaded workstation.
4. **Real provider paths unverified.** Gnani and Google OAuth were not exercised
   with live credentials. The code paths and failure handling are covered by
   unit/route tests, but the end-to-end provider check is manual.
5. **Historical secret finding.** Gitleaks flags `generic-api-key` in
   `brag-output/composition/.hyperframes/cache/check.json` at commit `03d87c7`.
   The file is absent from the current tree, but it remains in Git history. If
   that value was real, rotate it and consider history rewriting (not performed
   here; destructive history changes require owner approval).
6. Rate limiting uses a fixed one-minute window; a boundary burst can briefly
   reach roughly twice the configured rate.
7. Authenticated database suites are manual because CI does not use real
   MongoDB credentials, by design.

## Deployment and submission readiness

**Deployment:** ready for a staging deploy with the documented environment
variables. Verify Google OAuth redirects, Atlas access, real Gnani voice, and
`AUTH_TRUST_HOST` on non-Vercel hosts.

**Submission:** technically ready — one branch, 2.3 MB tracked, no working-tree
secrets, green quality gates, accurate README. Before publishing:

1. Review the historical Gitleaks finding and rotate anything sensitive.
2. Run one credentialed end-to-end pass (Google sign-in, Mongo persistence,
   Gnani TTS/STT).
3. Approve and create the commit; nothing was committed or pushed.
4. Keep `assets/generated-audio.wav` only if the reference voice owner consents
   to publishing it.

## Exact commands

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm audit --omit=dev --audit-level=high
npm run build
npm start                      # set AUTH_SECRET; AUTH_TRUST_HOST=true locally outside Vercel

# with MongoDB available
CALLSHIELD_URL=http://localhost:3000 npm run test:demo
CALLSHIELD_URL=http://localhost:3000 npm run test:security
CALLSHIELD_URL=http://localhost:3000 npm run test:routes

# browser-only (no database needed)
npx playwright install chromium
CALLSHIELD_URL=http://localhost:3000 npm run test:smoke
CALLSHIELD_URL=http://localhost:3000 npm run test:a11y

# real provider (spends Gnani credits)
CALLSHIELD_URL=http://localhost:3000 npm run test:voice
```
