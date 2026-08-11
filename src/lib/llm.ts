import { nanoid } from "nanoid";
import { z } from "zod";
import type { LocationInfo, WeatherInfo, Recommendation, RecommendationFilters } from "./types";

const RecommendationSchema = z.object({
  name: z.string(),
  category: z.string(),
  why: z.string(),
  estimatedTime: z.string(),
  distanceHint: z.string(),
});
const ResponseSchema = z.object({
  recommendations: z.array(RecommendationSchema).min(1).max(6),
});

const SYSTEM_PROMPT = `You are the recommendation engine behind IDLE, an app that suggests what
someone could go do right now based on their stored taste profile and their
current situation. You will be given:

1. The user's profile file, a markdown document containing their stated
   preferences plus a running history of past suggestions and whether the
   user liked or passed on each one.
2. Their current location, local time, and (if available) the weather.

Study the History section for patterns — repeated likes suggest what to lean
into, repeated passes suggest what to avoid — but don't just repeat past
suggestions; use them as signal about taste, not a list to reuse verbatim.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching
exactly this shape:

{
  "recommendations": [
    {
      "name": "string, a specific place or activity, not a generic category",
      "category": "short label, e.g. food, nature, art, nightlife, rest",
      "why": "one or two sentences tying this to the user's profile and current context",
      "estimatedTime": "short duration string, e.g. '45 min'",
      "distanceHint": "short distance/travel string, e.g. '~1.2 km, 10 min walk'"
    }
  ]
}

Return between 3 and 5 recommendations. Prefer specific, plausible venues or
activities appropriate to the stated location over generic filler. If the
weather makes an outdoor activity unpleasant, favor indoor alternatives.`;

export async function generateRecommendations(opts: {
  profileMarkdown: string;
  location: LocationInfo;
  localTime: string;
  weather: WeatherInfo | null;
  filters?: RecommendationFilters;
}): Promise<Recommendation[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to .env to enable recommendations.");
  }

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const weatherLine = opts.weather
    ? `${opts.weather.tempC}°C, ${opts.weather.condition}`
    : "unavailable";

  const f = opts.filters;
  const filterLines: string[] = [];
  if (f?.interests?.length) filterLines.push(`Interests: ${f.interests.join(", ")}`);
  if (f?.budget) filterLines.push(`Budget: ${f.budget}`);
  if (f?.pace) filterLines.push(`Pace: ${f.pace}`);
  if (f?.maxDistanceKm) filterLines.push(`Max travel distance: ${f.maxDistanceKm} km`);
  const filterBlock = filterLines.length
    ? `\n## Filters for this request only\n\nThe user set these just for this request — apply them and prefer them\nover the profile's saved preferences wherever the two conflict, but do not\ntreat them as a change to the user's underlying taste profile:\n\n${filterLines.map((l) => `- ${l}`).join("\n")}\n`
    : "";

  const userMessage = `## User profile file

${opts.profileMarkdown}

## Current context

- Location: ${opts.location.label} (lat ${opts.location.lat.toFixed(4)}, lon ${opts.location.lon.toFixed(4)})
- Local time: ${opts.localTime}
- Weather: ${weatherLine}
${filterBlock}
Generate this user's IDLE recommendations for right now.`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("DeepSeek returned no text.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("DeepSeek returned invalid JSON.");
  }

  const result = ResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("DeepSeek returned an unexpected shape.");
  }

  return result.data.recommendations.map((r) => ({ id: nanoid(8), ...r }));
}
