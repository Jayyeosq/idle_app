import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";
import Dashboard from "@/components/Dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.userId);
  if (!user) redirect("/login");
  if (!user.onboarded) redirect("/onboarding");

  return <Dashboard email={user.email} />;
}
