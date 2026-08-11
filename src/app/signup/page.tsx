import Link from "next/link";
import Dial from "@/components/Dial";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="panel-plate rounded-2xl px-10 pt-10 pb-8 flex flex-col items-center">
        <span className="font-mono text-[11px] tracking-[0.25em] text-mist/70 uppercase mb-5">
          New instrument
        </span>
        <Dial size={72} />
        <h1 className="font-display text-4xl mt-6 tracking-tight">IDLE</h1>
        <p className="text-mist mt-2 mb-10 text-center max-w-xs">
          A couple of minutes of setup, then IDLE learns your taste as you go.
        </p>

        <AuthForm mode="signup" />
      </div>

      <p className="text-sm text-mist mt-8">
        Already have an account?{" "}
        <Link href="/login" className="text-brass hover:text-brass-soft underline underline-offset-4">
          Log in
        </Link>
      </p>
    </main>
  );
}
