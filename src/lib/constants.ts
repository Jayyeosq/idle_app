// Shared between onboarding (saved to the profile) and the dashboard's
// per-request filters (session-only), so both stay in sync.
export const INTEREST_OPTIONS = [
  "food",
  "nature",
  "art & culture",
  "nightlife",
  "shopping",
  "fitness",
  "live music",
  "quiet / rest",
  "family-friendly",
  "hidden gems",
] as const;

export const BUDGET_OPTIONS = ["$", "$$", "$$$"] as const;
export const PACE_OPTIONS = ["chill", "balanced", "packed"] as const;
export const COUNT_OPTIONS = [3, 5, 8] as const;

// Applied whenever the user hasn't explicitly set a distance filter — a
// spontaneous "what to do right now" app should default to genuinely
// nearby suggestions, not leave the model free to reach for famous
// landmarks regardless of actual distance. Used consistently by both the
// LLM prompt (lib/llm.ts) and the real hard-filter enforcement
// (lib/places.ts), and matches the FilterPanel slider's resting position
// so what the UI implies and what's actually enforced stay in sync.
export const DEFAULT_MAX_DISTANCE_KM = 5;

// Used when the distance filter is toggled off — search isn't literally
// unbounded (Nearby Search always needs some radius), so this stands in
// as "cover the whole country" via a large radius, with the real boundary
// actually enforced by the country-code cross-border filter in
// app/api/recommend/route.ts, not by this number itself. Honest
// limitation: 150km comfortably covers a small nation like Singapore, but
// would NOT reach a whole large country (US, Australia, etc.) — this is
// tuned for the app's current scale, not a general solution.
export const COUNTRY_WIDE_RADIUS_KM = 150;
