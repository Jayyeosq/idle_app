import type { Recommendation } from "./types";

/**
 * Best-effort photo + Google Maps link lookup for a recommendation card,
 * using the Google Places API (New): Text Search to resolve a place id,
 * then Place Details to fetch its photo, Maps URL, and open/closed status
 * in one call. Requires GOOGLE_PLACES_API_KEY in .env
 * (console.cloud.google.com — enable "Places API (New)" and set up
 * billing; Google gives a recurring monthly credit that comfortably
 * covers moderate traffic).
 *
 * Two calls instead of one: Text Search (New) has a documented tendency to
 * omit fields like photos even when they're in the field mask and the
 * place genuinely has them (Google issue tracker #387619598). Place
 * Details (New), keyed off the id Text Search gives us, is the more
 * reliable path — and since we're already there for the photo, the Maps
 * link and business status come along in the same request at no extra
 * API cost.
 *
 * If nothing turns up (obscure venue, no photos on the listing, API
 * hiccup, missing key) the card just renders without a photo or link —
 * and, importantly, is NOT treated as closed. Business status filtering
 * only fires on a confirmed CLOSED_* status from a successful lookup;
 * failing to find a match at all is common for small/hidden-gem venues
 * that never had a Places listing to begin with, and dropping those would
 * undermine exactly the kind of recommendation this app is meant to make.
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
};

async function fetchPlaceExtras(apiKey: string, placeId: string): Promise<PlaceExtras> {
  const empty: PlaceExtras = { photoUrl: null, mapsUrl: null, businessStatus: null };
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos,googleMapsUri,businessStatus",
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

    return { photoUrl, mapsUrl, businessStatus };
  } catch {
    return empty;
  }
}

async function lookupPlaceExtras(
  query: string,
  location?: { lat: number; lon: number }
): Promise<PlaceExtras> {
  const empty: PlaceExtras = { photoUrl: null, mapsUrl: null, businessStatus: null };
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return empty;

  const placeId = await findPlaceId(apiKey, query, location);
  if (!placeId) return empty;

  return fetchPlaceExtras(apiKey, placeId);
}

/**
 * Attaches a best-effort photoUrl and mapsUrl to each recommendation, in
 * parallel, and drops any recommendation whose matched place is confirmed
 * temporarily or permanently closed. The returned array may be shorter
 * than the input if any were filtered out.
 */
export async function attachPhotos(
  recs: Recommendation[],
  location?: { lat: number; lon: number }
): Promise<Recommendation[]> {
  const withExtras = await Promise.all(
    recs.map(async (rec) => {
      const { photoUrl, mapsUrl, businessStatus } = await lookupPlaceExtras(rec.name, location);
      return { rec: { ...rec, photoUrl, mapsUrl }, businessStatus };
    })
  );

  const filtered = withExtras.filter(({ businessStatus, rec }) => {
    const isClosed = businessStatus === "CLOSED_PERMANENTLY" || businessStatus === "CLOSED_TEMPORARILY";
    if (isClosed) {
      console.info(`[photos] Dropping "${rec.name}" — Places reports ${businessStatus}.`);
    }
    return !isClosed;
  });

  return filtered.map(({ rec }) => rec);
}
