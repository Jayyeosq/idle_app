import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { appendFeedback } from "@/lib/profile";

const BodySchema = z.object({
  recId: z.string(),
  recName: z.string(),
  reaction: z.enum(["up", "down"]),
});

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  await appendFeedback(session.userId, parsed.data.recId, parsed.data.recName, parsed.data.reaction);
  return NextResponse.json({ ok: true });
}
