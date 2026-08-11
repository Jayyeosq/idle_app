"use client";

import { useState } from "react";
import type { Recommendation, FeedbackReaction } from "@/lib/types";

export default function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [reaction, setReaction] = useState<FeedbackReaction | null>(null);
  const [sending, setSending] = useState(false);

  async function react(next: FeedbackReaction) {
    if (reaction || sending) return;
    setSending(true);
    setReaction(next); // optimistic — this is a low-stakes preference signal
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recId: rec.id, recName: rec.name, reaction: next }),
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <article className="rounded-lg border border-white/10 bg-ink-soft p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="font-mono text-xs text-brass uppercase tracking-wide">
            {rec.category}
          </span>
          <h3 className="font-display text-xl mt-0.5">{rec.name}</h3>
        </div>
      </div>

      <p className="text-paper/85 text-sm leading-relaxed">{rec.why}</p>

      <div className="flex items-center justify-between mt-1 pt-3 border-t border-white/10">
        <div className="font-mono text-xs text-mist flex gap-3">
          <span>{rec.estimatedTime}</span>
          <span>·</span>
          <span>{rec.distanceHint}</span>
        </div>

        <div className="flex gap-1.5" role="group" aria-label={`Rate ${rec.name}`}>
          <button
            type="button"
            onClick={() => react("up")}
            disabled={!!reaction}
            aria-pressed={reaction === "up"}
            className={`px-2.5 py-1 rounded-md text-sm border transition-colors ${
              reaction === "up"
                ? "bg-sage border-sage text-ink"
                : "border-white/15 hover:border-sage/60 disabled:opacity-40"
            }`}
          >
            👍
          </button>
          <button
            type="button"
            onClick={() => react("down")}
            disabled={!!reaction}
            aria-pressed={reaction === "down"}
            className={`px-2.5 py-1 rounded-md text-sm border transition-colors ${
              reaction === "down"
                ? "bg-rust border-rust text-ink"
                : "border-white/15 hover:border-rust/60 disabled:opacity-40"
            }`}
          >
            👎
          </button>
        </div>
      </div>
    </article>
  );
}
