import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/**
 * Was Suchmaschinen lesen dürfen.
 *
 * Die Startseite und die Rechtstexte: ja. Alles hinter der Anmeldung: nein —
 * dort stehen Kundendaten, und auch wenn ohne Session nichts auszuliefern
 * ist, gehören die Adressen nicht in einen Index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/rechtliches/"],
      disallow: [
        "/api/", "/angebote", "/rechnungen", "/kunden", "/preisliste",
        "/aufmass", "/auftraege", "/einstellungen", "/abo", "/pilot",
        "/willkommen", "/auth/",
      ],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
