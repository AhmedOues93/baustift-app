"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { protokolliereFehler } from "@/lib/protokoll";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Konto löschen — Art. 17 DSGVO (Recht auf Löschung).
 *
 * Zwei Dinge sind hier anders als überall sonst:
 *
 *  1. Es läuft über den Admin-Client, weil nur der einen Nutzer aus
 *     `auth.users` entfernen darf. Das ist der einzige Ort neben dem
 *     Stripe-Webhook, an dem RLS umgangen wird — deshalb wird die ID
 *     ausschliesslich aus der Session genommen und niemals aus dem Formular.
 *  2. Alles Weitere löscht die Datenbank selbst: jede Tabelle hängt per
 *     ON DELETE CASCADE an auth.users. Hier einzeln aufzuräumen wäre eine
 *     zweite Wahrheit, die beim nächsten neuen Feature vergessen wird.
 *
 * Der Nutzer muss den Namen seines Betriebs tippen. Ein Häkchen oder ein
 * zweiter Klick ist bei einer unumkehrbaren Aktion zu wenig.
 */
export async function kontoLoeschen(
  _state: { fehler?: string },
  formData: FormData,
): Promise<{ fehler?: string }> {
  const bestaetigung = String(formData.get("bestaetigung") ?? "").trim();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: profil } = await supabase
    .from("profiles")
    .select("firma_name, stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  const erwartet = (profil?.firma_name || user.email || "").trim();
  if (!erwartet || bestaetigung.toLowerCase() !== erwartet.toLowerCase()) {
    return {
      fehler: `Bitte „${erwartet}“ genau so eintippen, um das Löschen zu bestätigen.`,
    };
  }

  // Ein laufendes Abo würde weiter abgerechnet, während die Daten schon weg
  // sind. Erst kündigen lassen, dann löschen.
  if (profil?.stripe_subscription_id) {
    return {
      fehler:
        "Dein Abo läuft noch. Kündige es zuerst unter „Abo verwalten“, danach lässt sich das Konto löschen.",
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    protokolliereFehler({ vorgang: "konto.loeschen", userId: user.id }, error);
    return { fehler: "Das Konto konnte nicht gelöscht werden. Bitte melde dich bei uns." };
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/?geloescht=1");
}
