import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * OAuth- und E-Mail-Bestätigungs-Rücksprung.
 *
 * Supabase schickt den Nutzer nach Google-Login oder nach Klick auf den
 * Bestätigungslink hierher — mit einem einmaligen `code` in der URL. Den
 * tauschen wir gegen eine echte Session (landet als Cookie).
 *
 * Diese Route muss in Supabase unter Authentication → URL Configuration als
 * Redirect-URL eingetragen sein, sonst verweigert Supabase den Rücksprung.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const weiter = searchParams.get("weiter") ?? "/angebote";
  const fehler = searchParams.get("error_description");

  if (fehler) {
    return NextResponse.redirect(
      `${origin}/login?fehler=${encodeURIComponent(fehler)}`,
    );
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Nur interne Pfade — sonst könnte man über ?weiter=https://… umleiten.
      return NextResponse.redirect(
        `${origin}${weiter.startsWith("/") ? weiter : "/angebote"}`,
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/login?fehler=${encodeURIComponent("Anmeldung fehlgeschlagen.")}`,
  );
}
