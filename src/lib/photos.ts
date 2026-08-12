import type { Recommendation } from "./types";

/**
 * Best-effort photo + Google Maps link lookup for a recommendation card,
 * using the Google Places API (New): Text Search to resolve a place id,
 * then Place Details to fetch its photo, Maps URL, open/closed status, and
 * real coordinates in one call. Requires GOOGLE_PLACES_API_KEY in .env
 * (console.cloud.google.com — enable "Places API (New)" and set up
 * billing; Google gives a recurring monthly credit that comfortably
 * covers moderate traffic).
 *
 * Also replaces the LLM's guessed distanceHint with a computed one
 * whenever we have a confirmed place match, and enforces the user's
 * maxDistanceKm filter as a real hard cutoff rather than just a prompt
 * suggestion. The prompt asks the model for a distance string like
 * "~1.2 km, 10 min walk" and to respect a distance filter if one was set,
 * but the model has no actual geodata — it's an estimate from general
 * knowledge, which can be meaningfully wrong (or simply not followed
 * closely). Once we have the venue's real coordinates (this file) and the
 * user's real coordinates (already available from Geolocation), both the
 * displayed distance and the filter enforcement become a straightforward
 * calculation instead of a guess.
 *
 * Two calls instead of one: Text Search (New) has a documented tendency to
 * omit fields like photos even when they're in the field mask and the
 * place genuinely has them (Google issue tracker #387619598). Place
 * Details (New), keyed off the id Text Search gives us, is the more
 * reliable path — and since we're already there for the photo, the Maps
 * link, business status, and coordinates come along in the same request
 * at no extra API cost.
 *
 * If nothing turns up (obscure venue, no photos on the listing, API
 * hiccup, missing key) the card just renders without a photo or link, and
 * distanceHint falls back to whatever the LLM guessed — and, importantly,
 * is NOT treated as closed. Business status filtering only fires on a
 * confirmed CLOSED_* status from a successful lookup; failing to find a
 * match at all is common for small/hidden-gem venues that never had a
 * Places listing to begin with, and dropping those would undermine
 * exactly the kind of recommendation this app is meant to make.
 */
async function findPlaceId(
  apiKey: string,
  query: string,
  location?: { lat: number; lon: number }
): Promise<string | null> {
  const searchBody: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
  // Biasing toward the recommendation's actual coordinates avoids picking
  // up a same-named venue in the wrong city — a 10km soft bias, not a
  // hard filter, since a great match just outside the radius shouldn't
  // be discarded.
  if (location) {
    searchBody.locationBias = {
      circle: { center: { latitude: location.lat, longitude: location.lon }, radius: 10000 },
    };
  }

  try {
    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id",
      },
      body: JSON.stringify(searchBody),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = await res.json();
    return data?.places?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

type PlaceExtras = {
  photoUrl: string | null;
  mapsUrl: string | null;
  // null means "unknown" (no match, or the lookup failed) — deliberately
  // distinct from a confirmed open/closed status so callers know not to
  // treat "unknown" as "closed."
  businessStatus: "OPERATIONAL" | "CLOSED_TEMPORARILY" | "CLOSED_PERMANENTLY" | null;
  coords: { lat: number; lon: number } | null;
};

async function fetchPlaceExtras(apiKey: string, placeId: string): Promise<PlaceExtras> {
  const empty: PlaceExtras = { photoUrl: null, mapsUrl: null, businessStatus: null, coords: null };
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos,googleMapsUri,businessStatus,location",
      },
      cache: "no-store",
    });
    if (!res.ok) return empty;

    const data = await res.json();
    const photoName = data?.photos?.[0]?.name;
    // The media endpoint 302-redirects to the actual image, so its URL is
    // directly usable as an <img src> — no need to follow the redirect
    // ourselves or handle it as a separate fetch.
    const photoUrl = photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&key=${apiKey}`
      : null;
    const mapsUrl = data?.googleMapsUri ?? null;
    const businessStatus = data?.businessStatus ?? null;
    const coords =
      typeof data?.location?.latitude === "number" && typeof data?.location?.longitude === "number"
        ? { lat: data.location.latitude, lon: data.location.longitude }
        : null;

    return { photoUrl, mapsUrl, businessStatus, coords };
  } catch {
    return empty;
  }
}

async function lookupPlaceExtras(
  query: string,
  location?: { lat: number; lon: number }
): Promise<PlaceExtras> {
  const empty: PlaceExtras = { photoUrl: null, mapsUrl: null, businessStatus: null, coords: null };
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return empty;

  const placeId = await findPlaceId(apiKey, query, location);
  if (!placeId) return empty;

  return fetchPlaceExtras(apiKey, placeId);
}

/** Straight-line (great-circle) distance in km between two coordinates. */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Formats a real distance into the same style the LLM was asked to guess
 * ("~1.2 km, 10 min walk"). This is straight-line distance, not a routed
 * walking/driving path, so it's a floor rather than an exact figure — real
 * ground distance around streets and buildings is typically somewhat more.
 * Travel time is a rough constant-speed estimate (5 km/h walking, 30 km/h
 * urban driving), not a real routing calculation.
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
 * Attaches a best-effort photoUrl, mapsUrl, and a real computed
 * distanceHint to each recommendation, in parallel, and drops any
 * recommendation whose matched place is confirmed temporarily or
 * permanently closed. The returned array may be shorter than the input if
 * any were filtered out.
 */
export async function attachPhotos(
  recs: Recommendation[],
  location?: { lat: number; lon: number },
  maxDistanceKm?: number
): Promise<Recommendation[]> {
  const withExtras = await Promise.all(
    recs.map(async (rec) => {
      const extras = await lookupPlaceExtras(rec.name, location);
      const distanceKm =
        extras.coords && location
          ? haversineKm(location.lat, location.lon, extras.coords.lat, extras.coords.lon)
          : null;
      const distanceHint =
        distanceKm !== null ? formatDistanceHint(distanceKm) : rec.distanceHint; // no confirmed match — keep the LLM's guess rather than show nothing
      return {
        rec: { ...rec, photoUrl: extras.photoUrl, mapsUrl: extras.mapsUrl, distanceHint },
        businessStatus: extras.businessStatus,
        distanceKm,
      };
    })
  );

  const filtered = withExtras.filter(({ businessStatus, distanceKm, rec }) => {
    const isClosed = businessStatus === "CLOSED_PERMANENTLY" || businessStatus === "CLOSED_TEMPORARILY";
    if (isClosed) {
      console.info(`[photos] Dropping "${rec.name}" — Places reports ${businessStatus}.`);
      return false;
    }

    // Only enforce the filter against a confirmed real distance — a
    // recommendation with no Places match at all has no verified distance
    // to check, and dropping it on that basis would penalize exactly the
    // small/hidden-gem venues this app is meant to surface.
    if (maxDistanceKm && distanceKm !== null && distanceKm > maxDistanceKm) {
      console.info(
        `[photos] Dropping "${rec.name}" — ${distanceKm.toFixed(1)}km exceeds the ${maxDistanceKm}km filter.`
      );
      return false;
    }

    return true;
  });

  return filtered.map(({ rec }) => rec);
}
