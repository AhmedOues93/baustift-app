import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baustift — Angebote in Sekunden",
  description:
    "Sprich deine Leistung ein, Baustift erstellt das professionelle Angebot als PDF.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // lang="de" : el app kollha bel almani (les clients houma Handwerker f Allemagne)
    <html lang="de">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
