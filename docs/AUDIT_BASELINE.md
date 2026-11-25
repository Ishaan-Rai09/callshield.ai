# CallShield — Audit Baseline

Captured before remediation on commit `9156a406b2dc9a332e5c86a422edb6ac4cb9b769`
(`master`, working tree clean).

## Repository

| Item                  | Value                                                   |
| --------------------- | ------------------------------------------------------- |
| Tracked size          | 2.1 MB (`git ls-files` total)                           |
| Branches              | 1 local branch (`master`); `origin/master` tracking ref |
| Largest tracked asset | `assets/generated-audio.wav` (1.3 MB)                   |
| `.env.local`          | Present locally, gitignored, never committed            |
| Secrets in tree       | None observed; full scan scheduled in Phase 6           |

## Baseline commands

| Command                | Result                                         |
| ---------------------- | ---------------------------------------------- |
| `npm run typecheck`    | Pass (exit 0)                                  |
| `npm run build`        | Pass; 14 routes generated                      |
| `npm run lint`         | Not available — no ESLint dependency or config |
| Unit tests             | None defined                                   |
| `npm audit`            | 10 high, 0 critical/moderate/low               |
| `npm audit --omit=dev` | 0 vulnerabilities                              |

### Baseline first-load JS

| Route            | First load        |
| ---------------- | ----------------- |
| `/`              | 155 kB            |
| `/app`           | 178 kB            |
| `/app/assistant` | 137 kB            |
| `/app/live`      | 187 kB (heaviest) |
| `/app/blocklist` | 175 kB            |
| `/app/settings`  | 175 kB            |

Shared first-load JS: 103 kB.

## Confirmed findings

### 1. Dependency advisory — HIGH (accepted risk, no patch exists)

`npm audit` reports 10 high entries, all the same root advisory:
`GHSA-fc5q-39xc-vjpf` — picomatch ReDoS through single-branch repeated
extglobs. Affected range is `<= 4.0.7`; at capture time **no patched version
has been published** (npm latest is 4.0.7) and npm offers only
`npm audit fix --force`, which upgrades Tailwind CSS 3 to 4 (a breaking
migration this remediation must avoid).

Dependency path (all devDependencies):

```
tailwindcss@3.4.19
├── chokidar@3.6.0 → anymatch@3.1.3 → picomatch@2.3.2
│                  → readdirp@3.6.0  → picomatch@2.3.2
├── micromatch@4.0.8 → picomatch@2.3.2
└── sucrase@3.35.1 → tinyglobby@0.2.17 → fdir@6.5.0 / picomatch@4.0.7
```

Runtime risk: **none**. The package is not in the production dependency tree
(`npm audit --omit=dev` is clean), and the API consumes no user-supplied glob
patterns. The ReDoS requires an attacker-controlled extglob pattern, which only
occurs in the local Tailwind build/watch pipeline.

### 2. In-memory rate limiting — HIGH

`src/lib/server/rateLimit.ts` stores counters in a per-process `Map`. Vercel
functions scale horizontally, so the effective limit is `limit × instances`.
Limits are already scoped per user and endpoint, and applied to TTS, STT, call
writes, blocklist writes, and state resets.

### 3. Audio upload validation — HIGH

`src/app/api/voice/stt/route.ts` verifies auth, CSRF origin, size, language,
and a client-supplied `audio/*` MIME type. It does not inspect the container
signature or duration, so a non-audio payload with a forged MIME type is
forwarded to Gnani.

### 4. Browser automation portability — HIGH

`auth-only-check.mjs`, `demo-check.mjs`, and `signout-check.mjs` default to
`C:/Program Files/Google/Chrome/Application/chrome.exe`. Linux CI cannot run
them. `scripts/demo-check.mjs` also still asserts the removed guest
`localStorage` blob and an unauthenticated demo path, so it cannot pass against
the account-only app.

### 5. ESLint — HIGH

No ESLint package, config, or `npm run lint` script. Standalone ESLint 10 fails
without a flat config.

### 6. CI — HIGH

No `.github/workflows/`. Nothing runs typecheck, lint, tests, audit, or build on
push/PR.

### 7. Security review — mostly sound, gaps noted

Positive: production requires `AUTH_SECRET`; Google `email_verified` enforced;
JWT carries a Mongo user id; every tenant query filters by `userId`; same-origin
checks on all writes; `Cache-Control: no-store` on per-user JSON; strict
validation and re-validation on read; Gnani key server-side only; security
headers present.

Gaps: no shared rate-limit store; CSP keeps `'unsafe-inline'` for scripts
(required by Next.js without nonce middleware); CSRF check trusts a missing
Origin header (documented, not browser-reachable); configurable
`GNANI_BASE_URL` is not scheme-validated; no automated authorization tests in
CI.

### 8. Testing — HIGH

No `npm test`, no unit tests, no accessibility checks. The runtime
`scripts/security-check.mjs` and `scripts/verify-user-routes.mjs` are useful but
require a live server and MongoDB; none run in CI.

### 9. Accessibility — unmeasured

No axe-core or manual audit. Known areas to check: modal/drawer focus
management, live-region announcements, contrast of muted text, icon button
names, and reduced-motion handling.

### 10. Performance — measured

Live screening is the heaviest route at 187 kB first load. Framer Motion,
Lucide icons, and NextAuth session handling dominate shared JS. No regression
budget exists.

## Baseline limitations

- Real Gnani TTS/STT and Google OAuth are credential-dependent and were not
  exercised during this baseline.
- MongoDB connectivity depends on the local `.env.local`; CI will not use real
  credentials.
