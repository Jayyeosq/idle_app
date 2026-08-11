import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, verifyPassword } from "@/lib/users";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/auth";

const BodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const user = await findUserByEmail(email);
  const valid = user ? await verifyPassword(user, password) : false;

  if (!user || !valid) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
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
