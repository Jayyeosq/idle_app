# IDLE

Tells you what to go do right now, based on your taste profile, your
current location, and the weather. Built with Next.js (App Router) and
the DeepSeek API.

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
  location, reverse-geocodes it (OpenStreetMap Nominatim), fetches current
  weather (OpenWeatherMap), and builds a pool of real, currently-open
  nearby venues via the Google Places API's Nearby Search
  (`src/lib/places.ts`) — bounded by a real radius, so distance is
  guaranteed correct by construction rather than something checked
  afterward. That candidate pool, plus your whole profile markdown file
  and current context, goes to DeepSeek (`src/lib/llm.ts`), whose job is
  narrower than plain generation: select and personalize the best matches
  from the real list, not invent venue names from scratch. The session
  gets appended back into your profile file, so the next request has more
  to go on. If the browser can't or won't hand over Geolocation (permission
  denied, or unsupported — common on mobile), a manual "enter a place"
  fallback forward-geocodes free text instead
  (`src/app/api/geocode/route.ts`).

  This replaced an earlier "generate a plausible name, then verify it
  afterward" pipeline. The LLM has no real geodata — asking it to invent a
  venue and guess its distance meant real, sometimes serious misses (e.g.
  suggesting something 18km away as "nearby"), caught only after the fact
  by a second lookup. Searching for real candidates first removes the
  guess entirely: the model can only select from and describe places
  already confirmed real, open, and within range. Trade-off worth knowing:
  candidates must be real, indexed Google Places — venue-less "activities"
  (e.g. "take a walk along the canal") that free-text generation could
  invent aren't possible to suggest anymore, an intentional trade favoring
  accuracy over creative reach.
- **Filters** — a collapsible panel on the dashboard lets you nudge a
  single request (interests, budget, pace, how many results, max distance)
  without touching your saved profile. These are session-only
  (`src/components/FilterPanel.tsx`). Max distance defaults to
  `DEFAULT_MAX_DISTANCE_KM` (`src/lib/constants.ts`) when untouched — a
  spontaneous "what to do right now" app should default to genuinely
  nearby suggestions, not leave results unbounded.
- **Photos & Maps links** — each candidate's photo and Google Maps link
  come directly from the same Nearby Search call that builds the candidate
  pool (`src/lib/places.ts`) — no separate per-recommendation lookup step.
  Requires `GOOGLE_PLACES_API_KEY` in `.env` (enable "Places API (New)" in
  Google Cloud Console; billing must be enabled, though Google's recurring
  monthly credit comfortably covers moderate traffic). Cards fall back to
  a plain category tile if a candidate has no photo on its Places listing.
- **Feedback loop** — liking/passing on a suggestion appends a line to your
  profile file. There's no separate database table for this — the markdown
  file *is* the record, and it's also exactly what the model reads next
  time, so your taste signal compounds over time without any extra
  plumbing.

## Stack

Next.js 15 (App Router, TypeScript), Tailwind CSS, `jose` (JWT), `bcryptjs`,
`zod`, `nanoid`. DeepSeek and Google Places are called directly via `fetch`,
no SDK. No external database — see the storage note below.

## Getting started

```bash
npm install
cp .env.example .env
# then edit .env: set DEEPSEEK_API_KEY, AUTH_SECRET, GOOGLE_PLACES_API_KEY, and OPENWEATHERMAP_API_KEY
npm run dev
```

Open `http://localhost:3000`. First visit redirects to `/signup`.

`AUTH_SECRET` should be a long random string — `openssl rand -base64 32`
works well. `DEEPSEEK_API_KEY` comes from
[platform.deepseek.com](https://platform.deepseek.com).

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
      recommend/route.ts      — builds the candidate pool + calls the LLM
      feedback/route.ts       — appends 👍/👎 to the profile .md
  components/                 — client components (forms, cards, the Dial)
  lib/
    storage.ts                — filesystem abstraction (swap this to change backends)
    users.ts                  — credentials store
    auth.ts, session.ts       — JWT session handling
    profile.ts                — reads/writes each user's markdown profile
    geocode.ts, weather.ts    — location/weather lookups (weather needs an API key, geocode is free/keyless)
    places.ts                 — builds the real nearby-venue candidate pool (Google Places Nearby Search)
    llm.ts                    — selects + personalizes from the candidate pool via DeepSeek, validates the response
  middleware.ts                — protects /dashboard, /onboarding, and /profile
```

## Notes and known limitations

- The LLM model ID is set in `.env` (`DEEPSEEK_MODEL`, defaults to
  `deepseek-chat`) — check
  [platform.deepseek.com/api-docs](https://platform.deepseek.com/api-docs)
  for the current model lineup before deploying, since names change.
- Nominatim (reverse geocoding) is free but rate-limited and asks for a
  contact email in the User-Agent — set `NOMINATIM_CONTACT_EMAIL` in
  `.env`. For real production traffic, consider a paid geocoder.
- Weather uses OpenWeatherMap's classic Current Weather endpoint —
  `OPENWEATHERMAP_API_KEY` in `.env` (free tier: 1,000,000 calls/month, no
  card required). Originally used Open-Meteo, which is keyless but
  rate-limits by IP rather than by account — on shared hosts like Render's
  free tier, that IP is shared across many unrelated customers, so the
  daily cap could be exhausted by other apps entirely. A per-account key
  avoids that.
- There's no password reset flow, email verification, or rate limiting on
  auth endpoints — add these before taking this anywhere near real users.
- The profile markdown file is appended to indefinitely; for a long-lived
  account you'll eventually want to summarize/trim old history before it's
  sent to the model on every request (both for cost and to keep signal
  dense).
