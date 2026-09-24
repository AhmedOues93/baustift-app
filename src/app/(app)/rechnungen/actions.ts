"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { emailVerfuegbar, rechnungNachricht, sendeEmail } from "@/lib/email/senden";
import { rechnungPdfErzeugen } from "@/lib/pdf/erzeugen";
import { createClient } from "@/lib/supabase/server";
import type { Einheit, Position, RechnungPosition } from "@/types/database";

/**
 * Rechnungen.
 *
 * Der ganze Ablauf dreht sich um einen einzigen Punkt: das Festschreiben.
 * Davor ist die Rechnung ein Entwurf und beliebig änderbar, danach ist sie
 * ein Beleg und unveränderlich. Diese Grenze erzwingt die Datenbank
 * (Trigger in 0005_rechnungen.sql) — hier wird sie nur bedient und dem
 * Nutzer erklärt.
 */

export interface RechnungState {
  fehler?: string;
  erfolg?: string;
}

/**
 * Aus einem angenommenen Angebot eine Rechnung machen.
 *
 * Die Positionen werden KOPIERT, nicht verknüpft: spätere Änderungen am
 * Angebot dürfen einen gestellten Beleg nicht rückwirkend verändern.
 */
export async function rechnungAusAngebot(angebotId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: angebot } = await supabase
    .from("angebote")
    .select("*")
    .eq("id", angebotId)
    .maybeSingle();
  if (!angebot) redirect("/angebote");

  const { data: positionen } = await supabase
    .from("positionen")
    .select("*")
    .eq("angebot_id", angebotId)
    .order("pos_nr");

  const { data: nummer } = await supabase.rpc("next_rechnung_nummer", {
    p_user_id: user.id,
  });
  if (!nummer) redirect(`/angebote/${angebotId}`);

  const heute = new Date();
  const faellig = new Date(heute);
  faellig.setDate(faellig.getDate() + 14);

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .insert({
      user_id: user.id,
      kunde_id: angebot.kunde_id,
      angebot_id: angebot.id,
      nummer,
      titel: angebot.titel,
      status: "entwurf",
      datum: heute.toISOString().slice(0, 10),
      // Vorbelegt mit heute: der häufigste Fall ist "Arbeit ist fertig,
      // Rechnung geht raus". Änderbar, solange die Rechnung ein Entwurf ist.
      leistung_von: heute.toISOString().slice(0, 10),
      leistung_bis: heute.toISOString().slice(0, 10),
      zahlungsziel_tage: 14,
      faellig_am: faellig.toISOString().slice(0, 10),
      mwst_satz: angebot.mwst_satz,
      netto: 0,
      mwst_betrag: 0,
      brutto: 0,
      notiz: null,
      festgeschrieben_am: null,
      bezahlt_am: null,
      storniert_am: null,
      storniert_durch: null,
    })
    .select("id")
    .single();

  if (!rechnung) redirect(`/angebote/${angebotId}`);

  if (positionen && positionen.length > 0) {
    await supabase.from("rechnung_positionen").insert(
      (positionen as Position[]).map((p, i) => ({
        rechnung_id: rechnung.id,
        pos_nr: i + 1,
        bezeichnung: p.bezeichnung,
        beschreibung: p.beschreibung,
        menge: p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
      })),
    );
  }

  revalidatePath("/rechnungen");
  redirect(`/rechnungen/${rechnung.id}`);
}

export interface RechnungPositionEingabe {
  id?: string;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
}

/** Entwurf bearbeiten. Nach dem Festschreiben weist die Datenbank das ab. */
export async function rechnungSpeichern(args: {
  rechnungId: string;
  titel: string;
  kundeId: string | null;
  notiz: string | null;
  leistungVon: string | null;
  leistungBis: string | null;
  zahlungszielTage: number;
  positionen: RechnungPositionEingabe[];
}): Promise<{ fehler?: string; positionIds?: string[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .select("id, festgeschrieben_am, datum")
    .eq("id", args.rechnungId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rechnung) return { fehler: "Rechnung nicht gefunden." };
  if (rechnung.festgeschrieben_am) {
    return { fehler: "Diese Rechnung ist gestellt und kann nicht mehr geändert werden." };
  }

  const faellig = new Date(rechnung.datum);
  faellig.setDate(faellig.getDate() + args.zahlungszielTage);

  const { error: kopfFehler } = await supabase
    .from("rechnungen")
    .update({
      titel: args.titel.trim(),
      kunde_id: args.kundeId,
      notiz: args.notiz?.trim() || null,
      leistung_von: args.leistungVon,
      leistung_bis: args.leistungBis,
      zahlungsziel_tage: args.zahlungszielTage,
      faellig_am: faellig.toISOString().slice(0, 10),
    })
    .eq("id", args.rechnungId);

  if (kopfFehler) return { fehler: "Speichern fehlgeschlagen." };

  const behalten = args.positionen.map((p) => p.id).filter(Boolean) as string[];
  const loeschen = supabase
    .from("rechnung_positionen")
    .delete()
    .eq("rechnung_id", args.rechnungId);
  if (behalten.length > 0) {
    await loeschen.not("id", "in", `(${behalten.join(",")})`);
  } else {
    await loeschen;
  }

  const positionIds: string[] = [];
  for (const [i, p] of args.positionen.entries()) {
    const zeile = {
      rechnung_id: args.rechnungId,
      pos_nr: i + 1,
      bezeichnung: p.bezeichnung.trim() || "Position",
      beschreibung: p.beschreibung?.trim() || null,
      menge: Number.isFinite(p.menge) ? p.menge : 1,
      einheit: p.einheit,
      einzelpreis: Number.isFinite(p.einzelpreis) ? p.einzelpreis : 0,
    };

    if (p.id) {
      const { error } = await supabase
        .from("rechnung_positionen")
        .update(zeile)
        .eq("id", p.id);
      if (error) return { fehler: "Eine Position konnte nicht gespeichert werden." };
      positionIds.push(p.id);
    } else {
      const { data, error } = await supabase
        .from("rechnung_positionen")
        .insert(zeile)
        .select("id")
        .single();
      if (error || !data) {
        return { fehler: "Eine Position konnte nicht gespeichert werden." };
      }
      positionIds.push(data.id);
    }
  }

  revalidatePath(`/rechnungen/${args.rechnungId}`);
  revalidatePath("/rechnungen");
  return { positionIds };
}

/**
 * Festschreiben: aus dem Entwurf wird ein Beleg.
 *
 * Ab hier ist nichts mehr zu ändern — deshalb ist das im UI ein eigener,
 * bestätigter Schritt und nicht bloss ein Statuswechsel nebenbei.
 */
export async function rechnungStellen(
  rechnungId: string,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: rechnung } = await supabase
    .from("rechnungen")
    .select("id, netto, festgeschrieben_am")
    .eq("id", rechnungId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!rechnung) return { fehler: "Rechnung nicht gefunden." };
  if (rechnung.festgeschrieben_am) return {};
  if (rechnung.netto <= 0) {
    return { fehler: "Eine Rechnung über 0 € lässt sich nicht stellen." };
  }

  const { error } = await supabase
    .from("rechnungen")
    .update({
      status: "gestellt",
      festgeschrieben_am: new Date().toISOString(),
      // Das Rechnungsdatum ist erst jetzt fachlich wahr.
      datum: new Date().toISOString().slice(0, 10),
    })
    .eq("id", rechnungId);

  if (error) return { fehler: "Die Rechnung konnte nicht gestellt werden." };

  revalidatePath(`/rechnungen/${rechnungId}`);
  revalidatePath("/rechnungen");
  return {};
}

export async function rechnungBezahlt(
  rechnungId: string,
): Promise<{ fehler?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("rechnungen")
    .update({ status: "bezahlt", bezahlt_am: new Date().toISOString() })
    .eq("id", rechnungId)
    .eq("user_id", user.id);

  if (error) return { fehler: "Status konnte nicht geändert werden." };

  revalidatePath(`/rechnungen/${rechnungId}`);
  revalidatePath("/rechnungen");
  return {};
}

/**
 * Stornieren.
 *
 * Eine gestellte Rechnung wird nicht gelöscht und nicht verändert — es
 * entsteht eine Stornorechnung mit negativen Beträgen und eigener Nummer.
 * Alles andere wäre das Löschen eines Belegs, und genau das darf nicht
 * passieren.
 */
export async function rechnungStornieren(
  rechnungId: string,
): Promise<{ fehler?: string; stornoId?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: original } = await supabase
    .from("rechnungen")
    .select("*")
    .eq("id", rechnungId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!original) return { fehler: "Rechnung nicht gefunden." };
  if (!original.festgeschrieben_am) {
    return { fehler: "Ein Entwurf muss nicht storniert werden — lösche ihn einfach." };
  }
  if (original.status === "storniert") return { fehler: "Bereits storniert." };

  const { data: positionen } = await supabase
    .from("rechnung_positionen")
    .select("*")
    .eq("rechnung_id", rechnungId)
    .order("pos_nr");

  const { data: nummer } = await supabase.rpc("next_rechnung_nummer", {
    p_user_id: user.id,
  });
  if (!nummer) return { fehler: "Storno konnte nicht angelegt werden." };

  const heute = new Date().toISOString().slice(0, 10);

  const { data: storno } = await supabase
    .from("rechnungen")
    .insert({
      user_id: user.id,
      kunde_id: original.kunde_id,
      angebot_id: original.angebot_id,
      nummer,
      titel: `Storno zu ${original.nummer}`,
      status: "entwurf",
      datum: heute,
      leistung_von: original.leistung_von,
      leistung_bis: original.leistung_bis,
      zahlungsziel_tage: 0,
      faellig_am: heute,
      mwst_satz: original.mwst_satz,
      netto: 0,
      mwst_betrag: 0,
      brutto: 0,
      notiz: `Diese Stornorechnung hebt die Rechnung ${original.nummer} vollständig auf.`,
      festgeschrieben_am: null,
      bezahlt_am: null,
      storniert_am: null,
      storniert_durch: null,
    })
    .select("id")
    .single();

  if (!storno) return { fehler: "Storno konnte nicht angelegt werden." };

  if (positionen && positionen.length > 0) {
    await supabase.from("rechnung_positionen").insert(
      (positionen as RechnungPosition[]).map((p, i) => ({
        rechnung_id: storno.id,
        pos_nr: i + 1,
        bezeichnung: p.bezeichnung,
        beschreibung: p.beschreibung,
        // Negative Menge: der Beleg hebt die ursprüngliche Leistung auf und
        // die Summen ergeben sich wieder von selbst aus den Positionen.
        menge: -p.menge,
        einheit: p.einheit,
        einzelpreis: p.einzelpreis,
      })),
    );
  }

  // Storno sofort festschreiben: ein änderbarer Storno wäre sinnlos.
  await supabase
    .from("rechnungen")
    .update({
      status: "storniert",
      festgeschrieben_am: new Date().toISOString(),
    })
    .eq("id", storno.id);

  // Und das Original als storniert kennzeichnen. Betrag und Positionen
  // bleiben dabei unangetastet — nur diese beiden Felder lässt der
  // Unveränderlichkeits-Trigger zu.
  await supabase
    .from("rechnungen")
    .update({
      status: "storniert",
      storniert_am: new Date().toISOString(),
      storniert_durch: storno.id,
    })
    .eq("id", rechnungId);

  revalidatePath("/rechnungen");
  return { stornoId: storno.id };
}

/** Entwurf löschen. Gestellte Rechnungen lassen sich nur stornieren. */
export async function rechnungEntwurfLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("rechnungen")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .is("festgeschrieben_am", null);

  revalidatePath("/rechnungen");
  redirect("/rechnungen");
}

/** Rechnung als PDF an den Kunden schicken; schreibt sie vorher fest. */
export async function rechnungVersenden(
  rechnungId: string,
): Promise<{ fehler?: string; erfolg?: string }> {
  if (!emailVerfuegbar()) {
    return { fehler: "Der E-Mail-Versand ist nicht eingerichtet." };
  }

  const gestellt = await rechnungStellen(rechnungId);
  if (gestellt.fehler) return { fehler: gestellt.fehler };

  const supabase = await createClient();
  const ergebnis = await rechnungPdfErzeugen(supabase, rechnungId);
  if (ergebnis.fehler !== undefined) return { fehler: ergebnis.fehler };

  const { rechnung, kunde, firma, puffer, dateiname } = ergebnis;

  if (!kunde?.email) {
    return {
      fehler:
        "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt. Die Rechnung ist gestellt — du kannst das PDF herunterladen.",
    };
  }

  const { betreff, text } = rechnungNachricht({
    firmaName: firma.firma_name,
    nummer: rechnung.nummer,
    titel: rechnung.titel,
    faelligAm: rechnung.faellig_am,
    ansprechpartner: kunde.ansprechpartner,
  });

  const versand = await sendeEmail({
    an: kunde.email,
    betreff,
    text,
    antwortAn: firma.email ?? undefined,
    anhaenge: [{ dateiname, inhalt: puffer }],
  });

  if (versand.fehler) return { fehler: versand.fehler };

  revalidatePath(`/rechnungen/${rechnungId}`);
  return { erfolg: `Rechnung an ${kunde.email} verschickt.` };
}
