/**
 * Turns lat/lon from the browser's Geolocation API into a human-readable
 * label using OpenStreetMap's free Nominatim service. No API key needed,
 * but Nominatim's usage policy asks for an identifying contact in the
 * User-Agent — set NOMINATIM_CONTACT_EMAIL in .env before deploying at any
 * real volume. For production traffic, consider a paid geocoder instead.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const contact = process.env.NOMINATIM_CONTACT_EMAIL || "no-contact-set@example.com";
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": `idle-app (${contact})` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Nominatim returned ${res.status}`);
    const data = await res.json();
    const addr = data.address ?? {};
    const place =
      addr.neighbourhood || addr.suburb || addr.town || addr.village || addr.city_district;
    const city = addr.city || addr.town || addr.county;
    const country = addr.country;
    return [place, city, country].filter(Boolean).join(", ") || data.display_name || "your location";
  } catch {
    return "your location";
  }
}
