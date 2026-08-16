import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { readProfile, appendRecommendationSession, parsePreferences } from "@/lib/profile";
import { reverseGeocode } from "@/lib/geocode";
import { getCurrentWeather } from "@/lib/weather";
import { selectRecommendations } from "@/lib/llm";
import { searchNearbyPlaces } from "@/lib/places";
import { DEFAULT_MAX_DISTANCE_KM, COUNTRY_WIDE_RADIUS_KM } from "@/lib/constants";
import { nanoid } from "nanoid";

const FiltersSchema = z
  .object({
    interests: z.array(z.string()).optional(),
    budget: z.enum(["$", "$$", "$$$"]).optional(),
    pace: z.enum(["chill", "balanced", "packed"]).optional(),
    maxDistanceKm: z.number().positive().optional(),
    distanceEnabled: z.boolean().optional(),
    count: z.union([z.literal(3), z.literal(5), z.literal(8)]).optional(),
  })
  .optional();

const BodySchema = z.object({
  lat: z.number(),
  lon: z.number(),
  // Set when coordinates came from the manual-location fallback (already
  // forward-geocoded client-side) — used for display text, but country is
  // still resolved fresh server-side below (see the reverseGeocode call),
  // since cross-border filtering needs it regardless of label source.
  label: z.string().optional(),
  filters: FiltersSchema,
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing or invalid coordinates." }, { status: 400 });
  }

  const profileMarkdown = await readProfile(session.userId);
  if (!profileMarkdown) {
    return NextResponse.json({ error: "Finish onboarding first." }, { status: 400 });
  }

  const { lat, lon, filters } = parsed.data;
  // undefined/true = normal distance-bounded search. false = distance
  // isn't applied as a constraint at all — search covers the whole
  // country instead. The real "same country" boundary in that mode is
  // enforced below by the country-code filter, not by this radius number;
  // COUNTRY_WIDE_RADIUS_KM just needs to be large enough to reach a
  // country's edges from wherever the user is (see its own doc comment
  // for the honest limitation on very large countries).
  const distanceEnabled = filters?.distanceEnabled ?? true;
  const maxDistanceKm = distanceEnabled ? filters?.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM : COUNTRY_WIDE_RADIUS_KM;

  // Session filter takes priority (same "prefer this request's filters
  // over the saved profile" pattern used elsewhere), falling back to
  // whatever's saved in the profile if this request didn't set any —
  // this is what actually lets interests shape the SEARCH itself now,
  // not just the LLM's selection from a generic pool afterward.
  const effectiveInterests = filters?.interests?.length
    ? filters.interests
    : parsePreferences(profileMarkdown)?.interests;

  // All three run in parallel — reverseGeocode is always called now (even
  // when the client already supplied a label) specifically to get a
  // reliable country code for the cross-border filter below, without
  // forcing searchNearbyPlaces to wait on it first.
  const [geocodeResult, weather, candidates] = await Promise.all([
    reverseGeocode(lat, lon),
    getCurrentWeather(lat, lon),
    searchNearbyPlaces(lat, lon, maxDistanceKm, effectiveInterests),
  ]);

  const label = parsed.data.label ?? geocodeResult.label;
  const userCountryCode = geocodeResult.countryCode;

  // A straight-line distance can be technically "within range" while
  // crossing an international border — a much bigger ask than the same
  // distance domestically (different currency, passport/customs, phone
  // roaming). This is also the ONLY real boundary enforced when distance
  // is toggled off, so it always runs regardless of distanceEnabled. Only
  // enforced when both the user's and a candidate's country are
  // confirmed; unknown on either side fails open rather than dropping a
  // possibly-valid result, same philosophy as the closed-venue filter in
  // lib/places.ts.
  const inCountryCandidates = userCountryCode
    ? candidates.filter((c) => !c.countryCode || c.countryCode === userCountryCode)
    : candidates;

  if (inCountryCandidates.length === 0) {
    return NextResponse.json(
      {
        error: distanceEnabled
          ? "Couldn't find any nearby places within that distance right now. Try widening your distance filter."
          : "Couldn't find any places to recommend right now. Try again in a moment.",
      },
      { status: 502 }
    );
  }

  const localTime = new Date().toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  let recommendations;
  try {
    recommendations = await selectRecommendations({
      profileMarkdown,
      location: { lat, lon, label },
      localTime,
      weather,
      filters,
      distanceEnabled,
      candidates: inCountryCandidates,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "The recommendation engine failed. Try again." },
      { status: 502 }
    );
  }

  // TEMPORARY DIAGNOSTIC — remove once this is confirmed working. Shows
  // exactly what got selected and its real distance, and confirms
  // distanceEnabled actually reached this point correctly — separates
  // "the toggle isn't reaching the server" from "the server has it right
  // but the model still picked near ones anyway."
  console.info(
    `[recommend] distanceEnabled=${distanceEnabled}, pool had ${inCountryCandidates.length} candidates spanning up to ${Math.max(...inCountryCandidates.map((c) => c.distanceKm)).toFixed(1)}km — selected: ${recommendations.map((r) => `${r.name} (${r.distanceHint})`).join(" | ")}`
  );

  const sessionId = nanoid(6);
  await appendRecommendationSession(
    session.userId,
    sessionId,
    { lat, lon, label },
    recommendations
  );

  return NextResponse.json({ sessionId, location: label, weather, recommendations });
}
