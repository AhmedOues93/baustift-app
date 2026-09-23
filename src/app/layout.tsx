import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

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
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className="min-h-screen antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
