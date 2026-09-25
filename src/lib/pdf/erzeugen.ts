import "server-only";

import { renderToStream } from "@react-pdf/renderer";

import { AngebotPdf } from "@/lib/pdf/angebot-pdf";
import { RechnungPdf } from "@/lib/pdf/rechnung-pdf";
import type { createClient } from "@/lib/supabase/server";
import type {
  Angebot,
  Kunde,
  Position,
  Profile,
  Rechnung,
  RechnungPosition,
} from "@/types/database";

/**
 * Logo als Data-URL. Eine signierte URL würde im PDF nach einer Stunde ins
 * Leere laufen, und ein gedrucktes Dokument darf nicht vom Netz abhängen.
 */
async function logoLaden(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pfad: string | null,
): Promise<string | null> {
  if (!pfad) return null;
  const { data } = await supabase.storage.from("logos").download(pfad);
  if (!data) return null;
  const puffer = Buffer.from(await data.arrayBuffer());
  return `data:${data.type};base64,${puffer.toString("base64")}`;
}

/**
 * Lädt alles, was ins Angebots-PDF gehört, und rendert es.
 *
 * Eine Stelle für beide Wege — Download und E-Mail-Anhang. Sonst driften die
 * zwei auseinander und der Kunde bekommt per Mail ein anderes Dokument, als
 * der Handwerker beim Herunterladen sieht.
 */
export async function angebotPdfErzeugen(
  supabase: Awaited<ReturnType<typeof createClient>>,
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

  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await logoLaden(supabase, firma.logo_url);
  } catch (error) {
    console.warn("PDF-Logo konnte nicht geladen werden.", error);
  }

  const dokument = AngebotPdf({
    angebot: angebot as Angebot,
    positionen: (positionen ?? []) as Position[],
    kunde: (kundeErgebnis.data ?? null) as Kunde | null,
    firma: firma as Profile,
    logoDataUrl,
  });
  const stream = await renderToStream(dokument);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const puffer = Buffer.concat(chunks);

  return {
    puffer,
    dateiname: `Angebot-${angebot.nummer}.pdf`,
    angebot: angebot as Angebot,
    kunde: (kundeErgebnis.data ?? null) as Kunde | null,
    firma: firma as Profile,
  };
}

/** Dasselbe für eine Rechnung. */
export async function rechnungPdfErzeugen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rechnungId: string,
): Promise<
  | { fehler: string; puffer?: undefined }
  | {
      fehler?: undefined;
      puffer: Buffer;
      dateiname: string;
      rechnung: Rechnung;
      kunde: Kunde | null;
      firma: Profile;
    }
> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Nicht angemeldet." };

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .select("*")
    .eq("id", rechnungId)
    .maybeSingle();

  if (!rechnung) return { fehler: "Rechnung nicht gefunden." };

  const [{ data: positionen }, { data: firma }, kundeErgebnis] = await Promise.all([
    supabase
      .from("rechnung_positionen")
      .select("*")
      .eq("rechnung_id", rechnung.id)
      .order("pos_nr"),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    rechnung.kunde_id
      ? supabase.from("kunden").select("*").eq("id", rechnung.kunde_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!firma) return { fehler: "Firmendaten fehlen." };

  let logoDataUrl: string | null = null;
  try {
    logoDataUrl = await logoLaden(supabase, firma.logo_url);
  } catch (error) {
    console.warn("PDF-Logo konnte nicht geladen werden.", error);
  }

  const dokument = RechnungPdf({
    rechnung: rechnung as Rechnung,
    positionen: (positionen ?? []) as RechnungPosition[],
    kunde: (kundeErgebnis.data ?? null) as Kunde | null,
    firma: firma as Profile,
    logoDataUrl,
  });
  const stream = await renderToStream(dokument);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const puffer = Buffer.concat(chunks);

  return {
    puffer,
    dateiname: `Rechnung-${rechnung.nummer}.pdf`,
    rechnung: rechnung as Rechnung,
    kunde: (kundeErgebnis.data ?? null) as Kunde | null,
    firma: firma as Profile,
  };
}
