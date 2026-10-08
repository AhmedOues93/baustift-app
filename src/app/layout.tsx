import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";

import { publicEnv } from "@/lib/env";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

/**
 * Schriften aus dem eigenen Paket, nicht von Google.
 *
 * Vorher lief das über `next/font/google`. Das lädt die Dateien zur Bauzeit
 * von fonts.gstatic.com herunter — und genau daran ist der Build in dieser
 * Sitzung zweimal gescheitert, ohne dass sich am Code etwas geändert hätte.
 * Beim Hoster wäre das ein abgebrochener Deploy aus einem Grund, der nichts
 * mit der Anwendung zu tun hat.
 *
 * Jetzt kommen die Dateien aus den @fontsource-Paketen. Die stehen in
 * package-lock.json mit Prüfsumme: derselbe Build ergibt dieselben
 * Schriften, und beim Bauen geht keine Anfrage mehr nach draussen.
 *
 * Ausgeliefert wurden sie schon vorher selbst — zur Laufzeit fragt also
 * nach wie vor niemand bei Google an, was die Datenschutzerklärung so
 * beschreibt. `display: swap` verhindert den Textsprung beim Laden.
 */
const archivo = localFont({
  src: [
    { path: "../../node_modules/@fontsource/archivo/files/archivo-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/archivo/files/archivo-latin-800-normal.woff2", weight: "800", style: "normal" },
  ],
  variable: "--schrift-titel",
  display: "swap",
});

const plexSans = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--schrift-text",
  display: "swap",
});

/** Nur für Zahlen: Preise, Summen, Mengen, Angebotsnummern. */
const plexMono = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--schrift-zahl",
  display: "swap",
});

export const metadata: Metadata = {
  // Ohne metadataBase bleiben die Bild-Adressen im Teilen-Vorschaubild
  // relativ — und WhatsApp, LinkedIn und die Suchmaschinen finden sie nicht.
  metadataBase: new URL(publicEnv.siteUrl),
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
