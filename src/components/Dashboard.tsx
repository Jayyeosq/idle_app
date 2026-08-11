"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dial from "@/components/Dial";
import RecommendationCard from "@/components/RecommendationCard";
import FilterPanel from "@/components/FilterPanel";
import type { Recommendation, WeatherInfo, RecommendationFilters } from "@/lib/types";

type Status = "idle" | "locating" | "thinking" | "error";

export default function Dashboard({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [filters, setFilters] = useState<RecommendationFilters>({});

  // Shown when the browser can't or won't hand over Geolocation — common on
  // phones with location services off, or a denied permission prompt.
  const [needsManualLocation, setNeedsManualLocation] = useState(false);
  const [manualQuery, setManualQuery] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  function getPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("This browser doesn't support location access."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 10000,
      });
    });
  }

  async function fetchRecommendations(lat: number, lon: number, label?: string) {
    setStatus("thinking");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon, label, filters }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't get recommendations. Try again.");
        setStatus("error");
        return;
      }
      setLocation(data.location);
      setWeather(data.weather);
      setRecs(data.recommendations);
      setStatus("idle");
      setNeedsManualLocation(false);
    } catch {
      setError("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  async function findSomething() {
    setError(null);
    setNeedsManualLocation(false);
    setStatus("locating");
    let position: GeolocationPosition;
    try {
      position = await getPosition();
    } catch {
      setError(
        "Couldn't get your location. If you're on a phone, location may be off or blocked — enter a place below instead."
      );
      setNeedsManualLocation(true);
      setStatus("error");
      return;
    }
    await fetchRecommendations(position.coords.latitude, position.coords.longitude);
  }

  async function useManualLocation(e: React.FormEvent) {
    e.preventDefault();
    if (!manualQuery.trim()) return;
    setError(null);
    setManualLoading(true);
    try {
      const res = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: manualQuery.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't find that place.");
        setManualLoading(false);
        return;
      }
      await fetchRecommendations(data.lat, data.lon, data.label);
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setManualLoading(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const thinking = status === "locating" || status === "thinking" || manualLoading;

  return (
    <main className="min-h-screen px-6 py-12 max-w-3xl mx-auto flex flex-col items-center">
      <div className="w-full flex justify-between items-center mb-12">
        <span className="font-display text-2xl tracking-tight">IDLE</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-xs text-mist hidden sm:inline">{email}</span>
          <button
            onClick={logout}
            className="text-sm text-mist hover:text-paper underline underline-offset-4"
          >
            Log out
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={findSomething}
        disabled={thinking}
        className="panel-plate rounded-2xl px-14 py-10 flex flex-col items-center gap-4 group transition-transform hover:-translate-y-0.5 disabled:hover:translate-y-0"
      >
        <Dial size={120} spinning={thinking} />
        <span className="font-mono text-sm text-brass group-hover:text-brass-soft transition-colors tracking-wide">
          {status === "locating"
            ? "finding you..."
            : status === "thinking"
              ? "thinking..."
              : recs.length
                ? "find something else"
                : "find something to do"}
        </span>
      </button>

      {(location || weather) && (
        <p className="font-mono text-xs text-mist mt-6 text-center">
          {location}
          {weather ? ` · ${Math.round(weather.tempC)}°C, ${weather.condition}` : ""}
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-rust mt-6 text-center max-w-sm">
          {error}
        </p>
      )}

      {needsManualLocation && (
        <form onSubmit={useManualLocation} className="w-full max-w-sm mt-4 flex gap-2">
          <input
            type="text"
            value={manualQuery}
            onChange={(e) => setManualQuery(e.target.value)}
            placeholder="Enter a city or address..."
            disabled={manualLoading}
            className="flex-1 rounded-md bg-ink-soft border border-white/10 px-3.5 py-2 text-sm text-paper placeholder:text-mist/50 focus:border-brass outline-none transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={manualLoading || !manualQuery.trim()}
            className="btn-brass rounded-md text-ink text-sm font-medium px-4 py-2 disabled:opacity-60"
          >
            {manualLoading ? "..." : "Go"}
          </button>
        </form>
      )}

      <FilterPanel value={filters} onChange={setFilters} disabled={thinking} />

      {recs.length > 0 && (
        <div className="w-full grid sm:grid-cols-2 gap-4 mt-12">
          {recs.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}
        </div>
      )}
    </main>
  );
}
