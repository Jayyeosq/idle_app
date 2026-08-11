import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IDLE — what to do right now",
  description: "Recommendations tuned to your taste, wherever you are.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-ink text-paper min-h-screen antialiased">{children}</body>
    </html>
  );
}
