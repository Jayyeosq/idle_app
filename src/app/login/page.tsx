import Link from "next/link";
import Dial from "@/components/Dial";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <Dial size={72} />
      <h1 className="font-display text-4xl mt-6 tracking-tight">IDLE</h1>
      <p className="text-mist mt-2 mb-10 text-center max-w-xs">
        Welcome back. Log in to see what's worth doing right now.
      </p>

      <AuthForm mode="login" />

      <p className="text-sm text-mist mt-8">
        New here?{" "}
        <Link href="/signup" className="text-brass hover:text-brass-soft underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </main>
  );
}
