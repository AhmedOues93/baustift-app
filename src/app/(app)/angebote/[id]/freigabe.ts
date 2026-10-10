import { publicEnv } from "@/lib/env";

/**
 * Der Link, unter dem der Kunde das Angebot sieht und entscheidet.
 *
 * An einer Stelle gebaut, weil ihn die E-Mail, die Teilen-Funktion und der
 * Bildschirm des Handwerkers brauchen — und drei Varianten davon wären drei
 * Gelegenheiten, dass eine davon ins Leere führt.
 */
export function freigabeLink(token: string): string {
  return `${publicEnv.siteUrl}/angebot/${token}`;
}
