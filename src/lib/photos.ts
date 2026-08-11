import type { Recommendation } from "./types";

/**
 * Best-effort photo + Google Maps link lookup for a recommendation card,
 * using the Google Places API (New): Text Search to resolve a place id,
 * then Place Details to fetch its photo and Maps URL in one call. Requires
 * GOOGLE_PLACES_API_KEY in .env (console.cloud.google.com — enable "Places
 * API (New)" and set up billing; Google gives a recurring monthly credit
 * that comfortably covers moderate traffic).
 *
 * Two calls instead of one: Text Search (New) has a documented tendency to
 * omit fields like photos even when they're in the field mask and the
 * place genuinely has them (Google issue tracker #387619598). Place
 * Details (New), keyed off the id Text Search gives us, is the more
 * reliable path — and since we're already there for the photo, the Maps
 * link comes along in the same request at no extra API cost.
 *
 * If nothing turns up (obscure venue, no photos on the listing, API
 * hiccup, missing key) the card just renders without a photo or link.
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

async function fetchPlaceExtras(
  apiKey: string,
  placeId: string
): Promise<{ photoUrl: string | null; mapsUrl: string | null }> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "photos,googleMapsUri",
      },
      cache: "no-store",
    });
    if (!res.ok) return { photoUrl: null, mapsUrl: null };

    const data = await res.json();
    const photoName = data?.photos?.[0]?.name;
    // The media endpoint 302-redirects to the actual image, so its URL is
    // directly usable as an <img src> — no need to follow the redirect
    // ourselves or handle it as a separate fetch.
    const photoUrl = photoName
      ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&key=${apiKey}`
      : null;
    const mapsUrl = data?.googleMapsUri ?? null;

    return { photoUrl, mapsUrl };
  } catch {
    return { photoUrl: null, mapsUrl: null };
  }
}

async function lookupPlaceExtras(
  query: string,
  location?: { lat: number; lon: number }
): Promise<{ photoUrl: string | null; mapsUrl: string | null }> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { photoUrl: null, mapsUrl: null };

  const placeId = await findPlaceId(apiKey, query, location);
  if (!placeId) return { photoUrl: null, mapsUrl: null };

  return fetchPlaceExtras(apiKey, placeId);
}

/** Attaches a best-effort photoUrl and mapsUrl to each recommendation, in parallel. */
export async function attachPhotos(
  recs: Recommendation[],
  location?: { lat: number; lon: number }
): Promise<Recommendation[]> {
  return Promise.all(
    recs.map(async (rec) => {
      const { photoUrl, mapsUrl } = await lookupPlaceExtras(rec.name, location);
      return { ...rec, photoUrl, mapsUrl };
    })
  );
}
