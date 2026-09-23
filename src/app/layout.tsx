import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

/**
 * Schriften über next/font: werden zur Bauzeit heruntergeladen und selbst
 * ausgeliefert. Kein Request zu Google zur Laufzeit (schneller und ohne
 * DSGVO-Diskussion), und kein Textsprung beim Laden dank `display: swap`.
 *
 * Die Variablen landen unten auf <html> und werden in globals.css und
 * tailwind.config.ts benutzt.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--schrift-titel",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--schrift-text",
  display: "swap",
});

/** Nur für Zahlen: Preise, Summen, Mengen, Angebotsnummern. */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--schrift-zahl",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Baustift — Angebote in Sekunden",
  description:
    "Sprich deine Leistung ein, Baustift erstellt das professionelle Angebot als PDF.",
  manifest: "/manifest.webmanifest",
  // Sagt iOS, dass die App im Vollbild ohne Safari-Leisten startet, wenn sie
  // vom Startbildschirm aus geöffnet wird.
  appleWebApp: {
    capable: true,
    title: "Baustift",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  // maximumScale bewusst NICHT gesetzt: Zoom zu verbieten wäre auf einer
  // Baustelle das Gegenteil von hilfreich (und verletzt WCAG).
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover: Inhalt darf bis in die Display-Ecken; die Abstände
  // holen wir uns gezielt über env(safe-area-inset-*).
  viewportFit: "cover",
  // Färbt die Statusleiste auf Android in der installierten App.
  themeColor: "#1b1a17",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="de"
      className={`${archivo.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body className="min-h-screen antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
