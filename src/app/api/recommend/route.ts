import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { readProfile, appendRecommendationSession } from "@/lib/profile";
import { reverseGeocode } from "@/lib/geocode";
import { getCurrentWeather } from "@/lib/weather";
import { selectRecommendations } from "@/lib/llm";
import { searchNearbyPlaces } from "@/lib/places";
import { DEFAULT_MAX_DISTANCE_KM } from "@/lib/constants";
import { nanoid } from "nanoid";

const FiltersSchema = z
  .object({
    interests: z.array(z.string()).optional(),
    budget: z.enum(["$", "$$", "$$$"]).optional(),
    pace: z.enum(["chill", "balanced", "packed"]).optional(),
    maxDistanceKm: z.number().positive().optional(),
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
  const maxDistanceKm = filters?.maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM;

  // All three run in parallel — reverseGeocode is always called now (even
  // when the client already supplied a label) specifically to get a
  // reliable country code for the cross-border filter below, without
  // forcing searchNearbyPlaces to wait on it first.
  const [geocodeResult, weather, candidates] = await Promise.all([
    reverseGeocode(lat, lon),
    getCurrentWeather(lat, lon),
    searchNearbyPlaces(lat, lon, maxDistanceKm),
  ]);

  const label = parsed.data.label ?? geocodeResult.label;
  const userCountryCode = geocodeResult.countryCode;

  // TEMPORARY DIAGNOSTIC — remove once cross-border filtering is
  // confirmed working. Shows directly whether the user's own country
  // resolved at all, separate from whether anything got dropped.
  console.info(`[recommend] userCountryCode=${userCountryCode ?? "null"}, ${candidates.length} candidates before border filter`);

  // A straight-line distance can be technically "within range" while
  // crossing an international border — a much bigger ask than the same
  // distance domestically (different currency, passport/customs, phone
  // roaming). Only enforced when both the user's and a candidate's
  // country are confirmed; unknown on either side fails open rather than
  // dropping a possibly-valid result, same philosophy as the closed-venue
  // filter in lib/places.ts.
  const inCountryCandidates = userCountryCode
    ? candidates.filter((c) => !c.countryCode || c.countryCode === userCountryCode)
    : candidates;

  const droppedCrossBorder = candidates.length - inCountryCandidates.length;
  if (droppedCrossBorder > 0) {
    console.info(
      `[recommend] Dropped ${droppedCrossBorder} cross-border candidate(s) — user country ${userCountryCode}.`
    );
  }

  if (inCountryCandidates.length === 0) {
    return NextResponse.json(
      {
        error:
          "Couldn't find any nearby places within that distance right now. Try widening your distance filter.",
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
      candidates: inCountryCandidates,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "The recommendation engine failed. Try again." },
      { status: 502 }
    );
  }

  const sessionId = nanoid(6);
  await appendRecommendationSession(
    session.userId,
    sessionId,
    { lat, lon, label },
    recommendations
  );

  return NextResponse.json({ sessionId, location: label, weather, recommendations });
}
