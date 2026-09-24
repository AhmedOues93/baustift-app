"use server";

import { createClient } from "@/lib/supabase/server";
import type { FeedbackArt } from "@/types/database";

/**
 * Rückmeldung aus dem laufenden Betrieb.
 *
 * Warum im Produkt und nicht per WhatsApp: eine Rückmeldung, die erst abends
 * aufgeschrieben wird, verliert genau das, was sie brauchbar macht — die
 * Seite, auf der es passiert ist, und den Ärger im Moment. Deshalb steht der
 * Knopf während des Piloten auf jedem Bildschirm und schickt die Seite mit.
 */
export async function feedbackSenden(args: {
  art: FeedbackArt;
  text: string;
  seite: string;
}): Promise<{ fehler?: string; erfolg?: boolean }> {
  const text = args.text.trim();
  if (text.length < 5) {
    return { fehler: "Schreib bitte noch ein, zwei Worte mehr." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { error } = await supabase.from("feedback").insert({
    user_id: user.id,
    art: args.art,
    text: text.slice(0, 4000),
    seite: args.seite.slice(0, 200),
  });

  if (error) return { fehler: "Konnte nicht gesendet werden. Nochmal?" };

  return { erfolg: true };
}
