"use client";

import { useState } from "react";
import type { Recommendation, FeedbackReaction } from "@/lib/types";

export default function RecommendationCard({ rec }: { rec: Recommendation }) {
  const [reaction, setReaction] = useState<FeedbackReaction | null>(null);
  const [sending, setSending] = useState(false);
  const [photoFailed, setPhotoFailed] = useState(false);
  const showPhoto = !!rec.photoUrl && !photoFailed;

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
    <article className="rounded-lg border border-white/10 bg-ink-soft overflow-hidden flex flex-col gap-3">
      {showPhoto ? (
        <img
          src={rec.photoUrl!}
          alt=""
          onError={() => setPhotoFailed(true)}
          className="w-full h-36 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-20 flex items-center justify-center bg-gradient-to-br from-ink to-ink-soft border-b border-white/10">
          <span className="font-mono text-xs text-mist uppercase tracking-wide">
            {rec.category}
          </span>
        </div>
      )}

      <div className="px-5 flex items-start justify-between gap-3">
        <div>
          {showPhoto && (
            <span className="font-mono text-xs text-brass uppercase tracking-wide">
              {rec.category}
            </span>
          )}
          <h3 className="font-display text-xl mt-0.5">{rec.name}</h3>
        </div>
      </div>

      <p className="text-paper/85 text-sm leading-relaxed px-5">{rec.why}</p>

      <div className="flex items-center justify-between mt-1 pt-3 px-5 pb-5 border-t border-white/10">
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
