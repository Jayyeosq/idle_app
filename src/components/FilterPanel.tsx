"use client";

import { useState } from "react";
import { INTEREST_OPTIONS, BUDGET_OPTIONS, PACE_OPTIONS } from "@/lib/constants";
import type { RecommendationFilters } from "@/lib/types";

/**
 * Session-only filters for a single "find something" request — layered on
 * top of the user's saved profile preferences without editing them. Mainly
 * useful for returning users who want to nudge a specific request (e.g.
 * "just food, chill pace") without redoing onboarding.
 */
export default function FilterPanel({
  value,
  onChange,
  disabled,
}: {
  value: RecommendationFilters;
  onChange: (next: RecommendationFilters) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function toggleInterest(tag: string) {
    const current = value.interests ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    onChange({ ...value, interests: next.length ? next : undefined });
  }

  const activeCount =
    (value.interests?.length ?? 0) +
    (value.budget ? 1 : 0) +
    (value.pace ? 1 : 0) +
    (value.maxDistanceKm ? 1 : 0);

  return (
    <div className="w-full max-w-xl mt-8">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="font-mono text-xs text-mist hover:text-paper underline underline-offset-4"
      >
        Filters{activeCount ? ` (${activeCount})` : ""} {open ? "▲" : "▼"}
      </button>

      {open && (
        <fieldset
          disabled={disabled}
          className="mt-4 rounded-lg border border-white/10 bg-ink-soft p-4 space-y-4 disabled:opacity-50"
        >
          <div>
            <legend className="font-mono text-xs text-mist mb-2">this time, I&rsquo;m into&hellip;</legend>
            <div className="flex flex-wrap gap-1.5">
              {INTEREST_OPTIONS.map((tag) => {
                const active = (value.interests ?? []).includes(tag);
                return (
                  <button
                    type="button"
                    key={tag}
                    onClick={() => toggleInterest(tag)}
                    aria-pressed={active}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      active
                        ? "bg-brass border-brass text-ink"
                        : "border-white/15 text-paper/85 hover:border-brass/60"
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <p className="font-mono text-xs text-mist mb-2">budget</p>
              <div className="flex gap-1.5">
                {BUDGET_OPTIONS.map((b) => (
                  <button
                    type="button"
                    key={b}
                    onClick={() => onChange({ ...value, budget: value.budget === b ? undefined : b })}
                    aria-pressed={value.budget === b}
                    className={`px-3 py-1 rounded-md text-xs border font-mono transition-colors ${
                      value.budget === b
                        ? "bg-sage border-sage text-ink"
                        : "border-white/15 text-paper/85 hover:border-sage/60"
                    }`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="font-mono text-xs text-mist mb-2">pace</p>
              <div className="flex gap-1.5">
                {PACE_OPTIONS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => onChange({ ...value, pace: value.pace === p ? undefined : p })}
                    aria-pressed={value.pace === p}
                    className={`px-3 py-1 rounded-md text-xs border capitalize transition-colors ${
                      value.pace === p
                        ? "bg-sage border-sage text-ink"
                        : "border-white/15 text-paper/85 hover:border-sage/60"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="filter-radius" className="block font-mono text-xs text-mist mb-2">
              max distance{" "}
              <span className="text-brass">
                {value.maxDistanceKm ? `${value.maxDistanceKm} km` : "profile default"}
              </span>
            </label>
            <input
              id="filter-radius"
              type="range"
              min={1}
              max={50}
              value={value.maxDistanceKm ?? 5}
              onChange={(e) => onChange({ ...value, maxDistanceKm: Number(e.target.value) })}
              className="w-full accent-brass"
            />
          </div>

          {activeCount > 0 && (
            <button
              type="button"
              onClick={() => onChange({})}
              className="font-mono text-xs text-mist hover:text-rust underline underline-offset-4"
            >
              clear filters
            </button>
          )}
        </fieldset>
      )}
    </div>
  );
}
