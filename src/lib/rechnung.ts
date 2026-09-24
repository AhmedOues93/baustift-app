import type { Rechnung } from "@/types/database";

/**
 * Regeln rund um den Zahlungsstand.
 *
 * Bewusst in einer eigenen Datei und ohne Server-Bindung: dieselbe Frage
 * stellt die Liste, der Einzelbildschirm und die Action, die erinnert. Drei
 * Kopien derselben Datumsrechnung wären drei Gelegenheiten, dass die Liste
 * etwas anderes behauptet als der Knopf.
 */

/**
 * Gestellt, Zahlungsziel vorbei, noch kein Geld da.
 *
 * Verglichen wird auf Tagesebene über die ISO-Zeichenketten: am
 * Fälligkeitstag selbst ist nichts überfällig, erst am Tag danach. Ein
 * Vergleich über Date-Objekte würde hier je nach Uhrzeit und Zeitzone
 * kippen — und dann geht eine Erinnerung einen Tag zu früh raus.
 */
export function istUeberfaellig(faelligAm: string | null): boolean {
  if (!faelligAm) return false;
  return faelligAm.slice(0, 10) < new Date().toISOString().slice(0, 10);
}

/** Dasselbe für eine ganze Rechnung: nur gestellte können überfällig sein. */
export function rechnungUeberfaellig(
  r: Pick<Rechnung, "status" | "faellig_am">,
): boolean {
  return r.status === "gestellt" && istUeberfaellig(r.faellig_am);
}

/** Wie viele Tage überfällig. 0, wenn das Zahlungsziel noch läuft. */
export function tageUeberfaellig(faelligAm: string | null): number {
  if (!istUeberfaellig(faelligAm)) return 0;
  const tag = 24 * 60 * 60 * 1000;
  const faellig = Date.parse(`${faelligAm!.slice(0, 10)}T00:00:00Z`);
  const heute = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((heute - faellig) / tag);
}
