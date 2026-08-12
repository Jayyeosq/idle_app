"use client";

import { useEffect, useState } from "react";

// Asia/Singapore is UTC+8 year-round (no daylight saving), so this stays a
// stable, correct "UTC+8" without any manual offset math.
const DEFAULT_TIMEZONE = "Asia/Singapore";

export default function ClockBadge() {
  // Starts null so the server-rendered markup and the client's first paint
  // match exactly (both render nothing) — the clock only starts once
  // mounted client-side, avoiding a hydration mismatch on the current time.
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  const time = now.toLocaleTimeString("en-US", {
    timeZone: DEFAULT_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="hidden sm:flex items-center gap-2 text-xs border border-ink/10 rounded-full px-3 py-1.5 text-ink-soft">
      <span className="tabular-nums">{time}</span>
      <span className="text-mist">·</span>
      <span>UTC+8</span>
    </div>
  );
}
