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
  // geocoded client-side), so we skip a redundant reverse-geocode call.
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

  const [label, weather, candidates] = await Promise.all([
    parsed.data.label ? Promise.resolve(parsed.data.label) : reverseGeocode(lat, lon),
    getCurrentWeather(lat, lon),
    searchNearbyPlaces(lat, lon, maxDistanceKm),
  ]);

  if (candidates.length === 0) {
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
      candidates,
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
