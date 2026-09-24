import { csvAntwort, csvDatei, type CsvWert } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";
import { EINHEIT_LABEL, type Einheit } from "@/types/database";

/**
 * CSV-Export einzelner Listen.
 *
 * Zwei Zwecke in einem: der Handwerker kommt an seine Daten (Excel,
 * Steuerberater, andere Software), und er kann sie mitnehmen, wenn er geht.
 * Ein Produkt, das die eigenen Daten festhält, verkauft sich einmal.
 *
 * Es gibt bewusst keinen Parameter für fremde Konten: gelesen wird, was RLS
 * für den angemeldeten Nutzer freigibt, mehr nicht.
 */
export const runtime = "nodejs";

const ERLAUBT = ["kunden", "preisliste", "angebote", "rechnungen"] as const;
type Was = (typeof ERLAUBT)[number];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ was: string }> },
) {
  const { was } = await params;
  if (!ERLAUBT.includes(was as Was)) {
    return new Response("Unbekannter Export.", { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const heute = new Date().toISOString().slice(0, 10);
  const einheit = (e: Einheit) => EINHEIT_LABEL[e] ?? e;

  if (was === "kunden") {
    const { data } = await supabase.from("kunden").select("*").order("name");
    return csvAntwort(
      `kunden-${heute}.csv`,
      csvDatei(
        ["Name", "Ansprechpartner", "Strasse", "PLZ", "Ort", "E-Mail", "Telefon", "Notizen"],
        (data ?? []).map((k): CsvWert[] => [
          k.name, k.ansprechpartner, k.strasse, k.plz, k.ort, k.email, k.telefon, k.notizen,
        ]),
      ),
    );
  }

  if (was === "preisliste") {
    const { data } = await supabase.from("preisliste").select("*").order("bezeichnung");
    return csvAntwort(
      `preisliste-${heute}.csv`,
      csvDatei(
        // Dieselben Spaltennamen, die der Import erwartet — die Datei lässt
        // sich also bearbeiten und wieder einlesen.
        ["Bezeichnung", "Kategorie", "Einheit", "Preis", "Beschreibung", "Stichworte", "Aktiv"],
        (data ?? []).map((p): CsvWert[] => [
          p.bezeichnung, p.kategorie, einheit(p.einheit), p.einzelpreis,
          p.beschreibung, (p.stichworte ?? []).join(", "), p.aktiv,
        ]),
      ),
    );
  }

  if (was === "angebote") {
    const [{ data: angebote }, { data: kunden }] = await Promise.all([
      supabase.from("angebote").select("*").order("created_at", { ascending: false }),
      supabase.from("kunden").select("id, name"),
    ]);
    const name = new Map((kunden ?? []).map((k) => [k.id, k.name]));

    return csvAntwort(
      `angebote-${heute}.csv`,
      csvDatei(
        ["Nummer", "Datum", "Kunde", "Titel", "Status", "Netto", "MwSt", "Brutto", "Gesendet am", "Entschieden am"],
        (angebote ?? []).map((a): CsvWert[] => [
          a.nummer, a.datum, a.kunde_id ? name.get(a.kunde_id) : null, a.titel,
          a.status, a.netto, a.mwst_betrag, a.brutto,
          a.gesendet_am?.slice(0, 10), a.entschieden_am?.slice(0, 10),
        ]),
      ),
    );
  }

  const [{ data: rechnungen }, { data: kunden }] = await Promise.all([
    supabase.from("rechnungen").select("*").order("created_at", { ascending: false }),
    supabase.from("kunden").select("id, name"),
  ]);
  const name = new Map((kunden ?? []).map((k) => [k.id, k.name]));

  return csvAntwort(
    `rechnungen-${heute}.csv`,
    csvDatei(
      ["Nummer", "Datum", "Kunde", "Titel", "Status", "Netto", "MwSt", "Brutto", "Fällig am", "Bezahlt am"],
      (rechnungen ?? []).map((r): CsvWert[] => [
        r.nummer, r.datum, r.kunde_id ? name.get(r.kunde_id) : null, r.titel,
        r.status, r.netto, r.mwst_betrag, r.brutto,
        r.faellig_am, r.bezahlt_am?.slice(0, 10),
      ]),
    ),
  );
}
