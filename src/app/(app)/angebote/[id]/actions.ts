"use server";

import { revalidatePath } from "next/cache";

import { angebotNachricht, emailVerfuegbar, sendeEmail } from "@/lib/email/senden";
import { angebotPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createClient } from "@/lib/supabase/server";
import type { AngebotStatus, Einheit } from "@/types/database";

/**
 * Bearbeiten eines Angebots.
 *
 * Die Positionen werden als Ganzes gespeichert, nicht Feld für Feld. Auf dem
 * Handy tippt man in einer Zeile herum, springt in die nächste und wieder
 * zurück; einzelne Feld-Requests würden sich dabei überholen und
 * widersprüchliche Zustände schreiben. Ein Aufruf mit der vollständigen Liste
 * ist idempotent: er ist entweder ganz durch oder gar nicht.
 *
 * Summen berechnet die Datenbank (Trigger in 0001_init.sql) — deshalb werden
 * sie hier nur zurückgelesen, nie geschrieben.
 */

export interface PositionEingabe {
  /** Vorhandene Zeile hat eine id, neue nicht. */
  id?: string;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
  preisliste_id: string | null;
  zu_pruefen: boolean;
}

export interface SpeichernErgebnis {
  fehler?: string;
  summen?: { netto: number; mwst_betrag: number; brutto: number };
  /** IDs der neu angelegten Zeilen, in derselben Reihenfolge wie geschickt. */
  positionIds?: string[];
}

export async function angebotSpeichern(args: {
  angebotId: string;
  titel: string;
  kundeId: string | null;
  notiz: string | null;
  positionen: PositionEingabe[];
}): Promise<SpeichernErgebnis> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // Gehört das Angebot überhaupt diesem Nutzer? RLS würde es ohnehin
  // abweisen, aber so gibt es eine klare Meldung statt eines stummen No-ops.
  const { data: angebot } = await supabase
    .from("angebote")
    .select("id, status")
    .eq("id", args.angebotId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!angebot) return { fehler: "Angebot nicht gefunden." };

  const { error: kopfFehler } = await supabase
    .from("angebote")
    .update({
      titel: args.titel.trim(),
      kunde_id: args.kundeId,
      notiz: args.notiz?.trim() || null,
    })
    .eq("id", args.angebotId)
    .eq("user_id", user.id);

  if (kopfFehler) return { fehler: "Speichern fehlgeschlagen." };

  // --- Positionen ------------------------------------------------------------
  const behalten = args.positionen.map((p) => p.id).filter(Boolean) as string[];

  // Zuerst löschen, was der Nutzer entfernt hat.
  const loeschAbfrage = supabase
    .from("positionen")
    .delete()
    .eq("angebot_id", args.angebotId);
  if (behalten.length > 0) {
    await loeschAbfrage.not("id", "in", `(${behalten.join(",")})`);
  } else {
    await loeschAbfrage;
  }

  const positionIds: string[] = [];

  for (const [i, p] of args.positionen.entries()) {
    const zeile = {
      angebot_id: args.angebotId,
      pos_nr: i + 1,
      bezeichnung: p.bezeichnung.trim() || "Position",
      beschreibung: p.beschreibung?.trim() || null,
      menge: Number.isFinite(p.menge) ? p.menge : 1,
      einheit: p.einheit,
      einzelpreis: Number.isFinite(p.einzelpreis) ? p.einzelpreis : 0,
      preisliste_id: p.preisliste_id,
      zu_pruefen: p.zu_pruefen,
      ki_konfidenz: null,
    };

    if (p.id) {
      const { error } = await supabase
        .from("positionen")
        .update(zeile)
        .eq("id", p.id);
      if (error) return { fehler: "Eine Position konnte nicht gespeichert werden." };
      positionIds.push(p.id);
    } else {
      const { data, error } = await supabase
        .from("positionen")
        .insert(zeile)
        .select("id")
        .single();
      if (error || !data) {
        return { fehler: "Eine Position konnte nicht gespeichert werden." };
      }
      positionIds.push(data.id);
    }
  }

  // Summen nach dem Trigger zurücklesen.
  const { data: summen } = await supabase
    .from("angebote")
    .select("netto, mwst_betrag, brutto")
    .eq("id", args.angebotId)
    .maybeSingle();

  revalidatePath(`/angebote/${args.angebotId}`);
  revalidatePath("/angebote");

  return {
    summen: summen ?? undefined,
    positionIds,
  };
}

/** Status ändern (Entwurf → Gesendet → Angenommen …). */
export async function statusSetzen(
  angebotId: string,
  status: AngebotStatus,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const jetzt = new Date().toISOString();

  const { error } = await supabase
    .from("angebote")
    .update({
      status,
      // Zeitstempel setzen, sobald sie fachlich entstehen: "gesendet_am" ist
      // die Grundlage fürs Nachfassen, "entschieden_am" schliesst den Vorgang.
      ...(status === "gesendet" ? { gesendet_am: jetzt } : {}),
      ...(status === "angenommen" || status === "abgelehnt"
        ? { entschieden_am: jetzt }
        : {}),
    })
    .eq("id", angebotId)
    .eq("user_id", user.id);

  if (error) return { fehler: "Status konnte nicht geändert werden." };

  revalidatePath(`/angebote/${angebotId}`);
  revalidatePath("/angebote");
  return {};
}

/**
 * Angebot als PDF an den Kunden schicken.
 *
 * Der Versand setzt den Status gleich mit auf "gesendet" — das ist derselbe
 * Vorgang, und zwei Knöpfe dafür wären nur eine Gelegenheit, den zweiten zu
 * vergessen und das Angebot später im Entwurf wiederzufinden.
 *
 * Antworten gehen per reply-to an den Handwerker, nicht an uns.
 */
export async function angebotVersenden(
  angebotId: string,
): Promise<{ fehler?: string; erfolg?: string }> {
  if (!emailVerfuegbar()) {
    return { fehler: "Der E-Mail-Versand ist nicht eingerichtet." };
  }

  const supabase = await createClient();
  const ergebnis = await angebotPdfErzeugen(supabase, angebotId);
  if (ergebnis.fehler !== undefined) return { fehler: ergebnis.fehler };

  const { angebot, kunde, firma, puffer, dateiname } = ergebnis;

  if (!kunde?.email) {
    return {
      fehler:
        "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Trag sie beim Kunden ein.",
    };
  }

  const { betreff, text } = angebotNachricht({
    firmaName: firma.firma_name,
    nummer: angebot.nummer,
    titel: angebot.titel,
    gueltigBis: angebot.gueltig_bis,
    ansprechpartner: kunde.ansprechpartner,
    telefon: firma.telefon,
  });

  const versand = await sendeEmail({
    an: kunde.email,
    betreff,
    text,
    antwortAn: firma.email ?? undefined,
    anhaenge: [{ dateiname, inhalt: puffer }],
  });

  if (versand.fehler) return { fehler: versand.fehler };

  await statusSetzen(angebotId, "gesendet");

  return { erfolg: `Angebot an ${kunde.email} verschickt.` };
}

export async function angebotLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Positionen hängen per ON DELETE CASCADE dran.
  await supabase.from("angebote").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/angebote");
}

/**
 * Angebot als neuen Entwurf kopieren.
 *
 * Der häufigste Fall im Handwerk: derselbe Badumbau, andere Wohnung. Ohne
 * Kopie spricht der Handwerker dieselben zwölf Positionen ein zweites Mal ein
 * — und zahlt uns zweimal für die KI, für ein Ergebnis, das er schon hatte.
 *
 * Kopiert wird der fachliche Inhalt: Titel, Kunde, Notiz, Positionen. NICHT
 * kopiert wird alles, was zur Geschichte des Originals gehört — Nummer,
 * Status, Zeitstempel, PDF, und auch Transkript und KI-Hinweis nicht: sie
 * beschreiben ein Diktat, das zu dieser Kopie nie stattgefunden hat.
 *
 * Der Steuersatz kommt frisch aus den Firmendaten statt aus dem Original: eine
 * Kopie ist ein neues Angebot von heute und rechnet mit den heutigen Regeln.
 */
export async function angebotKopieren(
  angebotId: string,
): Promise<{ fehler?: string; angebotId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const [{ data: original }, { data: positionen }, { data: firma }] =
    await Promise.all([
      supabase
        .from("angebote")
        .select("titel, kunde_id, notiz")
        .eq("id", angebotId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("positionen")
        .select("*")
        .eq("angebot_id", angebotId)
        .order("pos_nr"),
      supabase
        .from("profiles")
        .select("mwst_satz, kleinunternehmer, angebot_gueltig_tage")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

  if (!original) return { fehler: "Angebot nicht gefunden." };

  const { data: nummer, error: nummerFehler } = await supabase.rpc(
    "next_angebot_nummer",
    { p_user_id: user.id },
  );
  if (nummerFehler || !nummer) {
    return { fehler: "Die Kopie konnte nicht angelegt werden." };
  }

  const gueltigBis = new Date();
  gueltigBis.setDate(gueltigBis.getDate() + (firma?.angebot_gueltig_tage ?? 30));

  const { data: kopie, error: kopieFehler } = await supabase
    .from("angebote")
    .insert({
      user_id: user.id,
      kunde_id: original.kunde_id,
      nummer,
      // Erkennbar machen, dass das eine Kopie ist: sonst liegen in der Liste
      // zwei gleich benannte Angebote und man öffnet beim Nachfassen das
      // falsche.
      titel: `${original.titel} (Kopie)`,
      status: "entwurf",
      datum: new Date().toISOString().slice(0, 10),
      gueltig_bis: gueltigBis.toISOString().slice(0, 10),
      transkript: null,
      ki_hinweis: null,
      mwst_satz: firma?.kleinunternehmer ? 0 : (firma?.mwst_satz ?? 19),
      netto: 0,
      mwst_betrag: 0,
      brutto: 0,
      notiz: original.notiz,
      audio_path: null,
      pdf_path: null,
      gesendet_am: null,
      entschieden_am: null,
      // Für die Pilot-Auswertung wichtig: eine Kopie ist keine Sprachaufnahme
      // und darf die Quote "wie oft wird wirklich gesprochen" nicht verfälschen.
      eingabe_art: "kopie",
      aufnahme_sekunden: null,
    })
    .select("id")
    .single();

  if (kopieFehler || !kopie) {
    return { fehler: "Die Kopie konnte nicht angelegt werden." };
  }

  if (positionen && positionen.length > 0) {
    const { error: posFehler } = await supabase.from("positionen").insert(
      positionen.map((p, i) => ({
        angebot_id: kopie.id,
        pos_nr: i + 1,
        bezeichnung: p.bezeichnung,
        beschreibung: p.beschreibung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
        preisliste_id: p.preisliste_id,
        // Was im Original geprüft war, ist es auch in der Kopie. Ein "à
        // vérifier" wieder aufzusetzen, würde den Handwerker zweimal
        // dieselbe Zeile prüfen lassen.
        zu_pruefen: p.zu_pruefen,
        ki_konfidenz: p.ki_konfidenz,
      })),
    );
    // Ein halb kopiertes Angebot ist schlimmer als keins: der Handwerker
    // schickt es sonst mit fehlenden Zeilen raus.
    if (posFehler) {
      await supabase.from("angebote").delete().eq("id", kopie.id);
      return { fehler: "Die Kopie konnte nicht angelegt werden." };
    }
  }

  revalidatePath("/angebote");
  return { angebotId: kopie.id };
}
