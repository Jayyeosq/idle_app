import type { Metadata } from "next";
import { DM_Sans, DM_Serif_Display } from "next/font/google";
import "./globals.css";

// Feeds --font-dm-sans / --font-dm-serif, mapped in tailwind.config.ts to
// font-body / font-display. font-mono is also pointed at DM Sans (see
// tailwind.config.ts) — this concept uses one sans family throughout,
// including uppercase tracked meta text, rather than a dedicated mono face.
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["400", "500", "600"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  subsets: ["latin"],
  variable: "--font-dm-serif",
  weight: ["400"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "IDLE — what to do right now",
  description: "Recommendations tuned to your taste, wherever you are.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable}`}>
      <body className="font-body bg-paper text-ink min-h-screen antialiased">{children}</body>
    </html>
  );
}
