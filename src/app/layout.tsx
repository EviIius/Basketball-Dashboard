import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SportsDash",
  description: "Live scores, predictive models, and analytics for NBA and FIFA World Cup",
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
