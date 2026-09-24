"use server";

import { revalidatePath } from "next/cache";

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
