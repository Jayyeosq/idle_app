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
