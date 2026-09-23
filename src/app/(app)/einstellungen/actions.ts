"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { parsePreis } from "@/lib/format";

/**
 * Firmendaten — das, was später im Briefkopf und in der Fusszeile des
 * Angebots-PDF steht.
 *
 * Diese Seite ist der stille Blocker des ganzen Produkts: ohne Steuernummer,
 * Anschrift und Bankverbindung ist das PDF kein brauchbares Geschäftsdokument.
 * Deshalb kommt sie vor der Angebotserstellung.
 */

export interface FirmaState {
  fehler?: string;
  erfolg?: string;
}

/** Maximalgrösse fürs Logo. Grössere Bilder bringen im PDF nichts. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPEN = ["image/png", "image/jpeg", "image/webp"];

export async function firmendatenSpeichern(
  _state: FirmaState,
  formData: FormData,
): Promise<FirmaState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const text = (feld: string) => {
    const wert = String(formData.get(feld) ?? "").trim();
    return wert === "" ? null : wert;
  };

  const kleinunternehmer = formData.get("kleinunternehmer") === "on";
  const mwst = parsePreis(String(formData.get("mwst_satz") ?? "19"));

  if (mwst === null || mwst > 100) {
    return { fehler: "Der MwSt-Satz muss eine Zahl zwischen 0 und 100 sein." };
  }

  const gueltigRoh = Number(formData.get("angebot_gueltig_tage") ?? 30);
  const gueltig =
    Number.isInteger(gueltigRoh) && gueltigRoh > 0 && gueltigRoh <= 365
      ? gueltigRoh
      : 30;

  // --- Logo ------------------------------------------------------------------
  let logoPfad: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (!LOGO_TYPEN.includes(logo.type)) {
      return { fehler: "Das Logo muss ein PNG, JPG oder WebP sein." };
    }
    if (logo.size > LOGO_MAX_BYTES) {
      return { fehler: "Das Logo darf höchstens 2 MB gross sein." };
    }

    // Pfad IMMER <user_id>/… — darauf bauen die Storage-Policies auf.
    const endung = logo.type.split("/")[1].replace("jpeg", "jpg");
    const pfad = `${user.id}/logo.${endung}`;

    const { error } = await supabase.storage
      .from("logos")
      .upload(pfad, logo, { upsert: true, contentType: logo.type });

    if (error) return { fehler: "Das Logo konnte nicht hochgeladen werden." };
    logoPfad = pfad;
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      firma_name: String(formData.get("firma_name") ?? "").trim(),
      inhaber_name: text("inhaber_name"),
      strasse: text("strasse"),
      plz: text("plz"),
      ort: text("ort"),
      telefon: text("telefon"),
      email: text("email"),
      website: text("website"),
      steuernummer: text("steuernummer"),
      ust_id: text("ust_id"),
      iban: text("iban"),
      bic: text("bic"),
      bank_name: text("bank_name"),
      kleinunternehmer,
      // Kleinunternehmer nach §19 UStG weisen keine Umsatzsteuer aus.
      // Den Satz hart auf 0 zu setzen verhindert, dass später doch 19 %
      // im PDF landen, weil irgendwo der alte Wert gelesen wird.
      mwst_satz: kleinunternehmer ? 0 : mwst,
      angebot_gueltig_tage: gueltig,
      ...(logoPfad ? { logo_url: logoPfad } : {}),
    })
    .eq("id", user.id);

  if (error) return { fehler: "Speichern fehlgeschlagen. Bitte nochmal." };

  revalidatePath("/einstellungen");
  return { erfolg: "Firmendaten gespeichert." };
}

/** Logo wieder entfernen. */
export async function logoEntfernen(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profil } = await supabase
    .from("profiles")
    .select("logo_url")
    .eq("id", user.id)
    .maybeSingle();

  if (profil?.logo_url) {
    await supabase.storage.from("logos").remove([profil.logo_url]);
  }
  await supabase.from("profiles").update({ logo_url: null }).eq("id", user.id);

  revalidatePath("/einstellungen");
}
