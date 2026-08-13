import { nanoid } from "nanoid";
import { z } from "zod";
import type { LocationInfo, WeatherInfo, Recommendation, RecommendationFilters } from "./types";
import type { PlaceCandidate } from "./places";

/**
 * Selects and personalizes recommendations from a pool of already-verified
 * real, open candidates within the user's chosen distance range (see
 * lib/places.ts), rather than generating venue names from scratch. The
 * model's job here is narrower and safer than before: pick the
 * best-matching candidates for this user's taste profile from a numbered
 * list, and write a short reason for each — it can no longer invent a
 * name, guess a distance, or suggest somewhere closed or out of range,
 * because everything it can choose from is already confirmed real, in
 * range, and open before it ever runs.
 */

const SelectionSchema = z.object({
  number: z.number().int(),
  why: z.string(),
  estimatedTime: z.string(),
});

const SelectResponseSchema = z.object({
  selections: z.array(SelectionSchema).min(1),
});

function buildSystemPrompt(count: number): string {
  return `You are the recommendation engine behind IDLE, an app that suggests what
someone could go do right now based on their stored taste profile and their
current situation. You will be given:

1. The user's profile file, a markdown document containing their stated
   preferences plus a running history of past suggestions and whether the
   user liked or passed on each one.
2. Their current location, local time, and (if available) the weather.
3. A numbered list of REAL, currently-open places that fit within the
   user's selected distance range — already confirmed to exist and to be
   within that range. Each entry states its own real, measured distance —
   trust that number exactly as given, not as a rough hint. The range may
   be wide: a request with a large distance limit will include candidates
   from a few hundred meters away up to the full limit, and a candidate
   near the far end is exactly as valid a pick as one nearby if it's the
   better match. This list is ground truth, not a suggestion for you to
   second-guess.

Study the History section for patterns — repeated likes suggest what to lean
into, repeated passes suggest what to avoid — but don't just repeat past
suggestions; use them as signal about taste, not a list to reuse verbatim.

Your job is to SELECT the best ${count} candidates from the numbered list for
this specific user right now, and write a short personalized reason for each
— never invent a place that isn't on the list, and never renumber or
relabel one. If the weather makes an outdoor venue unpleasant, prefer indoor
candidates from the list instead. If fewer than ${count} candidates are a
good fit, select fewer rather than forcing a weak match — quality over
hitting an exact count.

The list order carries no meaning — it is not sorted by preference,
distance, or quality. Read the entire list before selecting. Do not
default to whichever candidates happen to appear first, and do not
default to whichever candidates happen to be closest, either — a wide
distance range exists because the user chose it, so treat farther options
within that range as fully legitimate, not as a fallback for when nothing
closer is good enough. Give genuine, independent consideration to every
option and select based on fit with the user's taste, not position or
proximity.

Some candidates list a rating and review count (e.g. "4.5★ from 230
reviews") — this is a real signal from real people, not decoration. When
multiple candidates are a similarly good fit for the user's taste, prefer
the one with the stronger rating and higher review count; a high average
from very few reviews is weaker evidence than a slightly lower average
from hundreds. Candidates with no listed rating aren't necessarily worse —
some genuinely good small or newer venues simply don't have many reviews
yet — so don't penalize missing data, but do actively favor a well-proven
option when it's an equally strong match. Taste-fit still comes first:
never pick a worse fit just because it's more popular.

Respond with ONLY a JSON object (no markdown fences, no commentary) matching
exactly this shape:

{
  "selections": [
    {
      "number": <integer — must be one of the numbers from the candidate list>,
      "why": "one or two sentences tying this specific place to the user's profile and current context",
      "estimatedTime": "short duration string for how long to spend there, e.g. '45 min'"
    }
  ]
}`;
}

function formatCandidateList(candidates: PlaceCandidate[]): string {
  return candidates
    .map((c, i) => {
      const bits = [c.category, c.distanceHint];
      if (c.rating !== null) {
        const reviews = c.ratingCount !== null ? ` from ${c.ratingCount} reviews` : "";
        bits.push(`${c.rating.toFixed(1)}★${reviews}`);
      }
      if (c.priceLevel) bits.push(c.priceLevel);
      return `${i + 1}. ${c.name} — ${bits.join(", ")}`;
    })
    .join("\n");
}

/**
 * Fisher-Yates shuffle. Candidates arrive from lib/places.ts sorted
 * nearest-first, which is useful for the wide-radius POPULARITY blend's
 * diagnostics but is exactly the wrong order to hand an LLM: models have a
 * well-documented tendency to over-favor items near the top of a list, so
 * a strictly nearest-first prompt list can systematically starve out
 * farther candidates regardless of how good a match they'd be — even ones
 * a wide distance filter specifically worked to include. Shuffling breaks
 * that positional bias.
 */
function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export async function selectRecommendations(opts: {
  profileMarkdown: string;
  location: LocationInfo;
  localTime: string;
  weather: WeatherInfo | null;
  filters?: RecommendationFilters;
  candidates: PlaceCandidate[];
}): Promise<Recommendation[]> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set. Add it to .env to enable recommendations.");
  }
  if (opts.candidates.length === 0) {
    return [];
  }

  // Shuffled once, reused for both the prompt's numbering and the final
  // number-to-candidate lookup below — same array, so a selection's
  // number always resolves to the same place the model saw at that
  // position.
  const candidates = shuffle(opts.candidates);

  const model = process.env.DEEPSEEK_MODEL || "deepseek-chat";

  const weatherLine = opts.weather
    ? `${opts.weather.tempC}°C, ${opts.weather.condition}`
    : "unavailable";

  const f = opts.filters;
  // Never ask for more than the pool actually has — avoids the model
  // being forced to pad out weak selections just to hit a count.
  const count = Math.min(f?.count ?? 5, candidates.length);

  const filterLines: string[] = [];
  if (f?.interests?.length) filterLines.push(`Interests: ${f.interests.join(", ")}`);
  if (f?.budget) filterLines.push(`Budget: ${f.budget}`);
  if (f?.pace) filterLines.push(`Pace: ${f.pace}`);
  const filterBlock = filterLines.length
    ? `\n## Filters for this request only\n\nApply these when selecting, preferring them over the profile's saved\npreferences wherever the two conflict, but do not treat them as a change\nto the user's underlying taste profile:\n\n${filterLines.map((l) => `- ${l}`).join("\n")}\n`
    : "";

  const userMessage = `## User profile file

${opts.profileMarkdown}

## Current context

- Location: ${opts.location.label} (lat ${opts.location.lat.toFixed(4)}, lon ${opts.location.lon.toFixed(4)})
- Local time: ${opts.localTime}
- Weather: ${weatherLine}
${filterBlock}
## Nearby real places to choose from

${formatCandidateList(candidates)}

Select and personalize ${count} of the above for this user right now.`;

  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      // Much shorter output than the old generate-from-scratch prompt —
      // only "why" + "estimatedTime" per pick now, not a full invented
      // record — so this needs meaningfully fewer tokens than before.
      max_tokens: 300 + count * 120,
      messages: [
        { role: "system", content: buildSystemPrompt(count) },
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

  const result = SelectResponseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error("DeepSeek returned an unexpected shape.");
  }

  // Defensive against the model returning an out-of-range or duplicate
  // number despite instructions — silently drop invalid picks rather than
  // crash the request over a model slip-up.
  const seen = new Set<number>();
  const recommendations: Recommendation[] = [];
  for (const sel of result.data.selections) {
    if (seen.has(sel.number)) continue;
    const candidate = candidates[sel.number - 1];
    if (!candidate) continue;
    seen.add(sel.number);

    recommendations.push({
      id: nanoid(8),
      name: candidate.name,
      category: candidate.category,
      why: sel.why,
      estimatedTime: sel.estimatedTime,
      distanceHint: candidate.distanceHint,
      photoUrl: candidate.photoUrl,
      mapsUrl: candidate.mapsUrl,
    });
  }

  return recommendations;
}
