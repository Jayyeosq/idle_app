import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import { readProfile, parsePreferences, parseHistory } from "@/lib/profile";
import Dial from "@/components/Dial";

export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.userId);
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  const profileMarkdown = await readProfile(session.userId);
  const preferences = profileMarkdown ? parsePreferences(profileMarkdown) : null;
  const history = profileMarkdown ? parseHistory(profileMarkdown) : [];

  return (
    <main className="max-w-3xl mx-auto px-6 sm:px-8 py-12">
      <div className="flex items-center justify-between mb-10">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Dial size={22} />
          <span className="font-medium text-lg tracking-wide">IDLE</span>
        </Link>
        <Link href="/dashboard" className="text-sm text-mist hover:text-ink underline underline-offset-4">
          Back to dashboard
        </Link>
      </div>

      <h1 className="font-display text-4xl mb-1">Your profile</h1>
      <p className="text-mist mb-10">{user.email}</p>

      <section className="panel-plate p-6 sm:p-7 mb-12">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-[0.16em] text-mist">Preferences</p>
          <Link
            href="/onboarding"
            className="text-sm text-sage hover:text-ink underline underline-offset-4"
          >
            Edit preferences
          </Link>
        </div>
        {preferences ? (
          <ul className="text-sm text-ink-soft space-y-2">
            <li>
              <span className="text-ink">Interests: </span>
              {preferences.interests.length ? preferences.interests.join(", ") : "none set"}
            </li>
            <li>
              <span className="text-ink">Budget: </span>
              {preferences.budget}
            </li>
            <li>
              <span className="text-ink">Pace: </span>
              {preferences.pace}
            </li>
            {preferences.dietary && (
              <li>
                <span className="text-ink">Dietary: </span>
                {preferences.dietary}
              </li>
            )}
            <li>
              <span className="text-ink">Travel radius: </span>
              {preferences.travelRadiusKm} km
            </li>
            {preferences.notes && (
              <li>
                <span className="text-ink">Notes: </span>
                {preferences.notes}
              </li>
            )}
          </ul>
        ) : (
          <p className="text-sm text-mist">No preferences saved yet.</p>
        )}
      </section>

      <p className="text-xs uppercase tracking-[0.16em] text-mist mb-4">
        History {history.length ? `(${history.length})` : ""}
      </p>

      {history.length === 0 ? (
        <p className="text-sm text-mist">
          Nothing yet — recommendations you get from IDLE will show up here.
        </p>
      ) : (
        <div className="space-y-4">
          {history.map((item) => (
            <article key={`${item.id}-${item.timestamp}`} className="panel-plate p-5">
              <div className="flex items-start justify-between gap-4 mb-1.5">
                <h3 className="font-display text-xl">{item.name}</h3>
                {item.reaction && (
                  <span
                    className={`text-xs shrink-0 rounded-full px-2.5 py-1 ${
                      item.reaction === "up" ? "bg-sage-tint text-sage" : "bg-rust/10 text-rust"
                    }`}
                  >
                    {item.reaction === "up" ? "Liked" : "Passed"}
                  </span>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.08em] text-mist mb-2">
                {item.category} · {item.estimatedTime} · {item.distanceHint}
              </p>
              <p className="text-sm text-ink-soft leading-relaxed mb-2">{item.why}</p>
              <p className="text-xs text-mist">
                {item.location} · {item.timestamp}
              </p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
