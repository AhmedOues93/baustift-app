import { angebotPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createClient } from "@/lib/supabase/server";

/**
 * Angebots-PDF ausliefern.
 *
 * Das PDF wird bei jedem Aufruf frisch gerendert und NICHT gespeichert.
 * Grund: ein abgelegtes PDF ist ab der ersten Änderung am Angebot falsch, und
 * niemand merkt es — man lädt schliesslich weiter die alte Datei herunter.
 * Frisch rendern dauert wenige hundert Millisekunden und ist immer korrekt.
 */
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const ergebnis = await angebotPdfErzeugen(createClient(), params.id);

  if (ergebnis.fehler !== undefined) {
    const status = ergebnis.fehler === "Nicht angemeldet." ? 401 : 404;
    return new Response(ergebnis.fehler, { status });
  }

  return new Response(new Uint8Array(ergebnis.puffer), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: im Browser anschauen, von dort aus teilen oder speichern.
      // Auf dem Handy ist das der kürzere Weg als ein erzwungener Download.
      "Content-Disposition": `inline; filename="${ergebnis.dateiname}"`,
      // Enthält Kundendaten — darf nirgends zwischengespeichert werden.
      "Cache-Control": "private, no-store",
    },
  });
}
