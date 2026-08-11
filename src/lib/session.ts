import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionPayload } from "./auth";

/** Reads and verifies the session cookie in a server component or route handler. */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
