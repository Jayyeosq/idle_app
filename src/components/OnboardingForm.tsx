"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INTEREST_OPTIONS } from "@/lib/constants";
import type { OnboardingData } from "@/lib/types";

export default function OnboardingForm({ initialData }: { initialData?: OnboardingData | null }) {
  const router = useRouter();
  const isEditing = !!initialData;
  const [interests, setInterests] = useState<string[]>(initialData?.interests ?? []);
  const [budget, setBudget] = useState<"$" | "$$" | "$$$">(initialData?.budget ?? "$$");
  const [pace, setPace] = useState<"chill" | "balanced" | "packed">(initialData?.pace ?? "balanced");
  const [dietary, setDietary] = useState(initialData?.dietary ?? "");
  const [travelRadiusKm, setTravelRadiusKm] = useState(initialData?.travelRadiusKm ?? 5);
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleInterest(tag: string) {
    setInterests((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (interests.length === 0) {
      setError("Pick at least one interest so IDLE has somewhere to start.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests, budget, pace, dietary, travelRadiusKm, notes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save your preferences.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl space-y-10">
      <fieldset>
        <legend className="font-mono text-sm text-mist mb-3">
          01 — what are you into? <span className="text-mist/60">(pick a few)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {INTEREST_OPTIONS.map((tag) => {
            const active = interests.includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggleInterest(tag)}
                aria-pressed={active}
                className={`px-3.5 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? "bg-ink border-ink text-paper"
                    : "border-ink/15 text-ink/80 hover:border-brass/60"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-mono text-sm text-mist mb-3">02 — usual budget</legend>
        <div className="flex gap-2">
          {(["$", "$$", "$$$"] as const).map((b) => (
            <button
              type="button"
              key={b}
              onClick={() => setBudget(b)}
              aria-pressed={budget === b}
              className={`px-4 py-1.5 rounded-md text-sm border font-mono transition-colors ${
                budget === b
                  ? "bg-sage-tint border-sage text-sage"
                  : "border-ink/15 text-ink/80 hover:border-sage/60"
              }`}
            >
              {b}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-mono text-sm text-mist mb-3">03 — preferred pace</legend>
        <div className="flex gap-2">
          {(["chill", "balanced", "packed"] as const).map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPace(p)}
              aria-pressed={pace === p}
              className={`px-4 py-1.5 rounded-md text-sm border capitalize transition-colors ${
                pace === p
                  ? "bg-sage-tint border-sage text-sage"
                  : "border-ink/15 text-ink/80 hover:border-sage/60"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <label htmlFor="radius" className="block font-mono text-sm text-mist mb-3">
          04 — how far will you travel? <span className="text-brass">{travelRadiusKm} km</span>
        </label>
        <input
          id="radius"
          type="range"
          min={1}
          max={50}
          value={travelRadiusKm}
          onChange={(e) => setTravelRadiusKm(Number(e.target.value))}
          className="w-full accent-brass"
        />
      </fieldset>

      <fieldset>
        <label htmlFor="dietary" className="block font-mono text-sm text-mist mb-2">
          05 — dietary notes <span className="text-mist/60">(optional)</span>
        </label>
        <input
          id="dietary"
          type="text"
          value={dietary}
          onChange={(e) => setDietary(e.target.value)}
          placeholder="vegetarian, no shellfish, halal..."
          className="w-full rounded-md bg-card border border-ink/10 px-3.5 py-2.5 text-ink placeholder:text-mist/50 focus:border-brass outline-none transition-colors"
        />
      </fieldset>

      <fieldset>
        <label htmlFor="notes" className="block font-mono text-sm text-mist mb-2">
          06 — anything else? <span className="text-mist/60">(optional)</span>
        </label>
        <textarea
          id="notes"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. I hate crowds, I love a good rooftop, I'm usually free after 6pm..."
          className="w-full rounded-md bg-card border border-ink/10 px-3.5 py-2.5 text-ink placeholder:text-mist/50 focus:border-brass outline-none transition-colors resize-none"
        />
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-brass w-full rounded-full font-medium py-3 disabled:opacity-60"
      >
        {loading ? "Saving..." : isEditing ? "Save changes" : "Start IDLE-ing"}
      </button>
    </form>
  );
}
