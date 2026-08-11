"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OnboardingData } from "@/lib/types";

export default function ProfileMenu({
  email,
  preferences,
}: {
  email: string;
  preferences: OnboardingData | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initial = email.charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Account menu"
        className="w-10 h-10 rounded-full bg-ink text-paper flex items-center justify-center text-sm font-medium"
      >
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 top-12 w-72 panel-plate rounded-2xl p-4 z-10 text-left">
          <p className="text-sm text-ink-soft mb-3 break-all">{email}</p>

          <div className="border-t border-ink/10 pt-3 mb-3">
            <p className="text-xs uppercase tracking-[0.08em] text-mist mb-2">Your preferences</p>
            {preferences ? (
              <ul className="text-sm text-ink-soft space-y-1.5">
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
          </div>

          <Link
            href="/onboarding"
            className="block text-sm text-sage hover:text-ink underline underline-offset-4 mb-3"
          >
            Edit preferences
          </Link>

          <button
            type="button"
            onClick={logout}
            className="text-sm text-mist hover:text-rust underline underline-offset-4"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
