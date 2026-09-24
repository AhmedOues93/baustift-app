"use server";

import { revalidatePath } from "next/cache";

import { parseKundenCsv } from "@/lib/kunden-import";
import { createClient } from "@/lib/supabase/server";
import type { Kunde } from "@/types/database";

/**
 * Kunden-CRUD.
 *
 * Wie bei der Preisliste: `user_id` kommt aus der Session, nie aus dem
 * Formular, und jede Abfrage filtert zusätzlich auf `user_id` — RLS ist die
 * zweite Verteidigungslinie, nicht die einzige.
 */

export interface KundeState {
  fehler?: string;
  erfolg?: string;
  /** Bei der Anlage aus dem Angebotsdialog heraus gebraucht. */
  kunde?: Kunde;
}

function lesen(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { fehler: "Bitte einen Namen eingeben." };

  const text = (feld: string) => {
    const wert = String(formData.get(feld) ?? "").trim();
    return wert === "" ? null : wert;
  };

  return {
    daten: {
      name,
      ansprechpartner: text("ansprechpartner"),
      strasse: text("strasse"),
      plz: text("plz"),
      ort: text("ort"),
      email: text("email"),
      telefon: text("telefon"),
      notizen: text("notizen"),
    },
  };
}

export async function kundeAnlegen(
  _state: KundeState,
  formData: FormData,
): Promise<KundeState> {
  const gelesen = lesen(formData);
  if ("fehler" in gelesen) return { fehler: gelesen.fehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data, error } = await supabase
    .from("kunden")
    .insert({ ...gelesen.daten, user_id: user.id })
    .select()
    .single();

  if (error) return { fehler: "Speichern fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/kunden");
  revalidatePath("/angebote");
  return { erfolg: `„${gelesen.daten.name}" wurde gespeichert.`, kunde: data };
}

export async function kundeAendern(
  _state: KundeState,
  formData: FormData,
): Promise<KundeState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { fehler: "Kunde nicht gefunden." };

  const gelesen = lesen(formData);
  if ("fehler" in gelesen) return { fehler: gelesen.fehler };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase
    .from("kunden")
    .update(gelesen.daten)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { fehler: "Änderung fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/kunden");
  return { erfolg: "Änderung gespeichert." };
}

/**
 * Kunden aus einer CSV übernehmen.
 *
 * Wie bei der Preisliste additiv: vorhandene Kunden bleiben stehen. Zusätzlich
 * werden Namen übersprungen, die es schon gibt — sonst hat der Betrieb nach
 * dem zweiten Import jeden Kunden doppelt und findet im Angebot nicht mehr
 * den richtigen.
 */
export async function kundenImportieren(
  _state: KundeState,
  formData: FormData,
): Promise<KundeState> {
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

  const { zeilen, fehler } = parseKundenCsv(await datei.text());
  if (zeilen.length === 0) {
    return { fehler: fehler[0]?.grund ?? "In der Datei war keine brauchbare Zeile." };
  }

  const { data: vorhandene } = await supabase.from("kunden").select("name");
  const bekannt = new Set(
    (vorhandene ?? []).map((k: { name: string }) => k.name.trim().toLowerCase()),
  );

  const neue = zeilen.filter((z) => !bekannt.has(z.name.trim().toLowerCase()));
  const uebersprungen = fehler.length + (zeilen.length - neue.length);

  if (neue.length === 0) {
    return { fehler: "Alle Kunden aus der Datei gibt es schon." };
  }

  const { error } = await supabase
    .from("kunden")
    .insert(neue.map((z) => ({ ...z, user_id: user.id })));

  if (error) return { fehler: "Der Import ist fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/kunden");

  return {
    erfolg:
      `${neue.length} ${neue.length === 1 ? "Kunde" : "Kunden"} importiert.` +
      (uebersprungen > 0
        ? ` ${uebersprungen} ${uebersprungen === 1 ? "Zeile wurde" : "Zeilen wurden"} übersprungen.`
        : ""),
  };
}

export async function kundeLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Angebote bleiben erhalten (ON DELETE SET NULL): ein gelöschter Kunde darf
  // die Historie nicht mitnehmen.
  await supabase.from("kunden").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/kunden");
}
