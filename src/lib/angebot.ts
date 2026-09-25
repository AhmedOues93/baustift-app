import type { Angebot } from "@/types/database";

/**
 * Regeln rund ums Nachfassen.
 *
 * Eigene Datei ohne Server-Bindung, wie bei den Rechnungen: dieselbe Frage
 * stellen die Liste, der Einzelbildschirm und die Action, die nachhakt. Drei
 * Kopien wären drei Gelegenheiten, dass die Liste etwas anderes behauptet
 * als der Knopf.
 */

/**
 * Ab wann gilt ein verschicktes Angebot als "liegt zu lange"?
 *
 * Eine Woche ist im Handwerk die Grenze, ab der ein Kunde entweder vergessen
 * hat oder sich woanders umsieht. Früher wirkt es gedrängelt, später ist der
 * Auftrag vergeben.
 */
export const NACHFASSEN_NACH_TAGEN = 7;

/** Tage zwischen zwei Nachfragen — zweimal in einer Woche ist zu viel. */
const ABSTAND_TAGE = 7;

/**
 * Wartet dieses Angebot auf eine Nachfrage?
 *
 * Nur verschickte Angebote ohne Entscheidung. Und nach einer Nachfrage
 * beginnt die Frist von vorn: sonst stünde das Angebot am Tag nach dem
 * Nachhaken wieder auf der Liste.
 */
export function istNachfassFaellig(
  a: Pick<Angebot, "status" | "gesendet_am" | "nachgefasst_am">,
): boolean {
  if (a.status !== "gesendet" || !a.gesendet_am) return false;
  const seit = a.nachgefasst_am ?? a.gesendet_am;
  return tageSeit(seit) >= (a.nachgefasst_am ? ABSTAND_TAGE : NACHFASSEN_NACH_TAGEN);
}

/** Wie viele Tage ist das Angebot beim Kunden, ohne dass etwas passiert? */
export function tageOhneAntwort(
  a: Pick<Angebot, "status" | "gesendet_am">,
): number {
  if (a.status !== "gesendet" || !a.gesendet_am) return 0;
  return tageSeit(a.gesendet_am);
}

function tageSeit(zeitpunkt: string): number {
  return Math.floor((Date.now() - new Date(zeitpunkt).getTime()) / 86_400_000);
}
