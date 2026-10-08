import type { createClient } from "@/lib/supabase/server";

/**
 * =============================================================================
 * Das Prüftor
 * =============================================================================
 * Eine Position, die die KI nicht sicher zuordnen konnte, ist gelb markiert.
 * Bis hierher war das ein Hinweis — versenden liess sich das Angebot
 * trotzdem. Das ist die eine Stelle, an der ein stiller Fehler teuer wird:
 * eine Zeile ohne Preis oder mit einem geratenen geht als verbindliches
 * Angebot zum Kunden, und daran ist der Handwerker gebunden.
 *
 * Deshalb sperrt diese Prüfung alles, was das Angebot aus dem Haus lässt:
 * E-Mail-Versand, "als gesendet markieren" und die Umwandlung in eine
 * Rechnung. Sie steht auf dem Server und nicht nur im Bildschirm — ein Knopf,
 * der ausgegraut ist, ist keine Sperre.
 *
 * Aufgehoben wird sie nur durch eine ausdrückliche Bestätigung des
 * Handwerkers (siehe `positionenBestaetigen`) oder dadurch, dass er die
 * Zeilen einzeln anfasst. Beides ist eine Entscheidung, kein Versehen.
 */
export async function offenePruefungen(
  supabase: Awaited<ReturnType<typeof createClient>>,
  angebotId: string,
): Promise<number> {
  const { count } = await supabase
    .from("positionen")
    .select("id", { count: "exact", head: true })
    .eq("angebot_id", angebotId)
    .eq("zu_pruefen", true);

  return count ?? 0;
}

/** Die Meldung dazu — an drei Stellen gebraucht, also an einer Stelle formuliert. */
export function pruefHinweis(anzahl: number): string {
  return anzahl === 1
    ? "Eine Position ist noch zu prüfen. Bestätige sie, bevor das Angebot rausgeht."
    : `${anzahl} Positionen sind noch zu prüfen. Bestätige sie, bevor das Angebot rausgeht.`;
}

/**
 * Was hält dieses Angebot davon ab, aus dem Haus zu gehen?
 *
 * Gibt den Grund im Klartext zurück oder `null`, wenn nichts dagegenspricht.
 * Zwei Gründe:
 *
 *  - Es ist noch etwas zu prüfen (siehe oben).
 *  - Es steht gar nichts drin. Ein Angebot ohne Positionen ist ein PDF mit
 *    einem Briefkopf und 0,00 € darunter. Das ging bisher raus: die
 *    Prüfsperre zählte nur offene Positionen, und null offene Positionen
 *    sind auch dann null, wenn es überhaupt keine gibt.
 */
export async function versandSperre(
  supabase: Awaited<ReturnType<typeof createClient>>,
  angebotId: string,
): Promise<string | null> {
  const { count: gesamt } = await supabase
    .from("positionen")
    .select("id", { count: "exact", head: true })
    .eq("angebot_id", angebotId);

  if ((gesamt ?? 0) === 0) {
    return "Das Angebot hat noch keine Positionen. Trage ein, was du anbietest.";
  }

  const offen = await offenePruefungen(supabase, angebotId);
  return offen > 0 ? pruefHinweis(offen) : null;
}
