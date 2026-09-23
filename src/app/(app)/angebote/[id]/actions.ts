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
  const supabase = createClient();
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
  const supabase = createClient();
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

  const supabase = createClient();
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

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Positionen hängen per ON DELETE CASCADE dran.
  await supabase.from("angebote").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/angebote");
}
