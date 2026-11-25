# CallShield

**Your calls. Your control.**

CallShield is a voice-first prototype of an AI call-screening product. An
assistant answers simulated unknown callers, asks who they are and why they are
calling, surfaces suspicious signals in real time, and hands the decision back
to you. Every caller and assistant line can be spoken by
[Gnani Timbre](https://docs.vachana.ai), and your spoken replies are transcribed
by Gnani Prisma.

> **Prototype notice:** CallShield does not intercept real cellular calls or
> access a phone's call log. Every caller, number, and organisation is fictional.
> Risk labels are heuristic signals, not proof of fraud and not a verified fraud
> determination. Without a Gnani key, the call runs in captions-only mode.

## The problem

People answer unknown numbers because the alternative is missing something
important. Scams exploit that: urgency, impersonation, and requests for OTPs or
card details. Blocking every unknown call is too blunt, and trusting every call
is unsafe.

## The solution

An AI screening layer answers first, keeps the caller talking, extracts identity
and intent, and scores the conversation against known manipulation patterns.
You see the transcript, risk level, requested information, and specific signals
while the call is happening, then choose to take over, allow, end, or block the
caller.

### What is included

- **Marketing site** with a live, auto-playing screening preview and plain-language
  [legal notes](/legal).
- **Account-only dashboard** with stats, recent activity, assistant status, and a
  live-screening entry point.
- **Six scenarios:** appointment confirmation, bank impersonation, fake KYC,
  delivery payment, prize scam, and investment offer.
- **Live call stage:** caller/AI avatars, waveform, rolling captions, full
  transcript, and live intelligence (intent, risk, indicators, information
  requested, identity confidence, summary).
- **Voice:** Gnani Timbre for caller/assistant speech, push-to-talk recording with
  Gnani Prisma transcription, six assistant voices, mute and preview controls,
  and a typed fallback.
- **Four working actions:** Take Over, Allow, End, and Block. Decisions persist.
- **History, blocklist, assistant settings, settings, notifications, and PWA
  install/offline support.**
- **Per-user data:** Google sign-in; call history and blocklist stored in MongoDB
  and scoped by user id. Assistant preferences stay on the device.

## Architecture

```
src/
  app/
    page.tsx                 Marketing landing page
    legal/                   Prototype and privacy notes
    signin/                  Google sign-in
    app/                     Authenticated shell: dashboard, live, history,
                             blocklist, assistant, settings
    api/
      auth/[...nextauth]/    NextAuth (Google, JWT sessions)
      integrations/status/   Gnani readiness metadata (no secrets)
      user/                  Per-user calls, blocklist, seed, reset
      voice/tts/             Authenticated Gnani Timbre proxy
      voice/stt/             Authenticated Gnani Prisma proxy + audio validation
  components/                Landing, app shell, live call, history, settings, UI
  lib/
    scenarios.ts             Six scripted scenarios
    risk.ts                  Indicator catalog and scoring
    services/                Conversation, risk, and call-simulation logic
    store/                   Client state, persistence, and live-session engine
                             (CallShieldProvider, context, types, prefs)
    voice/                   Voice catalog, playback provider, speech driver, mic
    server/
      auth.ts session.ts     NextAuth + current user resolution
      db.ts                  Mongo client, collections, indexes
      http.ts                No-store JSON, same-origin guard, 429/503 helper
      rateLimit.ts           Shared fixed-window limiter (Mongo) + dev fallback
      rateLimitCore.ts       Hashing and window primitives (unit-tested)
      audio.ts               WAV/MP3 signature and duration validation
      validate.ts            Server-side schema sanitization
      gnani.ts               Server-only Gnani client (TTS, STT, clone)
scripts/                     Browser, security, voice, and developer checks
tests/unit/                  Node test runner suites
docs/                        Baseline audit, remediation plan, final report
```

### Voice pipeline

```
caller / assistant line → POST /api/voice/tts → Gnani Timbre → mp3 → <audio>
your reply → MediaRecorder → 16 kHz WAV → POST /api/voice/stt → Prisma → text
```

Call progress is speech-paced: new script lines are held while a voice line
plays, so captions never outrun the audio. With no key or a playback failure,
the hold is released and the call continues as captions plus typed replies.

### Data and auth

- Google sign-in through NextAuth v5 (JWT session, verified email required).
- MongoDB collections `users`, `calls`, `blocked`, and `rateLimits`.
- Rows are namespaced `${userId}:${recordId}`, and every query filters by the
  authenticated user id.
- No guest mode: without MongoDB and Google credentials, sign-in is unavailable
  rather than insecure.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 3 ·
Framer Motion · Lucide · Gnani Timbre + Prisma · NextAuth v5 · MongoDB Atlas ·
ESLint 9 · Playwright · axe-core · Node test runner.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`. Sign-in requires the environment below; voice is
optional.

### Environment variables

Create `.env.local` (never commit it). See `.env.example`.

| Variable                              | Required                         | Purpose                                        |
| ------------------------------------- | -------------------------------- | ---------------------------------------------- |
| `MONGODB_URI`                         | Yes, for sign-in and persistence | Atlas connection string                        |
| `AUTH_SECRET`                         | Yes                              | Session signing key (`npx auth secret`)        |
| `GOOGLE_CLIENT_ID`                    | Yes, for sign-in                 | Google OAuth client                            |
| `GOOGLE_CLIENT_SECRET`                | Yes, for sign-in                 | Google OAuth secret                            |
| `AUTH_TRUST_HOST`                     | Production outside Vercel        | Set `true` only when the host is controlled    |
| `GNANI_API_KEY`                       | Optional                         | Enables call audio and transcription           |
| `GNANI_BASE_URL`                      | Optional                         | Must be https in production; defaults to Gnani |
| `GNANI_TTS_MODEL` / `GNANI_STT_MODEL` | Optional                         | Default `timbre-v2.5` / `prisma-v2.5`          |
| `GNANI_CLONE_AUDIO`                   | Optional                         | Reference clip or data URI for voice cloning   |

### MongoDB setup

1. Create a free Atlas cluster and a database user.
2. Add your current IP to the network access list (use a narrow range in
   production).
3. Put the connection string in `MONGODB_URI` (include the database name).
4. On first request the app creates the unique and per-user indexes.

Collections are created automatically. `scripts/mongo-check.mjs` pings the
cluster and round-trips a test document.

### Google OAuth setup

1. Create an OAuth client (Web application) in Google Cloud Console.
2. Authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
   and the equivalent production URL.
3. Put the client id/secret in `.env.local` and restart.
4. Without these values and MongoDB, the sign-in page explains that sign-in is
   not configured; there is no bypass.

### Gnani setup

Add `GNANI_API_KEY` and restart. Then:

- caller and assistant lines are synthesised by Timbre and played in the call
  stage;
- **Take Over → Speak** records up to 25 seconds, re-encodes to 16 kHz mono WAV
  in the browser, and sends it through the server proxy to Prisma;
- the browser never sees the key; only `/api/voice/tts` and `/api/voice/stt`
  read it.

Verify with `npm run test:voice` while the server is running (spends credits).
Voice cloning is optional; `assets/generated-audio.wav` is the reference clip
used by the current configuration. Treat it as sensitive personal data if the
repository is public, and replace it with your own consenting recording before
enabling cloning.

## 60-second demo

1. Sign in with Google.
2. **Simulate Incoming Call → Bank impersonation scam → Let AI Answer.**
3. Watch risk and indicators update as the caller speaks.
4. **Take Over** and speak (or type) a reply.
5. **Block Caller**; open the blocklist and history to see the saved decision.
6. Install the PWA from the browser menu.

## Testing and verification

| Command                 | What it covers                                                                                                                                                                             | Requirements                                 |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| `npm run typecheck`     | Strict TypeScript                                                                                                                                                                          | none                                         |
| `npm run lint`          | ESLint 9, Next core-web-vitals + TS                                                                                                                                                        | none                                         |
| `npm test`              | 51 unit tests: audio sniffing/duration, rate-window maths, hashing, origin checks, sanitization, Gnani URL safety, formatting, risk scoring, scenarios, call lifecycle, preference storage | none                                         |
| `npm run build`         | Production build                                                                                                                                                                           | `AUTH_SECRET` in production mode             |
| `npm run test:smoke`    | Public pages, headers, signed-out redirect, forged-session dashboard/live/history/settings, mobile drawer, PWA manifest                                                                    | server + `AUTH_SECRET` + Playwright Chromium |
| `npm run test:a11y`     | axe-core WCAG A/AA on 9 routes; fails on serious/critical                                                                                                                                  | same                                         |
| `npm run test:demo`     | Full account flow: seed, scenario, risk, block, history, takeover, voice settings, allow, filters, restore                                                                                 | server + MongoDB                             |
| `npm run test:security` | Unauthenticated closure, CSRF origin, validation, no-store, headers, cleanup                                                                                                               | server + MongoDB                             |
| `npm run test:routes`   | Every per-user route with a signed session                                                                                                                                                 | server + MongoDB + test user                 |
| `npm run test:voice`    | TTS → STT round trip                                                                                                                                                                       | server + Gnani key                           |

Browser scripts use Playwright-managed Chromium by default and accept
`CHROME_EXECUTABLE_PATH` (or legacy `CHROME_PATH`) for a system browser. Install
the managed browser once with `npx playwright install chromium`.

`scripts/signout-check.mjs` and `scripts/auth-only-check.mjs` remain available
for session/cache checks; the latter requires a real test user id and email.

### CI

`.github/workflows/ci.yml` runs on every push and pull request:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run format:check`
5. `npm test`
6. `npm audit --omit=dev --audit-level=high`
7. `npm run build` with a dummy `AUTH_SECRET`
8. Playwright Chromium install, production server, `test:smoke`, `test:a11y`

No real OAuth, Mongo, or Gnani credentials are used in CI. Authenticated
database suites remain manual/integration checks.

## Security

- **Authorization:** every `/api/user/*`, `/api/voice/*`, and
  `/api/integrations/*` route requires a valid session. Tenant queries filter on
  the session's user id and namespaced row ids.
- **CSRF:** state-changing requests require a matching Origin (when a browser
  sends one). Session cookies are SameSite=Lax.
- **Rate limiting:** fixed windows are stored in MongoDB and shared by all
  instances. Keys are SHA-256 hashed before storage; limits are per user _and_
  endpoint (TTS/STT/writes). Local development without Mongo falls back to
  memory; production refuses billable requests (`503`) if the shared limiter is
  unavailable.
- **Audio uploads:** the STT route requires auth, caps the request at 8 MB,
  sniffs the actual WAV/MP3 container, rejects mismatched MIME types and other
  containers, enforces 0.2–30 seconds, and only then calls the provider.
- **Input handling:** payloads are size-capped, schema-validated, stripped of
  unknown fields, and re-validated on read.
- **Secrets:** `AUTH_SECRET` is mandatory in production; the Gnani key is
  server-side only; provider base URLs reject non-http(s) schemes, embedded
  credentials, and plain http in production; status responses expose no secrets.
- **Headers:** CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, strict referrer
  policy, microphone-scoped Permissions-Policy, and no `X-Powered-By`.
- **Service worker:** does not cache `/api/*` or app pages; sign-out clears
  cached private data.
- **Dependency audit:** the runtime dependency tree is clean
  (`npm audit --omit=dev`: 0). The full audit reports 10 high entries from one
  build-time ReDoS advisory in Tailwind's glob chain
  (`GHSA-fc5q-39xc-vjpf` / picomatch `<= 4.0.7`). No patched version exists; npm's
  only offered fix upgrades Tailwind 3 → 4. It is documented as accepted
  build-time risk in `docs/AUDIT_BASELINE.md`, and CI gates on the production
  tree. Revisit when a fixed picomatch ships.
- **CSP:** `script-src` still includes `'unsafe-inline'` because Next.js injects
  inline bootstrap scripts. A nonce policy requires dynamic rendering on every
  route; that trade-off is documented in `docs/REMEDIATION_PLAN.md`.

## Deployment

1. Push the repository (one branch, under 10 MB, no secrets) and import it into
   Vercel.
2. Add `MONGODB_URI`, `AUTH_SECRET`, `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, and optionally `GNANI_API_KEY` as environment
   variables.
3. On Vercel, trusted forwarded hosts are handled automatically. On another
   host, set `AUTH_TRUST_HOST=true` only behind a proxy you control.
4. Add the production OAuth redirect URI in Google Cloud Console.
5. Keep Atlas network access as narrow as the deployment platform allows.
6. Optional voice cloning requires `GNANI_CLONE_AUDIO`; do not commit personal
   reference audio to a public repository.

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — layers, state model, live-call engine,
  security boundaries, and extension points.
- [Security policy](SECURITY.md) — reporting, scope, and secret handling.
- [Contributing](CONTRIBUTING.md) — setup, verification commands, and code
  conventions.
- [Baseline audit](docs/AUDIT_BASELINE.md), [remediation plan](docs/REMEDIATION_PLAN.md),
  and [final audit report](docs/FINAL_AUDIT_REPORT.md).

## Known limitations

- Calls are scripted simulations. There is no telephony, SIP, or real call
  interception.
- Risk is heuristic, not verified fraud detection.
- Data is stored in MongoDB as JSON without field-level encryption.
- Notifications are in-app only (no push/email/SMS).
- Demo scripts are English; the language preference is stored but not every line
  is localised.
- Hands-free audio relies on browser echo cancellation; loudspeakers can leak
  caller audio into a clip.
- Rate limits use a one-minute fixed window (a burst at a window boundary can
  briefly double the effective rate).
- The full dependency audit retains the build-time picomatch advisory described
  above.
- Real Google OAuth, MongoDB, and Gnani calls require credentials and are not
  exercised by CI.
