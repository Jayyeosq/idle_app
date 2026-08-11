import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/session";
import { readProfile, appendRecommendationSession } from "@/lib/profile";
import { reverseGeocode } from "@/lib/geocode";
import { getCurrentWeather } from "@/lib/weather";
import { generateRecommendations } from "@/lib/llm";
import { attachPhotos } from "@/lib/photos";

const FiltersSchema = z
  .object({
    interests: z.array(z.string()).optional(),
    budget: z.enum(["$", "$$", "$$$"]).optional(),
    pace: z.enum(["chill", "balanced", "packed"]).optional(),
    maxDistanceKm: z.number().positive().optional(),
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
  const [label, weather] = await Promise.all([
    parsed.data.label ? Promise.resolve(parsed.data.label) : reverseGeocode(lat, lon),
    getCurrentWeather(lat, lon),
  ]);

  const localTime = new Date().toLocaleString("en-US", {
    weekday: "long",
    hour: "numeric",
    minute: "2-digit",
  });

  let recommendations;
  try {
    recommendations = await generateRecommendations({
      profileMarkdown,
      location: { lat, lon, label },
      localTime,
      weather,
      filters,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message ?? "The recommendation engine failed. Try again." },
      { status: 502 }
    );
  }

  recommendations = await attachPhotos(recommendations, { lat, lon });

  const sessionId = nanoid(6);
  await appendRecommendationSession(
    session.userId,
    sessionId,
    { lat, lon, label },
    recommendations
  );

  return NextResponse.json({ sessionId, location: label, weather, recommendations });
}
