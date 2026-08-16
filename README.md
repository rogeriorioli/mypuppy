# MyPuppy

> **Made in Brazil. Raised by you.**

MyPuppy is a mobile-first virtual pet built around Brazilian mixed-breed dogs ("vira-latas").
It is a digital toy, not a dashboard. Adopt one of three legend-tier companions, then feed,
play, take them on a *Rolê*, and give them *Cafuné* while their personality grows with you.

The three founding dogs:

| Dog | Personality |
| --- | --- |
| **Caramelo** | friendly, clever, adventurous, affectionate |
| **Fiapo de Manga** | dramatic, affectionate, chaotic, slightly lazy |
| **Malhadinho** | playful, curious, energetic, suspicious of delivery drivers |

## Architecture

```
UI (App Router pages + client components)
  ↓ server actions / route handlers
Application layer (src/services/pet-service.ts)
  ↓ load → calculate → validate cooldown → apply → persist → react
Domain layer (src/domain/pet/engine.ts)   ← deterministic, pure, testable
  ↕ serialization (src/domain/pet/serialize.ts)
Infrastructure (src/lib: Prisma, auth, env, push)
```

- The **Virtual Pet Engine** owns all game state. It is pure and deterministic — time is
  passed in as an argument, never read from `Date.now()` internally. It handles decay,
  actions, cooldowns, threshold-crossing events, sleep, absence ("misses owner",
  "owner returned"), and personality progression. The pet never dies.
- **Gemini 2.5 Flash (backend only)** writes reactions and notification copy. It never
  mutates game state and always has a deterministic fallback, timeout, validation and
  cache. The model id is configurable via `GEMINI_MODEL`. If Gemini is unconfigured,
  rate-limited, or the key lacks billing, the product keeps working via the fallback.
- **Web Push (VAPID, no Firebase)** delivers event notifications to the user's active
  subscriptions, with multi-device support and expired-subscription cleanup.

## Stack

- Next.js 16 (App Router, Turbopack) · React 19 · TypeScript
- Tailwind CSS v4
- Prisma 7 (PostgreSQL — Timescale Cloud) with the `@prisma/adapter-pg` driver adapter
- `jose` (session JWTs) · `bcryptjs` (password hashing) · `zod` (validation)
- `web-push` (VAPID) · `@google/genai` (Gemini)
- Vitest (unit tests) · ESLint · TypeScript typecheck

## Setup

### 1. Install

```bash
npm install        # also runs `prisma generate` via postinstall
```

### 2. Environment

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL/Timescale connection string |
| `SESSION_SECRET` | ✅ | 32+ char secret for signing session JWTs (`openssl rand -hex 32`) |
| `GEMINI_API_KEY` | optional | Gemini 2.5 Flash key. Empty = deterministic fallback |
| `VAPID_PUBLIC_KEY` | optional | Web Push public key (from `npm run vapid:generate`) |
| `VAPID_PRIVATE_KEY` | optional | Web Push private key. **Never expose to the client.** |
| `VAPID_SUBJECT` | optional | VAPID contact (`mailto:` or `https:`) |

Generate VAPID keys:

```bash
npm run vapid:generate
```

### 3. Database

The database is **cloud-hosted** (Timescale Cloud). No Docker required.

```bash
npm run db:deploy   # prisma migrate deploy — apply migrations to the DB
npm run db:seed     # seed a demo user (demo@dogday.dev / password123)
```

During development you can use `npm run db:migrate` (`prisma migrate dev`) to create
new migrations when the schema changes.

### 4. Run

```bash
npm run dev         # http://localhost:3000
npm run build       # production build
npm start           # serve production build
```

## Scripts

| Script | Command |
| --- | --- |
| `dev` | start dev server |
| `build` | production build |
| `start` | serve production build |
| `lint` | `eslint .` |
| `typecheck` | `tsc --noEmit` |
| `test` | `vitest run` |
| `postinstall` | `prisma generate` |
| `db:migrate` | `prisma migrate dev` (dev) |
| `db:deploy` | `prisma migrate deploy` (apply) |
| `db:seed` | `tsx prisma/seed.ts` |
| `vapid:generate` | generate VAPID key pair |

## Testing

Engine tests run without a browser, database or Gemini — they use fixed timestamps.

```bash
npm test
```

Coverage includes: clamping, elapsed-time decay, actions, cooldowns, threshold crossing,
event generation (no repeats while above a threshold), personality progression, sleep,
absence handling, Gemini fallback/sanitization, and request/push validation.

## Deployment

`npm run build` produces a standard Next.js build. Set all environment variables in the
hosting platform. Run `npm run db:deploy` against the production `DATABASE_URL` before
releasing. The PWA manifest and service worker are served from `public/`.

## Project guardrails

- The deterministic engine is the only writer of game state. Gemini never controls it.
- The pet never dies and is never emotionally punished for absence.
- Notification permission is only requested on explicit user action, never on page load.
- Server is the source of truth for cooldowns, ownership, and push subscription identity.
