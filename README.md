# IDLE

Tells you what to go do right now, based on your taste profile, your
current location, and the weather. Built with Next.js (App Router) and
the Anthropic API.

## How it works

- **Login / signup** — email + password, hashed with bcrypt, session held in
  a signed JWT cookie (`src/lib/auth.ts`, `src/lib/session.ts`).
- **Onboarding** — a short preferences form (interests, budget, pace,
  dietary notes, travel radius, free-text notes).
- **Per-user profile file** — onboarding writes a markdown file per user at
  `data/profiles/<userId>.md`. It's a literal, human-readable file: a
  Preferences section plus a running History section that every
  recommendation session and every 👍/👎 gets appended to.
- **Recommendations** — on the dashboard, IDLE asks the browser for your
  location, reverse-geocodes it (OpenStreetMap Nominatim) and fetches
  current weather (Open-Meteo), then sends your whole profile markdown file
  plus that context to Claude, which returns a structured list of specific
  suggestions. The session gets appended back into your profile file, so
  the next request has more to go on. If the browser can't or won't hand
  over Geolocation (permission denied, or unsupported — common on mobile),
  a manual "enter a place" fallback forward-geocodes free text instead
  (`src/app/api/geocode/route.ts`).
- **Filters** — a collapsible panel on the dashboard lets you nudge a
  single request (interests, budget, pace, max distance) without touching
  your saved profile. These are session-only and passed alongside the
  profile markdown to the LLM (`src/components/FilterPanel.tsx`).
- **Photos** — each recommendation card shows a best-effort photo looked
  up via Wikipedia's free, keyless search API (`src/lib/photos.ts`); cards
  fall back to a plain category tile when nothing turns up.
- **Feedback loop** — liking/passing on a suggestion appends a line to your
  profile file. There's no separate database table for this — the markdown
  file *is* the record, and it's also exactly what the model reads next
  time, so your taste signal compounds over time without any extra
  plumbing.

## Stack

Next.js 15 (App Router, TypeScript), Tailwind CSS, `@anthropic-ai/sdk`,
`jose` (JWT), `bcryptjs`, `zod`. No external database — see the storage
note below.

## Getting started

```bash
npm install
cp .env.example .env
# then edit .env: set ANTHROPIC_API_KEY and AUTH_SECRET
npm run dev
```

Open `http://localhost:3000`. First visit redirects to `/signup`.

`AUTH_SECRET` should be a long random string — `openssl rand -base64 32`
works well. `ANTHROPIC_API_KEY` comes from
[console.anthropic.com](https://console.anthropic.com).

## ⚠️ Storage: read this before deploying

User accounts and profile markdown files are stored as plain files on disk
under `/data` (see `src/lib/storage.ts`). That's deliberate — it keeps the
"each user has a markdown file" idea literal and inspectable — but it means
this app needs a **persistent filesystem and a long-running Node process**.

- **Works as-is:** running locally, a VPS, a Docker container with a
  mounted volume, Fly.io, Railway, Render, or anywhere else with a normal
  persistent disk. `next.config.mjs` is set to `output: "standalone"` to
  make Docker/VPS deployment straightforward.
- **Will silently lose data:** Vercel and most "git push to deploy"
  serverless platforms, because their filesystem is read-only or reset on
  every deploy/cold start.

If you want to deploy to Vercel or scale past one instance, swap the
functions in `src/lib/storage.ts` for calls to a real datastore — nothing
else in the app needs to change, since every read/write goes through that
one module. Reasonable options: Postgres (via Prisma or similar) for
`users.json`'s contents, and Vercel Blob or S3 for the per-user `.md`
files so they stay literal files.

## Project structure

```
src/
  app/
    login/, signup/          — auth pages
    onboarding/               — preferences form
    dashboard/                — location + recommendations UI
    api/
      auth/{login,signup,logout}/route.ts
      onboarding/route.ts     — writes the initial profile .md
      recommend/route.ts      — geocode + weather + LLM call
      feedback/route.ts       — appends 👍/👎 to the profile .md
  components/                 — client components (forms, cards, the Dial)
  lib/
    storage.ts                — filesystem abstraction (swap this to change backends)
    users.ts                  — credentials store
    auth.ts, session.ts       — JWT session handling
    profile.ts                — reads/writes each user's markdown profile
    geocode.ts, weather.ts    — free, keyless location/weather lookups
    llm.ts                    — builds the prompt, calls Claude, validates the response
  middleware.ts                — protects /dashboard and /onboarding
```

## Notes and known limitations

- The LLM model ID is set in `.env` (`ANTHROPIC_MODEL`, defaults to
  `claude-sonnet-5`) — check
  [docs.claude.com](https://docs.claude.com/en/docs/about-claude/models/overview)
  for the current model lineup before deploying, since names change.
- Nominatim (reverse geocoding) is free but rate-limited and asks for a
  contact email in the User-Agent — set `NOMINATIM_CONTACT_EMAIL` in
  `.env`. For real production traffic, consider a paid geocoder.
- There's no password reset flow, email verification, or rate limiting on
  auth endpoints — add these before taking this anywhere near real users.
- The profile markdown file is appended to indefinitely; for a long-lived
  account you'll eventually want to summarize/trim old history before it's
  sent to the model on every request (both for cost and to keep signal
  dense).
