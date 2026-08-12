import type { WeatherInfo, WeatherIconKey } from "./types";

/**
 * Current weather for a lat/lon via OpenWeatherMap's classic Current
 * Weather endpoint. Requires OPENWEATHERMAP_API_KEY in .env
 * (openweathermap.org — free tier, no card required: 1,000,000 calls/month,
 * 60/min, tied to your own account rather than pooled by IP).
 *
 * This replaces an earlier Open-Meteo-based lookup. Open-Meteo's free tier
 * is rate-limited by IP address rather than by account, which caused
 * "Daily API request limit exceeded" errors on Render's free tier even at
 * low traffic — Render's free instances share outbound IPs across many
 * unrelated customers, so the shared daily cap could be exhausted by
 * other apps entirely. A per-account key avoids that failure mode.
 *
 * Deliberately using the older "Current Weather" endpoint, not
 * OpenWeatherMap's newer "One Call 3.0/4.0" product — One Call is a
 * separate, more restricted subscription tier (1,000 calls/day); the
 * classic endpoint is the more generous free path and is all this app
 * needs (just current temp + condition, no forecast).
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  const apiKey = process.env.OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    console.error("[weather] OPENWEATHERMAP_API_KEY is not set — skipping weather lookup.");
    return null;
  }

  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[weather] OpenWeatherMap request failed (${res.status}) for ${lat},${lon}:`, await res.text());
      return null;
    }

    const data = await res.json();
    const tempC = data?.main?.temp;
    const conditionEntry = data?.weather?.[0];
    if (typeof tempC !== "number" || !conditionEntry) {
      console.error(`[weather] OpenWeatherMap response missing expected fields for ${lat},${lon}. Raw:`, JSON.stringify(data));
      return null;
    }

    const description: string = conditionEntry.description ?? "unknown conditions";
    const condition = description.charAt(0).toUpperCase() + description.slice(1);

    return { tempC, condition, icon: iconForCode(conditionEntry.id) };
  } catch (err) {
    console.error(`[weather] Lookup threw for ${lat},${lon}:`, err);
    return null;
  }
}

// OpenWeatherMap's condition codes are standardized numeric ranges
// (https://openweathermap.org/weather-conditions) — stable across
// languages/locales, unlike parsing the description text itself.
function iconForCode(id: number): WeatherIconKey {
  if (id >= 200 && id < 300) return "thunderstorm";
  if (id >= 300 && id < 400) return "drizzle";
  if (id >= 500 && id < 600) return "rain";
  if (id >= 600 && id < 700) return "snow";
  if (id >= 700 && id < 800) return "fog"; // mist, haze, smoke, dust, sand, ash, squall, tornado
  if (id === 800) return "clear";
  if (id === 801) return "partly-cloudy";
  if (id >= 802 && id <= 804) return "cloudy";
  return "cloudy";
}
