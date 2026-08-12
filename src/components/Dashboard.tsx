"use client";

import { useState } from "react";
import Dial from "@/components/Dial";
import RecommendationCard from "@/components/RecommendationCard";
import FilterPanel from "@/components/FilterPanel";
import ProfileMenu from "@/components/ProfileMenu";
import ClockBadge from "@/components/ClockBadge";
import WeatherIcon from "@/components/WeatherIcon";
import type { Recommendation, WeatherInfo, RecommendationFilters, OnboardingData } from "@/lib/types";

type Status = "idle" | "locating" | "thinking" | "error";

export default function Dashboard({
  email,
  preferences,
}: {
  email: string;
  preferences: OnboardingData | null;
}) {
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

  const thinking = status === "locating" || status === "thinking" || manualLoading;
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });

  const ctaLabel =
    status === "locating"
      ? "Finding you…"
      : status === "thinking"
        ? "Thinking…"
        : recs.length
          ? "Find something else"
          : "Find something to do";

  return (
    <main className="max-w-[1320px] mx-auto px-6 sm:px-8 pb-16">
      <header className="h-[86px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Dial size={22} spinning={thinking} />
          <span className="font-medium text-lg tracking-wide">IDLE</span>
        </div>
        <div className="flex items-center gap-3">
          <ClockBadge />
          <ProfileMenu email={email} preferences={preferences} />
        </div>
      </header>

      <section className="grid lg:grid-cols-[1.1fr_0.9fr] gap-5">
        <div className="panel-plate px-8 py-14 sm:px-12 sm:py-16 flex flex-col justify-center">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-3">
            <span className="text-xs uppercase tracking-[0.16em] text-mist">{today}</span>
            {weather && (
              <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span className="text-mist">·</span>
                <WeatherIcon icon={weather.icon} size={14} />
                {Math.round(weather.tempC)}°C · {weather.condition}
                {location ? ` · ${location}` : ""}
              </span>
            )}
          </div>
          <h1 className="font-display text-5xl sm:text-[60px] leading-[0.98] tracking-tight max-w-xl">
            Your day, thoughtfully picked.
          </h1>
          <p className="text-base leading-relaxed max-w-md mt-5 text-ink-soft">
            A few things worth leaving home for, shaped around your time, location and taste.
          </p>
          <button
            type="button"
            onClick={findSomething}
            disabled={thinking}
            className="btn-brass rounded-full px-6 py-3.5 font-medium text-sm mt-8 w-fit disabled:opacity-60"
          >
            {ctaLabel} →
          </button>

          {error && (
            <p role="alert" className="text-sm text-rust mt-5 max-w-sm">
              {error}
            </p>
          )}

          {needsManualLocation && (
            <form onSubmit={useManualLocation} className="max-w-sm mt-4 flex gap-2">
              <input
                type="text"
                value={manualQuery}
                onChange={(e) => setManualQuery(e.target.value)}
                placeholder="Enter a city or address..."
                disabled={manualLoading}
                className="flex-1 rounded-md bg-card border border-ink/10 px-3.5 py-2 text-sm text-ink placeholder:text-mist/60 focus:border-ink outline-none transition-colors disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={manualLoading || !manualQuery.trim()}
                className="btn-brass rounded-md text-sm px-4 py-2 disabled:opacity-60"
              >
                {manualLoading ? "…" : "Go"}
              </button>
            </form>
          )}
        </div>

        <div className="relative rounded-[24px] overflow-hidden min-h-[280px] lg:min-h-0 bg-[#f0f0f0]">
          <img
            src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80"
            alt=""
            className="w-full h-full object-cover absolute inset-0"
          />
        </div>
      </section>

      {recs.length > 0 && (
        <section className="pt-14">
          <div className="flex justify-between items-end mb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-mist mb-2">For you</p>
              <h2 className="font-display text-4xl">Near enough to say yes.</h2>
            </div>
            <span className="text-sm text-mist hidden sm:inline">Curated from your preferences</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {recs.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} />
            ))}
          </div>
        </section>
      )}

      <FilterPanel value={filters} onChange={setFilters} disabled={thinking} onSubmit={findSomething} />
    </main>
  );
}
