/**
 * Builds a pool of real, nearby, currently-open venues via the Google
 * Places API (New) Nearby Search endpoint, BEFORE the LLM ever runs.
 *
 * This replaces the old generate-then-verify pipeline (formerly
 * lib/photos.ts): previously the LLM invented a plausible venue name from
 * general knowledge, and only afterward did we check whether it was real,
 * how far away it actually was, and whether it was still open — which
 * meant a wrong guess was only caught after the fact, sometimes requiring
 * a retry. Nearby Search's `locationRestriction` genuinely bounds results
 * to a real radius server-side, so distance is now guaranteed correct by
 * construction — there's nothing left to verify or retry, because the LLM
 * never gets the chance to suggest something too far in the first place.
 * It only ever selects from and personalizes real candidates.
 *
 * Requires GOOGLE_PLACES_API_KEY in .env (console.cloud.google.com —
 * enable "Places API (New)" and set up billing; Google's recurring
 * monthly credit comfortably covers moderate traffic). One Nearby Search
 * call typically covers an entire request's candidate pool, which is
 * usually cheaper than the old per-recommendation Text Search + Place
 * Details pair, especially on requests where the old pipeline had to
 * retry.
 *
 * Trade-off worth knowing: candidates can only be real, indexed Google
 * Places — venue-less "activities" (e.g. "take a walk along the canal")
 * that the old free-text generation could invent are no longer possible
 * to suggest. Given this app's core promise is trustworthy, genuinely
 * nearby suggestions, that's an intentional trade in favor of accuracy.
 *
 * For a wide distance filter, a second POPULARITY-ranked call is blended
 * in alongside the usual DISTANCE-ranked one — see searchNearbyPlaces for
 * why a single DISTANCE call effectively never uses a large radius.
 */

export type PlaceCandidate = {
  id: string;
  name: string;
  category: string;
  photoUrl: string | null;
  mapsUrl: string | null;
  distanceHint: string;
  distanceKm: number;
  rating: number | null;
  priceLevel: "$" | "$$" | "$$$" | null;
};

// A broad spread across the app's usual interest categories (food, nature,
// art, nightlife, shopping, fitness, family-friendly, quiet/rest) so one
// call returns a genuinely varied pool rather than skewing toward one
// category. Nearby Search (New) accepts up to 50 types in a single
// request and returns places matching ANY of them — no need for one call
// per type. See Table A: https://developers.google.com/maps/documentation/places/web-service/place-types
const CANDIDATE_TYPES = [
  "restaurant",
  "cafe",
  "bakery",
  "bar",
  "night_club",
  "park",
  "tourist_attraction",
  "museum",
  "art_gallery",
  "shopping_mall",
  "book_store",
  "gym",
  "spa",
  "amusement_park",
  "zoo",
  "aquarium",
  "movie_theater",
  "library",
];

// Maps Google's place types down to this app's short category vocabulary
// (matching the style of lib/constants.ts's INTEREST_OPTIONS) — derived
// from real data instead of asking the LLM to invent a label.
const TYPE_TO_CATEGORY: Record<string, string> = {
  restaurant: "food",
  cafe: "food",
  bakery: "food",
  bar: "nightlife",
  night_club: "nightlife",
  park: "nature",
  tourist_attraction: "sightseeing",
  museum: "art & culture",
  art_gallery: "art & culture",
  shopping_mall: "shopping",
  book_store: "shopping",
  gym: "fitness",
  spa: "quiet / rest",
  amusement_park: "family-friendly",
  zoo: "family-friendly",
  aquarium: "family-friendly",
  movie_theater: "nightlife",
  library: "quiet / rest",
};

function categoryFor(primaryType?: string, types?: string[]): string {
  if (primaryType && TYPE_TO_CATEGORY[primaryType]) return TYPE_TO_CATEGORY[primaryType];
  const fallback = types?.find((t) => TYPE_TO_CATEGORY[t]);
  return fallback ? TYPE_TO_CATEGORY[fallback] : "activity";
}

function priceLevelToSymbol(level?: string): "$" | "$$" | "$$$" | null {
  switch (level) {
    case "PRICE_LEVEL_FREE":
    case "PRICE_LEVEL_INEXPENSIVE":
      return "$";
    case "PRICE_LEVEL_MODERATE":
      return "$$";
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "$$$";
    default:
      return null;
  }
}

/** Straight-line (great-circle) distance in km between two coordinates. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Formats a real distance for display ("~1.2 km, 10 min walk"). This is
 * straight-line distance, not a routed walking/driving path, so it's a
 * floor rather than an exact figure — real ground distance around streets
 * and buildings is typically somewhat more. Travel time is a rough
 * constant-speed estimate (5 km/h walking, 30 km/h urban driving), not a
 * real routing calculation.
 */
function formatDistanceHint(km: number): string {
  const distanceLabel = km < 1 ? `~${Math.round(km * 1000)} m` : `~${km.toFixed(1)} km`;
  if (km <= 1.5) {
    const minutes = Math.max(1, Math.round((km / 5) * 60));
    return `${distanceLabel}, ~${minutes} min walk`;
  }
  const minutes = Math.max(1, Math.round((km / 30) * 60));
  return `${distanceLabel}, ~${minutes} min drive`;
}

/**
 * Fetches up to 20 real, open venues within radiusKm of the given
 * coordinates for a single ranking strategy. Returns an empty array on
 * any failure — callers degrade gracefully rather than crash.
 */
async function fetchNearbyBatch(
  apiKey: string,
  lat: number,
  lon: number,
  radiusKm: number,
  rankPreference: "DISTANCE" | "POPULARITY"
): Promise<any[]> {
  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.primaryType,places.types,places.photos,places.googleMapsUri,places.businessStatus,places.location,places.rating,places.priceLevel",
      },
      body: JSON.stringify({
        includedTypes: CANDIDATE_TYPES,
        maxResultCount: 20,
        rankPreference,
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lon }, radius: radiusKm * 1000 },
        },
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(
        `[places] searchNearby failed (${res.status}, rank=${rankPreference}, radius=${radiusKm}km) for ${lat},${lon}:`,
        await res.text()
      );
      return [];
    }

    const data = await res.json();
    return data?.places ?? [];
  } catch (err) {
    console.error(`[places] searchNearby threw (rank=${rankPreference}, radius=${radiusKm}km) for ${lat},${lon}:`, err);
    return [];
  }
}

function toCandidate(apiKey: string, lat: number, lon: number, p: any): PlaceCandidate | null {
  const status = p.businessStatus;
  if (status === "CLOSED_PERMANENTLY" || status === "CLOSED_TEMPORARILY") return null;

  const placeLat = p.location?.latitude;
  const placeLon = p.location?.longitude;
  if (typeof placeLat !== "number" || typeof placeLon !== "number") return null;

  const distanceKm = haversineKm(lat, lon, placeLat, placeLon);
  const photoName = p.photos?.[0]?.name;

  return {
    id: p.id,
    name: p.displayName?.text ?? "Unnamed place",
    category: categoryFor(p.primaryType, p.types),
    photoUrl: photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&key=${apiKey}`
      : null,
    mapsUrl: p.googleMapsUri ?? null,
    distanceHint: formatDistanceHint(distanceKm),
    distanceKm,
    rating: typeof p.rating === "number" ? p.rating : null,
    priceLevel: priceLevelToSymbol(p.priceLevel),
  };
}

// Above this, a single DISTANCE-ranked call effectively never uses the
// wider radius — see searchNearbyPlaces below for why.
const WIDE_RADIUS_THRESHOLD_KM = 10;

/**
 * Fetches real, open, nearby venues within radiusKm of the given
 * coordinates. Returns an empty array if the key is missing or nothing is
 * found — callers should treat that as "couldn't build a candidate pool"
 * and degrade gracefully rather than crash.
 *
 * For a small radius, this is one DISTANCE-ranked call — genuinely the
 * nearest real places, which is exactly right for the common "something
 * spontaneous nearby" case.
 *
 * For a wide radius, DISTANCE ranking alone is misleading: it always
 * returns the nearest matches first, and in any reasonably dense area
 * there are usually 20+ real places within just a couple of km — so the
 * outer edge of a 50km radius is essentially never reached, no matter how
 * wide the filter is set. Google's Places API has no "ring" (inner+outer
 * radius) search to force genuine spread, so instead a second call across
 * the FULL requested radius is added, ranked by POPULARITY instead of
 * distance — fame doesn't correlate with proximity the way distance
 * ranking does, so it has a real (if not literally guaranteed) chance of
 * surfacing farther, notable places the pure-nearest call would never
 * include. Results from both calls are merged and deduped by place id.
 */
export async function searchNearbyPlaces(
  lat: number,
  lon: number,
  radiusKm: number
): Promise<PlaceCandidate[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[places] GOOGLE_PLACES_API_KEY is not set — no candidates available.");
    return [];
  }

  const batches = await Promise.all(
    radiusKm > WIDE_RADIUS_THRESHOLD_KM
      ? [
          fetchNearbyBatch(apiKey, lat, lon, radiusKm, "DISTANCE"),
          fetchNearbyBatch(apiKey, lat, lon, radiusKm, "POPULARITY"),
        ]
      : [fetchNearbyBatch(apiKey, lat, lon, radiusKm, "DISTANCE")]
  );

  const seenIds = new Set<string>();
  const candidates: PlaceCandidate[] = [];
  const perBatchNewCount: number[] = [];

  for (const places of batches) {
    let newInThisBatch = 0;
    for (const p of places) {
      if (!p.id || seenIds.has(p.id)) continue; // dedupe across the two calls
      const candidate = toCandidate(apiKey, lat, lon, p);
      if (!candidate) continue;
      seenIds.add(p.id);
      candidates.push(candidate);
      newInThisBatch++;
    }
    perBatchNewCount.push(newInThisBatch);
  }

  // Sorted nearest-first for a sensible reading order in the LLM's
  // candidate list — NOT truncated afterward, since slicing back down by
  // distance would throw away exactly the farther popularity-sourced
  // results this whole blend exists to add.
  candidates.sort((a, b) => a.distanceKm - b.distanceKm);

  const distanceRange = candidates.length
    ? `${candidates[0].distanceKm.toFixed(1)}–${candidates[candidates.length - 1].distanceKm.toFixed(1)}km`
    : "n/a";
  const batchSummary =
    radiusKm > WIDE_RADIUS_THRESHOLD_KM
      ? `DISTANCE batch contributed ${perBatchNewCount[0] ?? 0} new, POPULARITY batch contributed ${perBatchNewCount[1] ?? 0} new`
      : `single DISTANCE batch (radius ${radiusKm}km ≤ ${WIDE_RADIUS_THRESHOLD_KM}km threshold)`;
  console.info(
    `[places] ${candidates.length} total candidates, range ${distanceRange}, requested radius ${radiusKm}km — ${batchSummary}`
  );

  return candidates;
}
