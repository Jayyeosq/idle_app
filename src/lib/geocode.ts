import type { LocationInfo } from "./types";

export type GeocodeResult = { label: string; countryCode: string | null };

/**
 * Turns lat/lon from the browser's Geolocation API into a human-readable
 * label AND an ISO 3166-1 alpha-2 country code, using OpenStreetMap's free
 * Nominatim service. No API key needed, but Nominatim's usage policy asks
 * for an identifying contact in the User-Agent — set
 * NOMINATIM_CONTACT_EMAIL in .env before deploying at any real volume.
 * For production traffic, consider a paid geocoder instead.
 *
 * The country code exists specifically to filter out cross-border
 * recommendations at a wide distance filter (see lib/places.ts) — a
 * straight-line distance can be technically "within range" while crossing
 * an international border, which is a meaningfully bigger ask than the
 * same distance within one country.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<GeocodeResult> {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL || "no-contact-set@example.com";
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": `idle-app (${contact})` },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error(`[geocode] Nominatim reverse failed (${res.status}) for ${lat},${lon}:`, await res.text());
      return { label: "your location", countryCode: null };
    }
    const data = await res.json();
    const addr = data.address ?? {};
    if (!addr.country_code) {
      console.error(`[geocode] Nominatim response had no country_code for ${lat},${lon}. Raw address:`, JSON.stringify(addr));
    }
    const place =
      addr.neighbourhood || addr.suburb || addr.town || addr.village || addr.city_district;
    const city = addr.city || addr.town || addr.county;
    const country = addr.country;
    const label = [place, city, country].filter(Boolean).join(", ") || data.display_name || "your location";
    const countryCode = typeof addr.country_code === "string" ? addr.country_code.toUpperCase() : null;
    return { label, countryCode };
  } catch (err) {
    console.error(`[geocode] reverseGeocode threw for ${lat},${lon}:`, err);
    return { label: "your location", countryCode: null };
  }
}

/**
 * The reverse of the above: turns a free-text place name (typed by hand)
 * into coordinates plus a label. This backs the manual-location fallback
 * for browsers/devices that can't or won't hand over Geolocation (common
 * on mobile when location services are off or permission is denied).
 */
export async function forwardGeocode(query: string): Promise<LocationInfo | null> {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL || "no-contact-set@example.com";
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    query
  )}&limit=1&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": `idle-app (${contact})` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const results = await res.json();
    const first = results?.[0];
    if (!first) return null;
    const addr = first.address ?? {};
    const place =
      addr.neighbourhood || addr.suburb || addr.town || addr.village || addr.city_district;
    const city = addr.city || addr.town || addr.county;
    const country = addr.country;
    const label = [place, city, country].filter(Boolean).join(", ") || first.display_name || query;
    return { lat: parseFloat(first.lat), lon: parseFloat(first.lon), label };
  } catch {
    return null;
  }
}
