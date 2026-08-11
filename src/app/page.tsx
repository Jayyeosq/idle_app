import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { findUserById } from "@/lib/users";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await findUserById(session.userId);
  redirect(user?.onboarded ? "/dashboard" : "/onboarding");
}
