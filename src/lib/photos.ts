import type { Recommendation } from "./types";

/**
 * Best-effort photo lookup for a recommendation card, using Wikipedia's
 * public search API — no API key, same "free and keyless" spirit as the
 * geocoding and weather lookups elsewhere in this app. If nothing turns up
 * (obscure venue, API hiccup) the card just renders without a photo.
 */
async function lookupPhoto(query: string): Promise<string | null> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrlimit=1" +
      `&gsrsearch=${encodeURIComponent(query)}` +
      "&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*";
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages;
    if (!pages) return null;
    const page = Object.values(pages)[0] as { thumbnail?: { source?: string } } | undefined;
    return page?.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

/** Attaches a best-effort photoUrl to each recommendation, in parallel. */
export async function attachPhotos(recs: Recommendation[]): Promise<Recommendation[]> {
  return Promise.all(
    recs.map(async (rec) => ({
      ...rec,
      photoUrl: await lookupPhoto(`${rec.name} ${rec.category}`),
    }))
  );
}
