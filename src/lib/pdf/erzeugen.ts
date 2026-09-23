import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import { AngebotPdf } from "@/lib/pdf/angebot-pdf";
import type { createClient } from "@/lib/supabase/server";
import type { Angebot, Kunde, Position, Profile } from "@/types/database";

/**
 * Lädt alles, was ins Angebots-PDF gehört, und rendert es.
 *
 * Eine Stelle für beide Wege — Download und E-Mail-Anhang. Sonst driften die
 * zwei auseinander und der Kunde bekommt per Mail ein anderes Dokument, als
 * der Handwerker beim Herunterladen sieht.
 */
export async function angebotPdfErzeugen(
  supabase: ReturnType<typeof createClient>,
  angebotId: string,
): Promise<
  | { fehler: string; puffer?: undefined }
  | { fehler?: undefined; puffer: Buffer; dateiname: string; angebot: Angebot; kunde: Kunde | null; firma: Profile }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Nicht angemeldet." };

  // RLS sorgt dafür, dass hier nur eigene Angebote ankommen.
  const { data: angebot } = await supabase
    .from("angebote")
    .select("*")
    .eq("id", angebotId)
    .maybeSingle();

  if (!angebot) return { fehler: "Angebot nicht gefunden." };

  const [{ data: positionen }, { data: firma }, kundeErgebnis] = await Promise.all([
    supabase.from("positionen").select("*").eq("angebot_id", angebot.id).order("pos_nr"),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    angebot.kunde_id
      ? supabase.from("kunden").select("*").eq("id", angebot.kunde_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!firma) return { fehler: "Firmendaten fehlen." };

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

  const puffer = await renderToBuffer(
    AngebotPdf({
      angebot: angebot as Angebot,
      positionen: (positionen ?? []) as Position[],
      kunde: (kundeErgebnis.data ?? null) as Kunde | null,
      firma: firma as Profile,
      logoDataUrl,
    }),
  );

  return {
    puffer,
    dateiname: `Angebot-${angebot.nummer}.pdf`,
    angebot: angebot as Angebot,
    kunde: (kundeErgebnis.data ?? null) as Kunde | null,
    firma: firma as Profile,
  };
}
