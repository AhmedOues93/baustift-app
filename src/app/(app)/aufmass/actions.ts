"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { matchePosition } from "@/lib/ai/matching";
import { gruppenName, gruppiere } from "@/lib/aufmass/gruppen";
import { createClient } from "@/lib/supabase/server";
import type {
  AufmassPosition,
  Einheit,
  MessungArt,
  PreislisteEintrag,
} from "@/types/database";

/**
 * Aufmass-Session.
 *
 * Die Session ist langlebig: sie bleibt offen, während der Handwerker misst,
 * telefoniert, das Telefon einsteckt und weitermisst. Deshalb liegt hier auch
 * nichts im Speicher des Bildschirms — jede Änderung geht sofort in die
 * Datenbank. Ein Aufmass, das beim Sperren des Bildschirms verschwindet, ist
 * schlimmer als gar keins: er hat ihm vertraut.
 */

export async function aufmassAnlegen(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const kundeId = String(formData.get("kunde_id") ?? "") || null;
  const titel = String(formData.get("titel") ?? "").trim();

  const { data: neu } = await supabase
    .from("aufmass")
    .insert({
      user_id: user.id,
      kunde_id: kundeId,
      titel,
      status: "offen",
      notiz: null,
      angebot_id: null,
      abgeschlossen_am: null,
    })
    .select("id")
    .single();

  revalidatePath("/aufmass");
  if (neu) redirect(`/aufmass/${neu.id}`);
}

export async function aufmassKopfSpeichern(args: {
  aufmassId: string;
  titel: string;
  kundeId: string | null;
  notiz: string | null;
}): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("aufmass")
    .update({
      titel: args.titel.trim(),
      kunde_id: args.kundeId,
      notiz: args.notiz?.trim() || null,
    })
    .eq("id", args.aufmassId)
    .eq("user_id", user.id);

  if (error) return { fehler: "Konnte nicht gespeichert werden." };
  revalidatePath(`/aufmass/${args.aufmassId}`);
  return {};
}

/**
 * Eine Messung ändern.
 *
 * Genau dafür ist der Bildschirm da: die KI hat "2,50" verstanden, es waren
 * aber 2,05. Gespeichert wird einzeln und sofort, nicht gesammelt — wer auf
 * der Baustelle eine Zahl korrigiert, wird dabei unterbrochen.
 */
export async function messungSpeichern(args: {
  messungId: string;
  raum: string | null;
  bezeichnung: string;
  art: MessungArt;
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  anzahl: number;
  abzug: boolean;
}): Promise<{ fehler?: string; wert?: number | null; einheit?: Einheit }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // `wert` und `einheit` werden nicht geschrieben: die Datenbank rechnet sie.
  // Zurückgelesen werden sie trotzdem, damit der Bildschirm denselben Wert
  // zeigt wie das spätere Angebot.
  const { data, error } = await supabase
    .from("aufmass_positionen")
    .update({
      raum: args.raum?.trim() || null,
      bezeichnung: args.bezeichnung.trim(),
      art: args.art,
      laenge: args.laenge,
      breite: args.breite,
      hoehe: args.hoehe,
      anzahl: Number.isFinite(args.anzahl) && args.anzahl > 0 ? args.anzahl : 1,
      abzug: args.abzug,
      // Von Hand angefasst heisst geprüft.
      zu_pruefen: false,
    })
    .eq("id", args.messungId)
    .select("wert, einheit")
    .maybeSingle();

  if (error) {
    return {
      fehler: error.message.includes("abgeschlossen")
        ? "Das Aufmass ist abgeschlossen. Zum Ändern zuerst wieder öffnen."
        : "Konnte nicht gespeichert werden.",
    };
  }

  return { wert: data?.wert ?? null, einheit: data?.einheit };
}

export async function messungLoeschen(
  messungId: string,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // RLS begrenzt auf eigene Zeilen; der Trigger verhindert das Löschen in
  // einem abgeschlossenen Aufmass.
  const { error } = await supabase
    .from("aufmass_positionen")
    .delete()
    .eq("id", messungId);

  if (error) return { fehler: "Konnte nicht gelöscht werden." };
  return {};
}

/** Eine leere Zeile zum Eintippen — für den Fall ohne Stimme. */
export async function messungAnlegen(
  aufmassId: string,
): Promise<{ fehler?: string; messung?: AufmassPosition }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: letzte } = await supabase
    .from("aufmass_positionen")
    .select("pos_nr")
    .eq("aufmass_id", aufmassId)
    .order("pos_nr", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("aufmass_positionen")
    .insert({
      aufmass_id: aufmassId,
      pos_nr: (letzte?.pos_nr ?? 0) + 1,
      raum: null,
      bezeichnung: "",
      art: "flaeche",
      laenge: null,
      breite: null,
      hoehe: null,
      anzahl: 1,
      abzug: false,
      gesprochen: null,
      zu_pruefen: false,
    })
    .select("*")
    .single();

  if (error || !data) return { fehler: "Konnte nicht angelegt werden." };
  return { messung: data as AufmassPosition };
}

/** Abschliessen — ab hier ist das Aufmass gesperrt. */
export async function aufmassAbschliessen(
  aufmassId: string,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { count } = await supabase
    .from("aufmass_positionen")
    .select("id", { count: "exact", head: true })
    .eq("aufmass_id", aufmassId);

  if ((count ?? 0) === 0) {
    return { fehler: "Da ist noch nichts gemessen." };
  }

  const { error } = await supabase
    .from("aufmass")
    .update({ status: "abgeschlossen", abgeschlossen_am: new Date().toISOString() })
    .eq("id", aufmassId)
    .eq("user_id", user.id);

  if (error) return { fehler: "Konnte nicht abgeschlossen werden." };

  revalidatePath(`/aufmass/${aufmassId}`);
  revalidatePath("/aufmass");
  return {};
}

export async function aufmassOeffnen(
  aufmassId: string,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("aufmass")
    .update({ status: "offen", abgeschlossen_am: null })
    .eq("id", aufmassId)
    .eq("user_id", user.id);

  if (error) return { fehler: "Konnte nicht geöffnet werden." };

  revalidatePath(`/aufmass/${aufmassId}`);
  return {};
}

export async function aufmassLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Die Messungen hängen per ON DELETE CASCADE dran.
  await supabase.from("aufmass").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/aufmass");
  redirect("/aufmass");
}

/**
 * Aus dem Aufmass ein Angebot machen.
 *
 * Der Schritt, für den das Ganze gebaut ist. Jede Gruppe (Raum × Einheit)
 * wird eine Position; welche Leistung dazugehört, hat der Handwerker vorher
 * ausgewählt — das Aufmass weiss nicht, ob 42 m² Wand Fliesen oder Farbe
 * sind, und es zu raten wäre die Sorte Bequemlichkeit, die ein falsches
 * Angebot erzeugt.
 *
 * Der Preis kommt aus der Preisliste, nie von woanders: dieselbe Regel wie
 * beim diktierten Angebot. Wählt er keine Leistung, entsteht die Zeile
 * trotzdem — mit der Menge, ohne Preis und als "zu prüfen" markiert. So
 * stehen die Masse schon im Angebot und er setzt den Preis dort in zwei
 * Sekunden.
 *
 * Das Aufmass wird dabei abgeschlossen und mit dem Angebot verknüpft. Sonst
 * ändert jemand später ein Mass, und das verschickte Angebot beruft sich auf
 * Zahlen, die es nicht mehr gibt.
 */
export async function angebotAusAufmass(
  aufmassId: string,
  /** Je Gruppe die gewählte Leistung — leer heisst "ohne Preis". */
  zuordnung: Record<string, string | null>,
): Promise<{ fehler?: string; angebotId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const [{ data: aufmass }, { data: messungen }, { data: preisliste }] =
    await Promise.all([
      supabase
        .from("aufmass")
        .select("*")
        .eq("id", aufmassId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("aufmass_positionen")
        .select("*")
        .eq("aufmass_id", aufmassId)
        .order("pos_nr"),
      supabase.from("preisliste").select("*").eq("aktiv", true),
    ]);

  if (!aufmass) return { fehler: "Aufmass nicht gefunden." };
  if (aufmass.angebot_id) {
    return { fehler: "Aus diesem Aufmass wurde schon ein Angebot erstellt." };
  }

  const gruppen = gruppiere((messungen ?? []) as AufmassPosition[]);
  if (gruppen.length === 0) {
    return { fehler: "Da ist noch nichts zu rechnen." };
  }

  const katalog = (preisliste ?? []) as PreislisteEintrag[];

  const { data: nummer, error: nummerFehler } = await supabase.rpc(
    "next_angebot_nummer",
    { p_user_id: user.id },
  );
  if (nummerFehler || !nummer) {
    return { fehler: "Das Angebot konnte nicht angelegt werden." };
  }

  const { data: firma } = await supabase
    .from("profiles")
    .select("mwst_satz, kleinunternehmer, angebot_gueltig_tage")
    .eq("id", user.id)
    .maybeSingle();

  const gueltigBis = new Date();
  gueltigBis.setDate(gueltigBis.getDate() + (firma?.angebot_gueltig_tage ?? 30));

  const { data: angebot, error: angebotFehler } = await supabase
    .from("angebote")
    .insert({
      user_id: user.id,
      kunde_id: aufmass.kunde_id,
      nummer,
      titel: aufmass.titel || "Angebot nach Aufmass",
      status: "entwurf",
      datum: new Date().toISOString().slice(0, 10),
      gueltig_bis: gueltigBis.toISOString().slice(0, 10),
      transkript: null,
      ki_hinweis: null,
      mwst_satz: firma?.kleinunternehmer ? 0 : (firma?.mwst_satz ?? 19),
      netto: 0,
      mwst_betrag: 0,
      brutto: 0,
      notiz: aufmass.notiz,
      audio_path: null,
      pdf_path: null,
      gesendet_am: null,
      entschieden_am: null,
      // Ein Angebot aus dem Aufmass ist weder diktiert noch getippt.
      eingabe_art: "aufmass",
      aufnahme_sekunden: null,
    })
    .select("id")
    .single();

  if (angebotFehler || !angebot) {
    return { fehler: "Das Angebot konnte nicht angelegt werden." };
  }

  const positionen = gruppen.map((g, i) => {
    const gewaehlt = zuordnung[g.id]
      ? katalog.find((e) => e.id === zuordnung[g.id])
      : undefined;

    // matchePosition setzt den Preis aus dem Katalog und markiert alles, was
    // keinen Treffer hat, als zu prüfen. Dieselbe Funktion wie beim
    // diktierten Angebot — zwei Wege zum Preis wären einer zu viel.
    const gematcht = matchePosition(
      {
        bezeichnung: gewaehlt?.bezeichnung ?? gruppenName(g),
        beschreibung: g.einzelheiten,
        menge: g.menge,
        einheit: g.einheit,
        preisliste_id: gewaehlt?.id ?? null,
      },
      katalog,
    );

    return {
      angebot_id: angebot.id,
      pos_nr: i + 1,
      bezeichnung: gematcht.bezeichnung,
      beschreibung: gematcht.beschreibung,
      menge: gematcht.menge,
      einheit: gematcht.einheit,
      einzelpreis: gematcht.einzelpreis,
      preisliste_id: gematcht.preisliste_id,
      // Auch ein gefundener Preis bleibt zu prüfen, wenn das zugrunde
      // liegende Mass noch unsicher war.
      zu_pruefen: gematcht.zu_pruefen || g.zuPruefen,
      ki_konfidenz: null,
    };
  });

  const { error: posFehler } = await supabase.from("positionen").insert(positionen);
  if (posFehler) {
    // Ein halbes Angebot ist schlimmer als keins.
    await supabase.from("angebote").delete().eq("id", angebot.id);
    return { fehler: "Das Angebot konnte nicht angelegt werden." };
  }

  await supabase
    .from("aufmass")
    .update({
      angebot_id: angebot.id,
      status: "abgeschlossen",
      abgeschlossen_am: new Date().toISOString(),
    })
    .eq("id", aufmassId)
    .eq("user_id", user.id);

  revalidatePath("/aufmass");
  revalidatePath("/angebote");
  return { angebotId: angebot.id };
}
