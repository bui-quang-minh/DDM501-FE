import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DDM501 — Tender Personnel Recommender",
  description: "AI-powered personnel recommendation from tender dossiers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
