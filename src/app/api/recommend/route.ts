import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { getSession } from "@/lib/session";
import { readProfile, appendRecommendationSession } from "@/lib/profile";
import { reverseGeocode } from "@/lib/geocode";
import { getCurrentWeather } from "@/lib/weather";
import { generateRecommendations } from "@/lib/llm";

const BodySchema = z.object({
  lat: z.number(),
  lon: z.number(),
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

  const { lat, lon } = parsed.data;
  const [label, weather] = await Promise.all([
    reverseGeocode(lat, lon),
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
