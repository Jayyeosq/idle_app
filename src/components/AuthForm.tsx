"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }
      router.push(data.onboarded ? "/dashboard" : "/onboarding");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
      <div>
        <label htmlFor="email" className="block text-xs uppercase tracking-wide text-mist mb-2">
          email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md bg-card border border-ink/10 px-3.5 py-2.5 text-ink placeholder:text-mist/50 focus:border-brass outline-none transition-colors"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-xs uppercase tracking-wide text-mist mb-2">
          password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-card border border-ink/10 px-3.5 py-2.5 text-ink placeholder:text-mist/50 focus:border-brass outline-none transition-colors"
          placeholder={mode === "signup" ? "at least 8 characters" : "••••••••"}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-rust">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-brass w-full rounded-full font-medium py-3 disabled:opacity-60"
      >
        {loading ? "Working..." : mode === "signup" ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
