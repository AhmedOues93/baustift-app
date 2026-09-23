import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Seiten, die ohne Login erreichbar sind. */
const OEFFENTLICH = [
  "/",
  "/login",
  "/signup",
  "/auth",
  // Impressum und Datenschutz müssen ohne Anmeldung erreichbar sein —
  // hinter einem Login erfüllen sie ihren Zweck nicht.
  "/rechtliches",
  // Der Stripe-Webhook kommt von Stripe und hat naturgemäss keine Session.
  // Er weist sich stattdessen mit einer Signatur aus (siehe dort). Ohne
  // diese Ausnahme leitet die Middleware ihn auf /login um und jede
  // Abo-Buchung läuft ins Leere, ohne dass irgendwo ein Fehler auftaucht.
  "/api/stripe/webhook",
];

/**
 * Hält die Supabase-Session frisch und schützt die App-Routen.
 *
 * Ablauf bei jedem Request:
 *  1. Supabase-Client mit Request-Cookies bauen
 *  2. `getUser()` -> erneuert abgelaufene Access-Tokens
 *  3. erneuerte Cookies an die Response hängen
 *  4. ohne Session: Redirect auf /login
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nicht durch getSession() ersetzen: nur getUser() validiert das Token
  // gegen den Auth-Server. getSession() vertraut dem Cookie blind.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pfad = request.nextUrl.pathname;
  const istOeffentlich = OEFFENTLICH.some(
    (p) => pfad === p || pfad.startsWith(`${p}/`),
  );

  if (!user && !istOeffentlich) {
    // Schnittstellen bekommen eine Antwort, die ein Programm verstehen kann.
    // Eine Weiterleitung auf /login würde dort als HTML-Seite mit Status 200
    // ankommen und die aufrufende Stelle in die Irre führen.
    if (pfad.startsWith("/api/")) {
      return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Nach dem Login zurück zur ursprünglich gewünschten Seite.
    url.searchParams.set("weiter", pfad);
    return NextResponse.redirect(url);
  }

  return response;
}
