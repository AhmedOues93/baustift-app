"use server";

import { revalidatePath } from "next/cache";

import { entscheidungNachricht, sendeEmail } from "@/lib/email/senden";
import { publicEnv } from "@/lib/env";
import { createAdminClient, createClient } from "@/lib/supabase/server";

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

  // Den Betrieb benachrichtigen. Ohne das wäre die Freigabe eine halbe
  // Funktion: die Zusage steht in der App, aber der Handwerker sitzt im
  // Auto. Ein Fehler dabei darf die Entscheidung nicht zurücknehmen — sie
  // ist in der Datenbank, und das zählt.
  await benachrichtige(token, entscheidung === "angenommen").catch(() => undefined);

  revalidatePath(`/angebot/${token}`);
  return {
    erfolg:
      entscheidung === "angenommen"
        ? "Danke — der Betrieb ist benachrichtigt und meldet sich bei dir."
        : "Danke für die Rückmeldung. Der Betrieb wurde informiert.",
  };
}

/**
 * E-Mail an den Betrieb.
 *
 * Läuft über den Admin-Client, aber erst NACHDEM die Datenbank die
 * Entscheidung angenommen hat — die Berechtigung über den Schlüssel ist an
 * dieser Stelle schon geprüft. Die Adresse des Betriebs verlässt den Server
 * dabei nicht: sie wird hier gelesen und hier benutzt.
 */
async function benachrichtige(token: string, angenommen: boolean): Promise<void> {
  const admin = createAdminClient();

  const { data: angebot } = await admin
    .from("angebote")
    .select("id, nummer, titel, user_id, kunde_id, kunden_anmerkung")
    .eq("freigabe_token", token)
    .maybeSingle();
  if (!angebot) return;

  const [{ data: firma }, { data: kunde }] = await Promise.all([
    admin.from("profiles").select("email, firma_name").eq("id", angebot.user_id).maybeSingle(),
    angebot.kunde_id
      ? admin.from("kunden").select("name").eq("id", angebot.kunde_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  if (!firma?.email) return;

  const { betreff, text } = entscheidungNachricht({
    nummer: angebot.nummer,
    titel: angebot.titel,
    kundeName: kunde?.name ?? null,
    angenommen,
    anmerkung: angebot.kunden_anmerkung,
    link: `${publicEnv.siteUrl}/angebote/${angebot.id}`,
  });

  // Ohne eingerichteten Versand passiert hier nichts weiter — das ist in
  // Ordnung, die Entscheidung steht trotzdem in der App.
  await sendeEmail({ an: firma.email, betreff, text });
}
