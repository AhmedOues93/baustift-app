"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parsePreis } from "@/lib/format";
import { parseCsv } from "@/lib/preisliste-import";
import { createClient } from "@/lib/supabase/server";

/**
 * Einrichtung in einem Durchgang: Firmendaten, Steuerangaben und die ersten
 * Preise.
 *
 * Warum überhaupt ein eigener Ablauf? Wer sich registriert und direkt auf
 * einer leeren Angebotsliste landet, hat drei Dinge zu erledigen, ohne zu
 * wissen, dass er sie hat — und beim ersten Angebot ist dann das PDF leer und
 * jede Position ohne Preis. Danach kommt er nicht wieder.
 *
 * Alles hier ist überspringbar. Ein Pflichtparcours vor dem ersten Erfolg
 * vertreibt genau die Leute, die es eilig haben.
 */

export interface WillkommenState {
  fehler?: string;
  /** Zusammenfassung des Imports, wird im letzten Schritt gezeigt. */
  importMeldung?: string;
}

export async function einrichtungAbschliessen(
  _state: WillkommenState,
  formData: FormData,
): Promise<WillkommenState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const text = (feld: string) => {
    const wert = String(formData.get(feld) ?? "").trim();
    return wert === "" ? null : wert;
  };

  const firma = String(formData.get("firma_name") ?? "").trim();
  if (!firma) return { fehler: "Bitte den Namen des Betriebs eintragen." };

  const kleinunternehmer = formData.get("kleinunternehmer") === "on";
  const mwst = parsePreis(String(formData.get("mwst_satz") ?? "19"));
  if (mwst === null || mwst > 100) {
    return { fehler: "Der MwSt-Satz muss eine Zahl zwischen 0 und 100 sein." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      firma_name: firma,
      inhaber_name: text("inhaber_name"),
      strasse: text("strasse"),
      plz: text("plz"),
      ort: text("ort"),
      telefon: text("telefon"),
      steuernummer: text("steuernummer"),
      iban: text("iban"),
      kleinunternehmer,
      mwst_satz: kleinunternehmer ? 0 : mwst,
      onboarding_am: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { fehler: "Speichern fehlgeschlagen. Bitte nochmal." };

  // Preisliste ist freiwillig — ein Fehler dabei darf die Einrichtung nicht
  // scheitern lassen, sonst steht der Nutzer ohne Profil da.
  const datei = formData.get("preise");
  if (datei instanceof File && datei.size > 0 && datei.size < 2 * 1024 * 1024) {
    const { zeilen } = parseCsv(await datei.text());
    if (zeilen.length > 0) {
      await supabase
        .from("preisliste")
        .insert(zeilen.map((z) => ({ ...z, user_id: user.id, aktiv: true })));
    }
  }

  revalidatePath("/", "layout");
  redirect("/angebote/neu");
}

/** Später einrichten — wir merken uns nur, dass der Ablauf durch ist. */
export async function einrichtungUeberspringen(_formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ onboarding_am: new Date().toISOString() })
    .eq("id", user.id);

  revalidatePath("/", "layout");
  redirect("/angebote");
}
