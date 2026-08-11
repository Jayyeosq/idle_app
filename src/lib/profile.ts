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

/**
 * Parses the current preferences back out of the Preferences markdown
 * block. Kept in sync with createProfile/updatePreferences below — both
 * write a fixed label format ("- **Interests:** ..." etc.) specifically so
 * this stays a reliable round-trip, without needing a second, separate
 * structured store that could drift from the markdown file. The markdown
 * remains the single source of truth per the project's storage approach.
 */
export function parsePreferences(markdown: string): OnboardingData | null {
  const blockMatch = markdown.match(/## Preferences([\s\S]*?)(?=\n## History|$)/);
  if (!blockMatch) return null;
  const block = blockMatch[1];

  const get = (label: string): string | null => {
    const m = block.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
    return m ? m[1].trim() : null;
  };

  const budgetRaw = get("Budget");
  const paceRaw = get("Pace");
  if (!budgetRaw || !paceRaw) return null;

  const interestsRaw = get("Interests");
  const dietaryRaw = get("Dietary");
  const notesRaw = get("Notes");
  const radiusRaw = get("Travel radius");

  const isEmpty = (v: string | null) => !v || v === "(none given)";

  const budget: OnboardingData["budget"] = (["$", "$$", "$$$"] as const).includes(budgetRaw as any)
    ? (budgetRaw as OnboardingData["budget"])
    : "$$";
  const pace: OnboardingData["pace"] = (["chill", "balanced", "packed"] as const).includes(paceRaw as any)
    ? (paceRaw as OnboardingData["pace"])
    : "balanced";
  const travelRadiusKm = radiusRaw ? parseInt(radiusRaw, 10) : 5;

  return {
    interests: isEmpty(interestsRaw) ? [] : interestsRaw!.split(",").map((s) => s.trim()),
    budget,
    pace,
    dietary: isEmpty(dietaryRaw) ? "" : dietaryRaw!,
    travelRadiusKm: Number.isFinite(travelRadiusKm) ? travelRadiusKm : 5,
    notes: isEmpty(notesRaw) ? "" : notesRaw!,
  };
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
