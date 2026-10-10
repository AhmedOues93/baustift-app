import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lebenszeichen für den Hoster.
 *
 * Render fragt diesen Pfad regelmässig ab und nimmt die Instanz aus dem
 * Verkehr, wenn sie nicht antwortet. Ohne eigenen Endpunkt würde Render die
 * Startseite prüfen — die rendert die ganze Landingpage und sagt trotzdem
 * nichts darüber aus, ob die Datenbank erreichbar ist.
 *
 * Bewusst OHNE Datenbankabfrage: ein kurzer Ausfall bei Supabase würde sonst
 * dazu führen, dass Render die gesunde Anwendung neu startet und damit alles
 * abschaltet, statt nur die eine Funktion. Ob die Datenbank antwortet, gehört
 * in die Überwachung, nicht in die Lebensprüfung.
 *
 * Und bewusst ohne Angaben über den Betrieb: kein Versionsstand, keine
 * Umgebung, keine Variablennamen. Der Pfad ist öffentlich.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    },
  );
}
