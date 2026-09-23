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
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|offline.html|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
