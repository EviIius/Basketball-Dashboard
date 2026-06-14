import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NBA Dashboard",
  description: "Live scores and historical team stats",
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
