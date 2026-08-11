import type { Recommendation } from "./types";

/**
 * Best-effort photo lookup for a recommendation card, using the Google
 * Places API (New): Text Search to resolve a place id, then Place Details
 * to fetch its photos. Requires GOOGLE_PLACES_API_KEY in .env
 * (console.cloud.google.com — enable "Places API (New)" and set up
 * billing; Google gives a recurring monthly credit that comfortably
 * covers moderate traffic).
 *
 * Two calls instead of one: Text Search (New) has a documented tendency to
 * omit the photos field even when it's in the field mask and the place
 * genuinely has photos (Google issue tracker #387619598). Place Details
 * (New), keyed off the id Text Search gives us, is the more reliable path
 * to that field per Google's own docs examples.
 *
 * This replaces an earlier Wikipedia-based lookup: Wikipedia only has
 * thumbnails for venues notable enough to have their own article, which
 * misses most small local businesses — exactly the kind of "hidden gem"
 * this app tries to recommend. Google Places has real, user-submitted
 * photos for almost any real venue.
 *
 * If nothing turns up (obscure venue, no photos on the listing, API
 * hiccup, missing key) the card just renders without a photo, same as
 * before.
 */
async function findPlaceId(
  apiKey: string,
  query: string,
  location?: { lat: number; lon: number }
): Promise<{ id: string; label: string } | null> {
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

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify(searchBody),
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[photos] Places searchText failed (${res.status}) for "${query}":`, await res.text());
    return null;
  }

  const data = await res.json();
  const match = data?.places?.[0];
  if (!match?.id) {
    console.error(`[photos] No place match at all for "${query}". Raw:`, JSON.stringify(data));
    return null;
  }
  return { id: match.id, label: `${match.displayName?.text ?? "?"} (${match.formattedAddress ?? "no address"})` };
}

async function fetchPhotoName(apiKey: string, placeId: string, label: string): Promise<string | null> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "photos",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[photos] Place Details failed (${res.status}) for ${label}:`, await res.text());
    return null;
  }

  const data = await res.json();
  const photoName = data?.photos?.[0]?.name;
  if (!photoName) {
    console.error(`[photos] Matched ${label} but Place Details returned no photos. Raw:`, JSON.stringify(data));
    return null;
  }
  return photoName;
}

async function lookupPlacePhoto(
  query: string,
  location?: { lat: number; lon: number }
): Promise<string | null> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.error("[photos] GOOGLE_PLACES_API_KEY is not set — skipping photo lookup.");
    return null;
  }

  try {
    const place = await findPlaceId(apiKey, query, location);
    if (!place) return null;

    const photoName = await fetchPhotoName(apiKey, place.id, place.label);
    if (!photoName) return null;

    // The media endpoint 302-redirects to the actual image, so its URL is
    // directly usable as an <img src> — no need to follow the redirect
    // ourselves or handle it as a separate fetch.
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=640&key=${apiKey}`;
  } catch (err) {
    console.error(`[photos] Places lookup threw for "${query}":`, err);
    return null;
  }
}

/** Attaches a best-effort photoUrl to each recommendation, in parallel. */
export async function attachPhotos(
  recs: Recommendation[],
  location?: { lat: number; lon: number }
): Promise<Recommendation[]> {
  return Promise.all(
    recs.map(async (rec) => ({
      ...rec,
      photoUrl: await lookupPlacePhoto(rec.name, location),
    }))
  );
}
