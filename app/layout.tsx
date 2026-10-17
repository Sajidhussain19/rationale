import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Rationale - Decision memory for teams",
  description: "Never lose the why. Gemini turns meetings into a living decision ledger and flags contradictions.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
