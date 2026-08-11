import type { WeatherInfo } from "./types";

// Minimal mapping of Open-Meteo's WMO weather codes to short descriptions.
const WMO_CODES: Record<number, string> = {
  0: "Clear sky",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Heavy drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Snow",
  75: "Heavy snow",
  80: "Rain showers",
  81: "Rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with hail",
};

/** Current weather for a lat/lon via Open-Meteo's free, keyless API. */
export async function getCurrentWeather(lat: number, lon: number): Promise<WeatherInfo | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const current = data.current;
    if (!current) return null;
    return {
      tempC: current.temperature_2m,
      condition: WMO_CODES[current.weather_code] ?? "Unknown conditions",
    };
  } catch {
    return null;
  }
}
