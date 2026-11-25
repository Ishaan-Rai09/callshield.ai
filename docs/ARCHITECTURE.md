# Architecture

CallShield is a Next.js App Router application with a client-side screening
simulation and a small, authenticated server surface. This document describes
how the pieces fit together, why the boundaries are where they are, and how to
extend them without weakening the security model.

## Runtime topology

```
Browser (React 19)
  ├─ public pages: landing, legal, sign-in
  └─ /app: dashboard, live screening, history, blocklist, assistant, settings
        │
        │ same-origin fetch, signed Auth.js session cookie
        ▼
Next.js on Vercel (Node runtime)
  ├─ /api/auth/*             Google OAuth + JWT session
  ├─ /api/user/*             per-user state, calls, blocklist, seed/reset
  ├─ /api/voice/*            authenticated Gnani TTS/STT proxies
  └─ /api/integrations/status
        │
        ├─ MongoDB (users, calls, blocklist, rate-limit windows)
        └─ Gnani (Timbre TTS, Prisma STT)
```

Browser speech APIs are used only for recording and playback; provider keys
never leave the server. Missing MongoDB, Google, or Gnani credentials degrade to
the documented fallbacks instead of crashing the public site.

## Layers

| Layer          | Location                                  | Responsibility                                                                               |
| -------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| Routes         | `src/app`                                 | Server components, metadata, auth redirects, route boundaries (`error.tsx`, `not-found.tsx`) |
| API handlers   | `src/app/api`                             | Authenticate, rate-limit, validate, call a server module, return no-store JSON               |
| Server modules | `src/lib/server`                          | Auth/session, Mongo access, HTTP helpers, rate limiting, audio validation, Gnani client      |
| Client state   | `src/lib/store`                           | Account, calls, blocklist, notifications, live session, toasts                               |
| Domain logic   | `src/lib/services`                        | Conversation, risk analysis, call-simulation orchestration                                   |
| Domain data    | `src/lib/scenarios.ts`, `src/lib/seed.ts` | Scripted scenarios and realistic sample history                                              |
| Presentation   | `src/components`                          | Landing, app shell, live stage, views, shared UI                                             |
| Voice          | `src/lib/voice`                           | Catalog, playback provider, mic capture, speech driver, WAV encoding                         |

Dependencies point downwards. Server modules never import client components;
client modules never import provider keys or server-only code.

## State model

There are two sources of truth, deliberately separated:

1. **MongoDB** owns the account's calls and blocklist. The `/api/user/*` routes
   scope every read and write to the session's user id.
2. **Device storage** owns assistant preferences, notifications, and the phone
   label, namespaced per account under `callshield.v1.account.<userId>`.

`CallShieldProvider` hydrates in this order:

```
session resolves → GET /api/user/state (server truth)
                 → read device prefs (presentation preferences)
                 → render authenticated UI
```

Writes update local state first for a responsive UI, then sync to the server on
a best-effort basis (`syncServer`). A failed sync leaves the local session
usable; the next sign-in re-reads the database. Signing out clears in-memory
account data immediately so the previous user's calls cannot flash.

The provider exposes a single `useCallShield()` hook. Only the provider is
allowed to mutate critical state; views receive data and callbacks.

## Live-call engine

The screening simulation is pure orchestration. `callSimulationService` accepts
a session plus a scenario and returns a new session; it does not touch React,
storage, or the network. The provider owns the one-second timer:

```
tick(session, scenario, elapsed, maxSteps) → next session
```

Speech pacing is handled with a ref (`setSpeechHold`) so caption lines pause
while audio plays without re-rendering the timer. Finalizing produces a
`CallRecord` that is prepended to local history and synced to the API.

Scenario data is immutable. Hinglish flavour is applied by copying the scenario,
never by mutating the shared catalog.

## Voice pipeline

```
caller/assistant line → POST /api/voice/tts → Gnani Timbre → mp3 → <audio>
user reply → MediaRecorder → 16 kHz mono WAV → POST /api/voice/stt → Gnani Prisma → text
```

Both routes require a session and a rate limit. STT validates the actual
container signature and duration before spending provider credits. Playback
failures release the caption hold, so a call remains usable in captions-only
mode.

## Security boundaries

- **Authentication:** Auth.js v5 with Google and JWT sessions. `trustHost` is
  enabled only on Vercel or when `AUTH_TRUST_HOST=true` is set explicitly.
- **Authorization:** every per-user route resolves the session user id and
  filters database queries by it. Row ids are also namespaced by user.
- **CSRF:** state-changing requests check the `Origin` header when the browser
  sends one; session cookies are `SameSite=Lax`.
- **Rate limiting:** fixed windows live in MongoDB with SHA-256-hashed keys.
  Production fails closed (`503`) when the shared store is unavailable.
- **Input handling:** payloads are size-capped, schema-validated, stripped of
  unknown fields, and re-validated on read.
- **Headers/CSP:** `frame-ancestors 'none'`, `nosniff`, no `X-Powered-By`, and a
  CSP that permits only the assets the app actually loads.
- **Uploads:** 8 MB cap, signature sniffing, MIME/container agreement, 0.2–30 s.

See [SECURITY.md](../SECURITY.md) for reporting and the dependency advisory.

## Testing strategy

| Level         | Tool                             | Scope                                                                                                                    |
| ------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Unit          | `node:test` + `tsx`              | Pure logic: audio parsing, rate windows, hashing, validation, formatting, risk scoring, scenarios, call lifecycle, prefs |
| Static        | `tsc --noEmit`, ESLint, Prettier | Types, framework rules, formatting                                                                                       |
| Browser       | Playwright                       | Public pages, headers, signed-out redirects, authenticated shell, mobile drawer, PWA manifest                            |
| Accessibility | axe-core                         | WCAG A/AA across nine routes                                                                                             |
| Integration   | Scripted suites                  | Mongo-backed account flow, per-user routes, security closure, live provider round trip                                   |

Unit tests are intentionally pure and run without credentials. Browser suites use
a locally signed test session and never a production secret.

## Conventions

- TypeScript strict mode; no `any`, no non-null assertions in application code.
- Server-only code stays in `src/lib/server`; client components start with
  `"use client"`.
- Data fetching uses `cache: "no-store"` for per-user state.
- Every new API route needs auth, rate limiting, validation, and a no-store
  response.
- New UI states need keyboard access, visible focus, and AA contrast.
- Formatting is enforced with Prettier; lint is enforced in CI.

## Extending

- **New scenario:** add an entry to `src/lib/scenarios.ts` and keep the `id`
  unique; the live engine and history pick it up automatically.
- **New indicator:** add it to `INDICATOR_CATALOG` and the `IndicatorKey` union;
  risk scoring follows severity.
- **New API route:** copy the structure of `api/user/blocklist/route.ts` —
  `requireUser`, rate limit, `readJson`/validation, `jsonNoStore`.
- **New provider:** wrap it in `src/lib/server`, never call it from a client
  component, and add a readiness flag to the integrations status route.
