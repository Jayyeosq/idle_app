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
    <article className="panel-plate p-2.5">
      <div className="relative h-[220px] rounded-[18px] overflow-hidden bg-[#f0f0f0]">
        {showPhoto ? (
          <img
            src={rec.photoUrl!}
            alt=""
            onError={() => setPhotoFailed(true)}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#f0f0f0]">
            <span className="text-xs uppercase tracking-[0.1em] text-mist">{rec.category}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => react("up")}
          disabled={!!reaction}
          aria-pressed={reaction === "up"}
          aria-label={`Like ${rec.name}`}
          className={`absolute right-3.5 top-3.5 w-9 h-9 rounded-full flex items-center justify-center text-lg transition-colors ${
            reaction === "up" ? "bg-ink text-paper" : "bg-card/85 hover:bg-card disabled:opacity-40"
          }`}
        >
          {reaction === "up" ? "♥" : "♡"}
        </button>
      </div>

      <div className="px-2.5 pt-4 pb-3">
        <p className="text-xs uppercase tracking-[0.08em] text-mist mb-2">
          {rec.category} · {rec.estimatedTime} · {rec.distanceHint}
        </p>
        <h3 className="font-display text-xl mb-1.5">{rec.name}</h3>
        <p className="text-[13px] text-ink-soft leading-relaxed mb-3">{rec.why}</p>

        {!reaction ? (
          <button
            type="button"
            onClick={() => react("down")}
            disabled={sending}
            className="text-xs text-mist hover:text-rust underline underline-offset-4 disabled:opacity-40"
          >
            Not for me
          </button>
        ) : (
          <span className="text-xs text-mist">
            {reaction === "up" ? "Saved to your taste" : "Noted — won't suggest more like this"}
          </span>
        )}
      </div>
    </article>
  );
}
