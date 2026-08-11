import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { createProfile, updatePreferences, readProfile } from "@/lib/profile";
import { markOnboarded } from "@/lib/users";

const BodySchema = z.object({
  interests: z.array(z.string()).default([]),
  budget: z.enum(["$", "$$", "$$$"]),
  pace: z.enum(["chill", "balanced", "packed"]),
  dietary: z.string().max(300).default(""),
  travelRadiusKm: z.number().min(1).max(100),
  notes: z.string().max(1000).default(""),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const alreadyHasProfile = (await readProfile(session.userId)) !== null;
  if (alreadyHasProfile) {
    await updatePreferences(session.userId, session.email, parsed.data);
  } else {
    await createProfile(session.userId, session.email, parsed.data);
  }
  await markOnboarded(session.userId);

  return NextResponse.json({ ok: true });
}
