"use server";

import { revalidatePath } from "next/cache";

import { parseMenge, parsePreis } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Einheit } from "@/types/database";

/**
 * =============================================================================
 * Leistungspakete
 * =============================================================================
 * Ein Bad ist für den Handwerker nicht eine Position, sondern immer dieselben
 * acht. Ein Paket ist diese Zusammenstellung mit einem Namen.
 *
 * Preise stehen NICHT im Paket, sondern als Verweis in die Preisliste — siehe
 * 0020_leistungspakete.sql. Wer seine Sätze erhöht, soll das nicht in zwölf
 * Paketen nachpflegen müssen.
 *
 * Sicherheit wie überall: `user_id` kommt aus der Session, nie aus dem
 * Formular, und RLS liegt darunter.
 */

export interface PaketState {
  fehler?: string;
  erfolg?: string;
  paketId?: string;
}

const EINHEITEN: Einheit[] = ["stk", "m", "m2", "m3", "h", "tag", "pauschal", "kg", "l"];

export async function paketAnlegen(
  _state: PaketState,
  formData: FormData,
): Promise<PaketState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { fehler: "Bitte einen Namen für das Paket angeben." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data, error } = await supabase
    .from("leistungspakete")
    .insert({
      user_id: user.id,
      name,
      beschreibung: String(formData.get("beschreibung") ?? "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !data) return { fehler: "Das Paket konnte nicht angelegt werden." };

  revalidatePath("/pakete");
  return { erfolg: `„${name}“ angelegt.`, paketId: data.id };
}

export async function paketLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Die Zeilen hängen per ON DELETE CASCADE daran. Angebote, die das Paket
  // schon benutzt haben, ändern sich nicht: dort stehen eigene Positionen.
  await supabase.from("leistungspakete").delete().eq("id", id).eq("user_id", user.id);

  revalidatePath("/pakete");
}

export async function paketZeileAnlegen(
  _state: PaketState,
  formData: FormData,
): Promise<PaketState> {
  const paketId = String(formData.get("paket_id") ?? "");
  const bezeichnung = String(formData.get("bezeichnung") ?? "").trim();
  if (!paketId || !bezeichnung) {
    return { fehler: "Bitte eine Leistung angeben." };
  }

  const menge = parseMenge(String(formData.get("menge") ?? "1"));
  if (menge === null || menge <= 0) {
    return { fehler: "Die Menge muss grösser als null sein." };
  }

  const einheitRoh = String(formData.get("einheit") ?? "stk") as Einheit;
  const einheit = EINHEITEN.includes(einheitRoh) ? einheitRoh : "stk";

  const preislisteId = String(formData.get("preisliste_id") ?? "") || null;
  // Ein Preis wird nur für Zeilen ohne Katalogeintrag gebraucht.
  const preis = preislisteId ? 0 : (parsePreis(String(formData.get("einzelpreis") ?? "0")) ?? 0);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  // Gehört das Paket ihm? RLS würde es abweisen; die Meldung ist klarer.
  const { data: paket } = await supabase
    .from("leistungspakete")
    .select("id")
    .eq("id", paketId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!paket) return { fehler: "Paket nicht gefunden." };

  const { data: letzte } = await supabase
    .from("paket_positionen")
    .select("pos_nr")
    .eq("paket_id", paketId)
    .order("pos_nr", { ascending: false })
    .limit(1);

  const { error } = await supabase.from("paket_positionen").insert({
    paket_id: paketId,
    pos_nr: (letzte?.[0]?.pos_nr ?? 0) + 1,
    preisliste_id: preislisteId,
    bezeichnung,
    beschreibung: String(formData.get("beschreibung") ?? "").trim() || null,
    menge,
    einheit,
    einzelpreis: preis,
  });

  if (error) return { fehler: "Die Zeile konnte nicht gespeichert werden." };

  revalidatePath(`/pakete/${paketId}`);
  return { erfolg: "Zeile hinzugefügt." };
}

export async function paketZeileLoeschen(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const paketId = String(formData.get("paket_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // RLS prüft über das Paket, ob die Zeile ihm gehört.
  await supabase.from("paket_positionen").delete().eq("id", id);

  revalidatePath(`/pakete/${paketId}`);
}

/**
 * Paket in ein Angebot übernehmen.
 *
 * Die eigentliche Arbeit macht die Datenbank (siehe
 * 0020_leistungspakete.sql): in einer Transaktion, mit dem Preis aus der
 * aktuellen Preisliste, hinter die vorhandenen Zeilen einsortiert.
 */
export async function paketUebernehmen(
  angebotId: string,
  paketId: string,
): Promise<{ fehler?: string; zeilen?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data, error } = await supabase.rpc("paket_in_angebot", {
    p_paket_id: paketId,
    p_angebot_id: angebotId,
  });

  if (error) return { fehler: "Das Paket konnte nicht übernommen werden." };
  if (!data) {
    // Null Zeilen heisst: leeres Paket, oder eines der beiden gehört ihm
    // nicht. Beides führt zu derselben, harmlosen Meldung.
    return { fehler: "Aus diesem Paket kam keine Zeile." };
  }

  revalidatePath(`/angebote/${angebotId}`);
  return { zeilen: data };
}
