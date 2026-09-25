import { createClient } from "@/lib/supabase/server";

/**
 * Vollständiger Datenexport — Art. 20 DSGVO (Datenübertragbarkeit).
 *
 * Eine Datei mit allem, was zum Konto gehört, in einem maschinenlesbaren
 * Format. Die CSV-Exporte daneben sind für den Alltag gedacht; diese Datei
 * ist die rechtliche Auskunft und deshalb vollständig, nicht schön.
 *
 * Gelesen wird ausschliesslich über den normalen Client — was RLS nicht
 * freigibt, kommt auch hier nicht heraus.
 */
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  // Jede Tabelle mit Nutzerdaten gehört hier hinein. Kommt eine neue dazu und
  // wird hier vergessen, ist der Export unvollständig — und Art. 20 DSGVO
  // verlangt vollständig, nicht ungefähr.
  const [
    profil, kunden, preisliste, angebote, positionen, rechnungen,
    rechnungPositionen, zahlungen, aufmasse, messungen, auftraege, dokumentation,
    nutzung, rueckmeldungen,
  ] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("kunden").select("*"),
      supabase.from("preisliste").select("*"),
      supabase.from("angebote").select("*"),
      supabase.from("positionen").select("*"),
      supabase.from("rechnungen").select("*"),
      supabase.from("rechnung_positionen").select("*"),
      supabase.from("rechnung_zahlungen").select("*"),
      supabase.from("aufmass").select("*"),
      supabase.from("aufmass_positionen").select("*"),
      supabase.from("auftraege").select("*"),
      supabase.from("auftrag_dokumentation").select("*"),
      supabase.from("ki_nutzung").select("*"),
      supabase.from("feedback").select("*"),
    ]);

  const daten = {
    hinweis:
      "Vollständiger Export deiner bei Baustift gespeicherten Daten (Art. 20 DSGVO).",
    erstellt_am: new Date().toISOString(),
    konto: { id: user.id, email: user.email, angelegt_am: user.created_at },
    firmendaten: profil.data,
    kunden: kunden.data ?? [],
    preisliste: preisliste.data ?? [],
    angebote: angebote.data ?? [],
    angebotspositionen: positionen.data ?? [],
    rechnungen: rechnungen.data ?? [],
    rechnungspositionen: rechnungPositionen.data ?? [],
    zahlungen: zahlungen.data ?? [],
    aufmasse: aufmasse.data ?? [],
    messungen: messungen.data ?? [],
    auftraege: auftraege.data ?? [],
    baustellendokumentation: dokumentation.data ?? [],
    ki_nutzung: nutzung.data ?? [],
    rueckmeldungen: rueckmeldungen.data ?? [],
  };

  const dateiname = `baustift-export-${new Date().toISOString().slice(0, 10)}.json`;

  return new Response(JSON.stringify(daten, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
