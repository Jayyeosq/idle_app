"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Dial from "@/components/Dial";
import RecommendationCard from "@/components/RecommendationCard";
import type { Recommendation, WeatherInfo } from "@/lib/types";

type Status = "idle" | "locating" | "thinking" | "error";

export default function Dashboard({ email }: { email: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);

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

  async function findSomething() {
    setError(null);
    setStatus("locating");
    let position: GeolocationPosition;
    try {
      position = await getPosition();
    } catch {
      setError("IDLE needs location access to suggest things nearby. Allow it and try again.");
      setStatus("error");
      return;
    }

    setStatus("thinking");
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        }),
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
    } catch {
      setError("Couldn't reach the server. Try again.");
      setStatus("error");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const thinking = status === "locating" || status === "thinking";

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
        className="flex flex-col items-center gap-4 group"
      >
        <Dial size={120} spinning={thinking} />
        <span className="font-mono text-sm text-brass group-hover:text-brass-soft transition-colors">
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
