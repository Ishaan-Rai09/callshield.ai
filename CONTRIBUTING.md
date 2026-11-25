# Contributing

Thanks for taking a look at CallShield. This is a prototype, but the same rules
apply: small changes, verified behaviour, no secrets in the repository.

## Setup

```bash
npm ci
cp .env.example .env.local   # fill in only what you need
npm run dev
```

Google sign-in needs `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
and `MONGODB_URI`. Voice needs `GNANI_API_KEY`. Without them the app still runs:
public pages render, and calls fall back to captions.

## Before opening a pull request

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run build
```

For UI or flow changes, also run the browser suites against a local server:

```bash
npm start                       # separate terminal; AUTH_SECRET required
npm run test:smoke
npm run test:a11y
```

`test:demo`, `test:security`, and `test:routes` need MongoDB; `test:voice` spends
Gnani credits and is manual by design.

## Code conventions

- TypeScript strict mode. Avoid `any`, type assertions that hide a real shape,
  and non-null assertions in application code.
- Keep server-only code in `src/lib/server`. Client components start with
  `"use client"` and must not import server modules.
- Put pure domain logic in `src/lib/services` so it can be unit-tested without
  React or the network.
- Add a unit test when you add a pure helper, a threshold, or a parser.
- Every API route needs authentication, a rate limit, validation, and a
  `Cache-Control: no-store` response. Use the helpers in `src/lib/server`.
- Use existing UI primitives (`Button`, `Toggle`, `RiskBadge`, `EmptyState`) and
  design tokens from `tailwind.config.ts` instead of new hex values.
- Accessibility is part of the definition of done: keyboard reachable, visible
  focus, labelled controls, AA contrast.
- Prettier owns formatting; ESLint owns framework rules. Do not add suppression
  comments without a comment explaining why.

## Commits

Keep commits scoped to one concern and write the message in the imperative mood:

```
fix(auth): reject unverified Google email addresses
docs: document the rate-limit failure mode
```

Do not commit `.env.local`, generated `.next` output, Lighthouse reports, or
provider credentials. If you suspect a secret was committed, rotate it first and
follow [SECURITY.md](SECURITY.md).

## Architecture and security

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, state model, data flow.
- [SECURITY.md](SECURITY.md) — reporting, scope, secret handling.
- [docs/FINAL_AUDIT_REPORT.md](docs/FINAL_AUDIT_REPORT.md) — known limitations.
