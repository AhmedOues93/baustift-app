"use server";

import { revalidatePath } from "next/cache";

import { parsePreis } from "@/lib/format";
import { parseCsv, schluessel, textAusBytes } from "@/lib/preisliste-import";
import { createClient } from "@/lib/supabase/server";
import type { Einheit } from "@/types/database";

/**
 * CRUD für die Preisliste.
 *
 * Sicherheit: `user_id` kommt IMMER aus der Session (`auth.getUser()`) und
 * niemals aus dem Formular — sonst könnte jemand mit einem manipulierten
 * Request in fremde Preislisten schreiben. Zusätzlich greift RLS in der
 * Datenbank; beides zusammen ist Absicht (Verteidigung in der Tiefe).
 */

export interface PreisState {
  fehler?: string;
  erfolg?: string;
}

const EINHEITEN: Einheit[] = [
  "stk",
  "m",
  "m2",
  "m3",
  "h",
  "tag",
  "pauschal",
  "kg",
  "l",
];

/** Stichworte aus einem Freitextfeld: "bad fliesen, verfliesen" → Array. */
function parseStichworte(eingabe: string): string[] {
  return eingabe
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

function leseFormular(formData: FormData) {
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  const einheitRoh = String(formData.get("einheit") ?? "stk") as Einheit;
  const preis = parsePreis(String(formData.get("einzelpreis") ?? ""));

  if (!bezeichnung) return { fehler: "Bitte eine Bezeichnung eingeben." };
  if (preis === null)
    return { fehler: "Bitte einen gültigen Preis eingeben, z. B. 89,50." };
  if (!EINHEITEN.includes(einheitRoh))
    return { fehler: "Unbekannte Einheit." };

  return {
    daten: {
      bezeichnung,
      beschreibung: String(formData.get("beschreibung") ?? "").trim() || null,
      kategorie: String(formData.get("kategorie") ?? "").trim() || null,
      einheit: einheitRoh,
      einzelpreis: preis,
      stichworte: parseStichworte(String(formData.get("stichworte") ?? "")),
      aktiv: true,
    },
  };
}

export async function preisAnlegen(
  _state: PreisState,
  formData: FormData,
): Promise<PreisState> {
  const gelesen = leseFormular(formData);
  if ("fehler" in gelesen) return { fehler: gelesen.fehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("preisliste")
    .insert({ ...gelesen.daten, user_id: user.id });

  if (error) return { fehler: "Speichern fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/preisliste");
  return { erfolg: `„${gelesen.daten.bezeichnung}" wurde gespeichert.` };
}

export async function preisAendern(
  _state: PreisState,
  formData: FormData,
): Promise<PreisState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { fehler: "Eintrag nicht gefunden." };

  const gelesen = leseFormular(formData);
  if ("fehler" in gelesen) return { fehler: gelesen.fehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // `eq("user_id", …)` zusätzlich zur RLS: so ist auch ohne aktive Policy
  // ausgeschlossen, dass eine fremde ID getroffen wird.
  const { error } = await supabase
    .from("preisliste")
    .update(gelesen.daten)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { fehler: "Änderung fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/preisliste");
  return { erfolg: "Änderung gespeichert." };
}

/**
 * Preisliste aus einer CSV-Datei übernehmen.
 *
 * Bewusst additiv: vorhandene Einträge bleiben stehen. Ein Import, der die
 * gepflegte Liste ersetzt, ist beim ersten Fehlversuch ein Datenverlust —
 * doppelte Zeilen sind dagegen in zwei Minuten gelöscht.
 */
export async function preislisteImportieren(
  _state: PreisState,
  formData: FormData,
): Promise<PreisState> {
  const datei = formData.get("datei");
  if (!(datei instanceof File) || datei.size === 0) {
    return { fehler: "Bitte eine CSV-Datei auswählen." };
  }
  if (datei.size > 2 * 1024 * 1024) {
    return { fehler: "Die Datei ist zu gross (max. 2 MB)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // Rohbytes statt `datei.text()`: Excel speichert CSV unter Windows meist
  // nicht als UTF-8, und dann steht später „St?ck Fliesen“ im Angebot.
  const { zeilen, fehler, warnungen } = parseCsv(
    textAusBytes(await datei.arrayBuffer()),
  );

  if (zeilen.length === 0) {
    return {
      fehler: fehler[0]?.grund ?? "In der Datei war keine brauchbare Zeile.",
    };
  }

  /**
   * Gegen den vorhandenen Katalog abgleichen.
   *
   * Der Import bleibt additiv — aber zweimal dieselbe Datei einzulesen soll
   * die Liste nicht verdoppeln. Wer nach einem abgebrochenen Versuch noch
   * einmal auf „Importieren“ drückt, tut das nämlich genau so.
   */
  const { data: vorhanden } = await supabase
    .from("preisliste")
    .select("bezeichnung, einheit")
    .eq("user_id", user.id);

  const bekannt = new Set(
    (vorhanden ?? []).map((v) => schluessel(v as { bezeichnung: string; einheit: Einheit })),
  );
  const neue = zeilen.filter((z) => !bekannt.has(schluessel(z)));
  const doppelt = zeilen.length - neue.length;

  if (neue.length === 0) {
    return {
      fehler: `Alle ${zeilen.length} Zeilen stehen schon in deiner Preisliste. Es wurde nichts geändert.`,
    };
  }

  const { error } = await supabase.from("preisliste").insert(
    neue.map((z) => ({ ...z, user_id: user.id, aktiv: true })),
  );

  if (error) return { fehler: "Der Import ist fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/preisliste");

  const teile = [
    `${neue.length} ${neue.length === 1 ? "Preis" : "Preise"} importiert.`,
  ];
  if (doppelt > 0) {
    teile.push(
      `${doppelt} ${doppelt === 1 ? "Eintrag war" : "Einträge waren"} schon vorhanden.`,
    );
  }
  if (fehler.length > 0) {
    teile.push(
      `${fehler.length} ${fehler.length === 1 ? "Zeile wurde" : "Zeilen wurden"} übersprungen: ${fehler[0].grund}`,
    );
  }
  if (warnungen.length > 0) {
    teile.push(
      `${warnungen.length} ${warnungen.length === 1 ? "Zeile braucht" : "Zeilen brauchen"} einen Blick: ${warnungen[0].grund}`,
    );
  }

  return { erfolg: teile.join(" ") };
}

export async function preisLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Bewusst ein echtes DELETE: Positionen in bestehenden Angeboten verlieren
  // nur ihre Referenz (ON DELETE SET NULL in 0001_init.sql), Preis und Text
  // bleiben dort erhalten. Alte Angebote ändern sich also nicht rückwirkend.
  await supabase.from("preisliste").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/preisliste");
}
