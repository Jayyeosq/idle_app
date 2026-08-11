import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createUser } from "@/lib/users";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input." },
      { status: 400 }
    );
  }

  const { email, password } = parsed.data;

  let user;
  try {
    user = await createUser(email, password);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Could not create account." }, { status: 409 });
  }

  const token = await createSessionToken({ userId: user.id, email: user.email });
  const res = NextResponse.json({ ok: true, onboarded: user.onboarded });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
