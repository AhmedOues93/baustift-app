"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/**
 * =============================================================================
 * Was der Kunde über den Link tun darf
 * =============================================================================
 * Alles läuft über die drei Funktionen aus 0019_angebot_freigabe.sql. Hier
 * wird kein Admin-Client benutzt und keine Tabelle direkt angefasst: der
 * öffentliche Weg soll genau so viel können wie dort festgelegt — ein
 * Angebot lesen, es als geöffnet vermerken, einmal entscheiden.
 */

export interface FreigabeState {
  fehler?: string;
  erfolg?: string;
}

export async function angebotEntscheiden(
  _state: FreigabeState,
  formData: FormData,
): Promise<FreigabeState> {
  const token = String(formData.get("token") ?? "");
  const entscheidung = String(formData.get("entscheidung") ?? "");
  const anmerkung = String(formData.get("anmerkung") ?? "").slice(0, 2000);

  if (!token || (entscheidung !== "angenommen" && entscheidung !== "abgelehnt")) {
    return { fehler: "Das hat nicht geklappt. Bitte die Seite neu laden." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("angebot_entscheiden", {
    p_token: token,
    p_entscheidung: entscheidung,
    p_anmerkung: anmerkung || null,
  });

  if (error) {
    return { fehler: "Das hat nicht geklappt. Bitte noch einmal versuchen." };
  }

  /**
   * `false` heisst: falscher Schlüssel, noch ein Entwurf, oder schon
   * entschieden. Die Seite sagt bewusst in allen drei Fällen dasselbe —
   * wer einen Link durchprobiert, soll daraus nichts ableiten können.
   */
  if (data !== true) {
    return {
      fehler:
        "Dieses Angebot lässt sich nicht mehr entscheiden. Melde dich bitte direkt beim Betrieb.",
    };
  }

  revalidatePath(`/angebot/${token}`);
  return {
    erfolg:
      entscheidung === "angenommen"
        ? "Danke — der Betrieb ist benachrichtigt und meldet sich bei dir."
        : "Danke für die Rückmeldung. Der Betrieb wurde informiert.",
  };
}
