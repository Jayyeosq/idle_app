export type OnboardingData = {
  interests: string[]; // e.g. ["food", "nature", "art"]
  budget: "$" | "$$" | "$$$";
  pace: "chill" | "balanced" | "packed";
  dietary: string; // free text, e.g. "vegetarian, no shellfish"
  travelRadiusKm: number;
  notes: string; // free text: anything else about their taste
};

export type LocationInfo = {
  lat: number;
  lon: number;
  label: string; // human-readable place, e.g. "Sengkang, Singapore"
};

export type WeatherInfo = {
  tempC: number;
  condition: string; // short description, e.g. "Light rain"
};

export type Recommendation = {
  id: string;
  name: string;
  category: string;
  why: string;
  estimatedTime: string; // e.g. "45 min"
  distanceHint: string; // e.g. "~1.2 km away"
  photoUrl?: string | null;
  mapsUrl?: string | null; // link to the venue's real Google Maps page, if matched
};

export type FeedbackReaction = "up" | "down";

// Session-only tweaks a returning user can apply on top of their saved
// profile preferences without editing the profile itself.
export type RecommendationFilters = {
  interests?: string[];
  budget?: "$" | "$$" | "$$$";
  pace?: "chill" | "balanced" | "packed";
  maxDistanceKm?: number;
};
