import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Basketball Decision Desk",
  description: "NBA predictions, live win calls, matchup simulation, and validated stats",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-court-bg">
        {children}
      </body>
    </html>
  );
}
