import type { WeatherInfo, WeatherIconKey } from "./types";

// Minimal mapping of Open-Meteo's WMO weather codes to a short description
// and an icon key. Kept as one table (not two parallel ones) so the label
// and the icon can't drift out of sync with each other.
const WMO_CODES: Record<number, { label: string; icon: WeatherIconKey }> = {
  0: { label: "Clear sky", icon: "clear" },
  1: { label: "Mostly clear", icon: "clear" },
  2: { label: "Partly cloudy", icon: "partly-cloudy" },
  3: { label: "Overcast", icon: "cloudy" },
  45: { label: "Fog", icon: "fog" },
  48: { label: "Fog", icon: "fog" },
  51: { label: "Light drizzle", icon: "drizzle" },
  53: { label: "Drizzle", icon: "drizzle" },
  55: { label: "Heavy drizzle", icon: "drizzle" },
  61: { label: "Light rain", icon: "rain" },
  63: { label: "Rain", icon: "rain" },
  65: { label: "Heavy rain", icon: "rain" },
  71: { label: "Light snow", icon: "snow" },
  73: { label: "Snow", icon: "snow" },
  75: { label: "Heavy snow", icon: "snow" },
  80: { label: "Rain showers", icon: "rain" },
  81: { label: "Rain showers", icon: "rain" },
  82: { label: "Violent rain showers", icon: "rain" },
  95: { label: "Thunderstorm", icon: "thunderstorm" },
  96: { label: "Thunderstorm with hail", icon: "thunderstorm" },
  99: { label: "Thunderstorm with hail", icon: "thunderstorm" },
};

/** Current weather for a lat/lon via Open-Meteo's free, keyless API. */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.error(`[weather] Open-Meteo request failed (${res.status}) for ${lat},${lon}:`, await res.text());
      return null;
    }
    const data = await res.json();
    const current = data.current;
    if (!current) {
      console.error(`[weather] Open-Meteo response had no "current" field for ${lat},${lon}. Raw:`, JSON.stringify(data));
      return null;
    }
    const match = WMO_CODES[current.weather_code] ?? { label: "Unknown conditions", icon: "cloudy" as const };
    return {
      tempC: current.temperature_2m,
      condition: match.label,
      icon: match.icon,
    };
  } catch (err) {
    console.error(`[weather] Lookup threw for ${lat},${lon}:`, err);
    return null;
  }
}
