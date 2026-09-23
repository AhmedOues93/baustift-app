import { renderToBuffer } from "@react-pdf/renderer";

import { AngebotPdf } from "@/lib/pdf/angebot-pdf";
import { createClient } from "@/lib/supabase/server";
import type { Angebot, Kunde, Position, Profile } from "@/types/database";

/**
 * Angebots-PDF ausliefern.
 *
 * Das PDF wird bei jedem Aufruf frisch gerendert und NICHT gespeichert.
 * Grund: ein abgelegtes PDF ist ab der ersten Änderung am Angebot falsch, und
 * niemand merkt es — man lädt schliesslich weiter die alte Datei herunter.
 * Frisch rendern dauert wenige hundert Millisekunden und ist immer korrekt.
 * (Beim späteren Versand per E-Mail wird die Datei bewusst einmal eingefroren
 *  und archiviert — dann ist genau das ja der Zweck.)
 */

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response("Nicht angemeldet.", { status: 401 });
  }

  // RLS sorgt dafür, dass hier nur eigene Angebote ankommen.
  const { data: angebot } = await supabase
    .from("angebote")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  if (!angebot) {
    return new Response("Angebot nicht gefunden.", { status: 404 });
  }

  const [{ data: positionen }, { data: firma }, kundeErgebnis] = await Promise.all([
    supabase.from("positionen").select("*").eq("angebot_id", angebot.id).order("pos_nr"),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    angebot.kunde_id
      ? supabase.from("kunden").select("*").eq("id", angebot.kunde_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!firma) {
    return new Response("Firmendaten fehlen.", { status: 400 });
  }

  // Logo als Data-URL einbetten: eine signierte URL würde im PDF nach einer
  // Stunde ins Leere laufen, und ein gedrucktes Dokument darf nicht vom Netz
  // abhängen.
  let logoDataUrl: string | null = null;
  if (firma.logo_url) {
    const { data } = await supabase.storage.from("logos").download(firma.logo_url);
    if (data) {
      const puffer = Buffer.from(await data.arrayBuffer());
      logoDataUrl = `data:${data.type};base64,${puffer.toString("base64")}`;
    }
  }

  const pdf = await renderToBuffer(
    AngebotPdf({
      angebot: angebot as Angebot,
      positionen: (positionen ?? []) as Position[],
      kunde: (kundeErgebnis.data ?? null) as Kunde | null,
      firma: firma as Profile,
      logoDataUrl,
    }),
  );

  const dateiname = `Angebot-${angebot.nummer}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      // inline: im Browser anschauen, von dort aus teilen oder speichern.
      // Auf dem Handy ist das der kürzere Weg als ein erzwungener Download.
      "Content-Disposition": `inline; filename="${dateiname}"`,
      // Enthält Kundendaten — darf nirgends zwischengespeichert werden.
      "Cache-Control": "private, no-store",
    },
  });
}
