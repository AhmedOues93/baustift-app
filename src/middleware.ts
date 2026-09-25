import type { NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Alles ausser statischen Dateien.
     *
     * manifest.webmanifest, sw.js und offline.html MÜSSEN hier ausgenommen
     * sein: sonst leitet die Middleware sie ohne Session auf /login um, der
     * Browser bekommt HTML statt Manifest bzw. Service Worker — und die App
     * lässt sich nicht mehr installieren.
     *
     * PDF gehört aus demselben Grund dazu: das Muster-Angebot auf der
     * Startseite ist für Leute gedacht, die noch kein Konto haben. Ohne die
     * Ausnahme landen sie beim Klick darauf auf der Anmeldung — ausgerechnet
     * an der Stelle, an der sie sich das Produkt erst ansehen wollen.
     *
     * robots.txt und sitemap.xml ebenso: eine Suchmaschine, die statt der
     * Datei eine Weiterleitung auf /login bekommt, nimmt die Seite nicht
     * richtig auf. Das fällt niemandem auf — man sieht nur, dass niemand
     * kommt.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|sw.js|offline.html|icons/|bilder/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)",
  ],
};
