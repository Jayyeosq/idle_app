import { readTextFile, writeTextFile, profileFilePath } from "./storage";
import type { OnboardingData, Recommendation, LocationInfo, FeedbackReaction } from "./types";

/**
 * Each user's whole taste profile — onboarding preferences plus a running
 * log of what's been suggested to them and how they reacted — lives in one
 * markdown file. That file is both a human-readable record and, verbatim,
 * the context we hand to the LLM when generating new recommendations, so
 * the model's picture of the user gets richer the more they use IDLE.
 */

export async function readProfile(userId: string): Promise<string | null> {
  return readTextFile(profileFilePath(userId));
}

export async function createProfile(
  userId: string,
  email: string,
  data: OnboardingData
): Promise<void> {
  const created = new Date().toISOString();
  const md = `# IDLE profile — ${email}

_Created: ${created}_

## Preferences

- **Interests:** ${data.interests.length ? data.interests.join(", ") : "(none given)"}
- **Budget:** ${data.budget}
- **Pace:** ${data.pace}
- **Dietary:** ${data.dietary || "(none given)"}
- **Travel radius:** ${data.travelRadiusKm} km
- **Notes:** ${data.notes || "(none given)"}

## History

_No recommendations yet — history will be appended below as IDLE is used._
`;
  await writeTextFile(profileFilePath(userId), md);
}

export async function updatePreferences(
  userId: string,
  email: string,
  data: OnboardingData
): Promise<void> {
  const existing = await readProfile(userId);
  if (!existing) {
    await createProfile(userId, email, data);
    return;
  }
  // Replace the Preferences section in place, leave History untouched.
  const prefsBlock = `## Preferences

- **Interests:** ${data.interests.length ? data.interests.join(", ") : "(none given)"}
- **Budget:** ${data.budget}
- **Pace:** ${data.pace}
- **Dietary:** ${data.dietary || "(none given)"}
- **Travel radius:** ${data.travelRadiusKm} km
- **Notes:** ${data.notes || "(none given)"}
`;
  const updated = existing.includes("## Preferences")
    ? existing.replace(/## Preferences[\s\S]*?(?=\n## History)/, prefsBlock + "\n")
    : existing + "\n" + prefsBlock;
  await writeTextFile(profileFilePath(userId), updated);
}

function timestampLabel(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/** Appends a new "session" of recommendations to the History section. */
export async function appendRecommendationSession(
  userId: string,
  sessionId: string,
  location: LocationInfo,
  recs: Recommendation[]
): Promise<void> {
  const existing = (await readProfile(userId)) ?? "";
  const header = `\n### ${timestampLabel(new Date())} — ${location.label} (session ${sessionId})\n`;
  const lines = recs
    .map((r) => `- [${r.id}] **${r.name}** _(${r.category}, ${r.estimatedTime}, ${r.distanceHint})_ — ${r.why}`)
    .join("\n");
  await writeTextFile(profileFilePath(userId), existing + header + lines + "\n");
}

/** Appends a like/dislike reaction against a previously suggested item. */
export async function appendFeedback(
  userId: string,
  recId: string,
  recName: string,
  reaction: FeedbackReaction
): Promise<void> {
  const existing = (await readProfile(userId)) ?? "";
  const symbol = reaction === "up" ? "👍 liked" : "👎 passed on";
  const line = `  - Feedback on [${recId}] "${recName}": ${symbol} (${timestampLabel(new Date())})\n`;
  await writeTextFile(profileFilePath(userId), existing + line);
}
