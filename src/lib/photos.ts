import type { Recommendation } from "./types";

/**
 * Best-effort photo lookup for a recommendation card, using the Google
 * Places API (New) Text Search + Photo Media endpoints. Requires
 * GOOGLE_PLACES_API_KEY in .env (console.cloud.google.com — enable "Places
 * API (New)" and set up billing; Google gives a recurring monthly credit
 * that comfortably covers moderate traffic).
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
    const searchBody: Record<string, unknown> = { textQuery: query, maxResultCount: 1 };
    // Biasing toward the recommendation's actual coordinates avoids picking
    // up a same-named venue in the wrong city — a 10km soft bias, not a
    // hard filter, since a great match just outside the radius shouldn't
    // be discarded.
    if (location) {
      searchBody.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lon },
          radius: 10000,
        },
      };
    }

    const searchRes = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        // Widened beyond just "places.photos" so the diagnostic below can
        // show *which* place matched, not just whether it has a photo.
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.photos",
      },
      body: JSON.stringify(searchBody),
      cache: "no-store",
    });

    // TEMPORARY DIAGNOSTIC — remove once photos are working. This surfaces
    // Google's actual error body (permission/billing/key restriction
    // issues all show up here) instead of failing silently.
    if (!searchRes.ok) {
      const bodyText = await searchRes.text();
      console.error(`[photos] Places searchText failed (${searchRes.status}) for "${query}":`, bodyText);
      return null;
    }

    const searchData = await searchRes.json();
    const match = searchData?.places?.[0];
    const photoName = match?.photos?.[0]?.name;
    if (!photoName) {
      console.error(
        `[photos] No photo for "${query}". Matched place:`,
        match ? `${match.displayName?.text ?? "?"} (${match.formattedAddress ?? "no address"})` : "no match at all",
        "— raw:",
        JSON.stringify(searchData)
      );
      return null;
    }

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
