# CallShield — Remediation Plan

Ordered by risk. Each item lists root cause, affected files, solution, tests,
and rollback.

## 1. Dependency security

- **Issue:** 10 high `npm audit` entries from picomatch ReDoS.
- **Root cause:** Tailwind CSS 3 build chain pins picomatch `<= 4.0.7`; no fixed
  release exists (advisory published with `first_patched_version: null`).
- **Files:** `package.json`, `package-lock.json`.
- **Risk:** Build-time ReDoS only; production tree is clean.
- **Solution:** Do not force Tailwind 4. Keep the lockfile, document the
  advisory, gate CI on `npm audit --omit=dev`, and record the exception. Update
  once a patched picomatch ships.
- **Tests:** `npm audit --omit=dev` in CI.
- **Rollback:** Revert lockfile.

## 2. Authentication and authorization

- **Issue:** Protections exist but have no automated coverage.
- **Files:** `src/lib/server/auth.ts`, `session.ts`, `http.ts`, all API routes.
- **Solution:** Preserve behaviour. Add route-level unit tests for origin
  checks and validation, and keep the authenticated runtime suites. Validate
  `GNANI_BASE_URL` (https in production, no embedded credentials).
- **Tests:** `tests/unit/http.test.ts`, `tests/unit/validate.test.ts`.
- **Rollback:** Isolated helpers only.

## 3. Distributed rate limiting

- **Issue:** Per-process `Map` does not limit across serverless instances.
- **Files:** `src/lib/server/rateLimit.ts`, `db.ts`, all API routes.
- **Solution:** Async fixed-window limiter backed by MongoDB (already the
  shared store, no new service). Keys are SHA-256 hashed before storage so no
  user id is persisted in the limiter collection. In development, fall back to
  the in-memory limiter. In production, if the shared store is unreachable,
  return `503` rather than silently allowing unlimited traffic.
- **Tests:** `tests/unit/rateLimit.test.ts` (window maths, limits, fallback,
  hashed keys, concurrency via fake store).
- **Rollback:** Keep the memory limiter as an internal fallback.

## 4. Audio upload validation

- **Issue:** MIME type is client-controlled; duration is not enforced.
- **Files:** `src/app/api/voice/stt/route.ts`, new
  `src/lib/server/audio.ts`.
- **Solution:** Sniff RIFF/WAVE and MPEG frame signatures, reject other
  containers with `415`, require the declared type to match the sniffed format,
  parse the WAV header for exact duration and walk MP3 frames for duration,
  enforce 0.2–30 s, and read at most 8 MB. All rejection paths return typed
  errors without upstream calls.
- **Tests:** `tests/unit/audio.test.ts` with valid, truncated, oversized,
  mismatched, and random payloads.
- **Rollback:** The sniffer is isolated; remove the call to restore old
  behaviour.

## 5. ESLint and code quality

- **Issue:** No lint configuration.
- **Files:** `eslint.config.mjs`, `package.json`.
- **Solution:** ESLint 9 flat config extending `next/core-web-vitals` and
  `next/typescript`; add `npm run lint`. Fix findings rather than disabling
  rules; no new `eslint-disable` directives.
- **Tests:** `npm run lint` in CI.
- **Rollback:** Delete config and script.

## 6. CI

- **Issue:** No workflow.
- **Files:** `.github/workflows/ci.yml`.
- **Solution:** Node 22, `npm ci`, typecheck, lint, unit tests, production
  audit, build with dummy `AUTH_SECRET`, install Playwright Chromium, run the
  public smoke + accessibility suite against `next start`.
- **Rollback:** Delete workflow.

## 7. Browser test portability

- **Issue:** Hardcoded Windows Chrome path; `playwright-core` has no browser
  management; demo test targets removed guest mode.
- **Files:** `scripts/*.mjs`, `package.json`.
- **Solution:** Shared `scripts/browser.mjs` using `playwright`:
  - default to the Playwright-managed Chromium;
  - allow `CHROME_EXECUTABLE_PATH` (and legacy `CHROME_PATH`) overrides;
  - keep local Windows working by detecting an installed Chrome as a fallback.
- **Tests:** `npm run test:smoke` locally and in CI.

## 8. Unit and integration tests

- **Files:** `tests/unit/*.test.ts`, `scripts/smoke-check.mjs`,
  `scripts/a11y-check.mjs`.
- **Solution:** Node's test runner through `tsx` for pure server logic. Browser
  smoke covers the public site, signed-out redirect, forged-session app shell,
  live simulation, and PWA metadata without external providers. Runtime
  security suites remain for credentialed environments.
- **Tests:** `npm test`, `npm run test:smoke`, `npm run test:a11y`.

## 9. Accessibility

- **Issue:** Unmeasured.
- **Files:** `scripts/a11y-check.mjs`, components with findings.
- **Solution:** axe-core against `/`, `/legal`, `/signin`, and signed-in app
  pages; fix violations; manually check focus, landmarks, labels, reduced
  motion, and live regions.
- **Tests:** `npm run test:a11y` (serious/critical fail the build).

## 10. Performance

- **Issue:** 187 kB first load on `/app/live`.
- **Solution:** Measure before/after. Move the voice driver and heavy live
  sub-panels behind route-level dynamic imports only if measurement shows a
  real win without breaking SSR. Otherwise document the baseline. No feature
  removal.
- **Tests:** `npm run build` route table + Lighthouse if available.

## 11. Documentation and repository hygiene

- **Files:** `README.md`, `.env.example`, `docs/FINAL_AUDIT_REPORT.md`.
- **Solution:** Full setup, auth, Mongo, Gnani, testing, security, limitations,
  deployment. Secret scan, tracked-size check, branch check, asset reference
  check.

## Explicitly out of scope

- Tailwind 4 migration.
- Nonce-based CSP (requires making every page dynamic; would break static
  generation and add risk without a demonstrated XSS vector).
- Replacing NextAuth, MongoDB, or Next.js.
- Production deployment or Git push (requires owner approval).
