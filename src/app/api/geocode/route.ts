import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { forwardGeocode } from "@/lib/geocode";

const BodySchema = z.object({
  query: z.string().trim().min(2).max(200),
});

// Backs the manual-location fallback on the dashboard: turns a typed place
// name into coordinates when the browser can't (or won't) provide
// Geolocation, e.g. permission denied or unsupported on some mobile setups.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a place name or address." }, { status: 400 });
  }

  const result = await forwardGeocode(parsed.data.query);
  if (!result) {
    return NextResponse.json(
      { error: "Couldn't find that place. Try being more specific." },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
