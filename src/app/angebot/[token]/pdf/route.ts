import { angebotPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Das Angebots-PDF für den Kunden — ohne Konto, ohne Anmeldung.
 *
 * Die Berechtigungsfrage beantwortet die Datenbank: `angebot_id_per_token`
 * gibt nur dann eine Kennung zurück, wenn der Schlüssel stimmt und das
 * Angebot kein Entwurf mehr ist. Erst danach wird geladen, und zwar genau
 * dieses eine Angebot. Der Admin-Client steht hier also nicht frei herum —
 * er bekommt eine Kennung, die schon geprüft ist.
 *
 * Es ist dasselbe PDF wie für den Betrieb. Zwei Vorlagen wären zwei
 * Gelegenheiten, dass der Kunde ein anderes Dokument sieht.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params;

    const supabase = await createClient();
    const { data: treffer } = await supabase.rpc("angebot_id_per_token", {
      p_token: token,
    });
    const eintrag = treffer?.[0];
    if (!eintrag) return new Response("Nicht gefunden.", { status: 404 });

    const ergebnis = await angebotPdfErzeugen(
      createAdminClient(),
      eintrag.angebot_id,
      eintrag.besitzer,
    );
    if (ergebnis.fehler !== undefined) {
      return new Response("Nicht gefunden.", { status: 404 });
    }

    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(ergebnis.puffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${ergebnis.dateiname}"`,
        // Ein Angebot mit Preisen gehört in keinen gemeinsamen Zwischenspeicher.
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error("angebot.freigabe.pdf", error);
    return new Response("PDF konnte nicht erstellt werden.", { status: 500 });
  }
}
