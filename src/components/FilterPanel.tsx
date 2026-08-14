"use client";

import { INTEREST_OPTIONS, BUDGET_OPTIONS, PACE_OPTIONS, COUNT_OPTIONS, DEFAULT_MAX_DISTANCE_KM } from "@/lib/constants";
import type { RecommendationFilters } from "@/lib/types";

/**
 * Session-only filters for a single "find something" request — layered on
 * top of the user's saved profile preferences without editing them. Styled
 * as the "tune the recommendation" panel: pick a vibe, optionally narrow
 * budget/pace/distance, then trigger the same fetch as the hero CTA.
 */
export default function FilterPanel({
  value,
  onChange,
  disabled,
  onSubmit,
}: {
  value: RecommendationFilters;
  onChange: (next: RecommendationFilters) => void;
  disabled?: boolean;
  onSubmit: () => void;
}) {
  const distanceEnabled = value.distanceEnabled ?? true;

  function toggleInterest(tag: string) {
    const current = value.interests ?? [];
    const next = current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag];
    onChange({ ...value, interests: next.length ? next : undefined });
  }

  const activeCount =
    (value.interests?.length ?? 0) +
    (value.budget ? 1 : 0) +
    (value.pace ? 1 : 0) +
    (value.maxDistanceKm ? 1 : 0) +
    (value.distanceEnabled === false ? 1 : 0) +
    (value.count ? 1 : 0);

  return (
    <section className="panel-plate mt-14 p-7 sm:p-8 flex flex-col sm:grid sm:grid-cols-[1fr_auto] gap-6 sm:items-center">
      <fieldset disabled={disabled} className="disabled:opacity-50">
        <p className="text-xs uppercase tracking-[0.16em] text-mist mb-1.5">Tune the recommendation</p>
        <h3 className="font-display text-3xl mb-1.5">What sounds good right now?</h3>
        <p className="text-sm text-mist mb-4">IDLE only needs a little context.</p>

        <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Interests">
          <button
            type="button"
            onClick={() => onChange({})}
            aria-pressed={activeCount === 0}
            className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${
              activeCount === 0
                ? "bg-ink border-ink text-paper"
                : "border-ink/15 text-ink-soft hover:border-ink/40"
            }`}
          >
            Surprise me
          </button>
          {INTEREST_OPTIONS.map((tag) => {
            const active = (value.interests ?? []).includes(tag);
            return (
              <button
                type="button"
                key={tag}
                onClick={() => toggleInterest(tag)}
                aria-pressed={active}
                className={`px-3.5 py-2 rounded-full text-sm border transition-colors ${
                  active ? "bg-ink border-ink text-paper" : "border-ink/15 text-ink-soft hover:border-ink/40"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-mist mb-2">Budget</p>
            <div className="flex gap-1.5">
              {BUDGET_OPTIONS.map((b) => (
                <button
                  type="button"
                  key={b}
                  onClick={() => onChange({ ...value, budget: value.budget === b ? undefined : b })}
                  aria-pressed={value.budget === b}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                    value.budget === b
                      ? "bg-sage-tint border-sage text-sage"
                      : "border-ink/15 text-ink-soft hover:border-sage/60"
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-mist mb-2">Pace</p>
            <div className="flex gap-1.5">
              {PACE_OPTIONS.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => onChange({ ...value, pace: value.pace === p ? undefined : p })}
                  aria-pressed={value.pace === p}
                  className={`px-3 py-1 rounded-md text-xs border capitalize transition-colors ${
                    value.pace === p
                      ? "bg-sage-tint border-sage text-sage"
                      : "border-ink/15 text-ink-soft hover:border-sage/60"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-mist mb-2">How many</p>
            <div className="flex gap-1.5">
              {COUNT_OPTIONS.map((n) => (
                <button
                  type="button"
                  key={n}
                  onClick={() => onChange({ ...value, count: value.count === n ? undefined : n })}
                  aria-pressed={value.count === n}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                    value.count === n
                      ? "bg-sage-tint border-sage text-sage"
                      : "border-ink/15 text-ink-soft hover:border-sage/60"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="min-w-[160px]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-mist">Distance</p>
              <button
                type="button"
                role="switch"
                aria-checked={distanceEnabled}
                aria-label="Toggle distance filter"
                onClick={() => onChange({ ...value, distanceEnabled: !distanceEnabled })}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                  distanceEnabled ? "bg-sage" : "bg-ink/15"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-card transition-transform ${
                    distanceEnabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {distanceEnabled ? (
              <>
                <label htmlFor="filter-radius" className="block text-xs text-mist mb-2">
                  Max distance{" "}
                  <span className="text-ink">
                    {value.maxDistanceKm ? `${value.maxDistanceKm} km` : `${DEFAULT_MAX_DISTANCE_KM} km (default)`}
                  </span>
                </label>
                <input
                  id="filter-radius"
                  type="range"
                  min={1}
                  max={50}
                  value={value.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM}
                  onChange={(e) => onChange({ ...value, maxDistanceKm: Number(e.target.value) })}
                  className="w-full accent-ink"
                />
              </>
            ) : (
              <p className="text-xs text-ink-soft leading-relaxed">
                Off — searching your whole country, based on taste only.
              </p>
            )}
          </div>
        </div>
      </fieldset>

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="btn-brass rounded-full px-6 py-3.5 font-medium text-sm whitespace-nowrap disabled:opacity-60"
      >
        Turn the dial →
      </button>
    </section>
  );
}
