/**
 * Formatierung und Parsing für deutsche Zahlen- und Geldangaben.
 *
 * Eigenes Modul, weil "use server"-Dateien ausschliesslich async Funktionen
 * exportieren dürfen — und weil diese Helfer sowohl im Browser als auch auf
 * dem Server gebraucht werden.
 */

/**
 * Deutsche Preiseingabe in eine Zahl umwandeln.
 * Auf dem Handy tippt niemand "1234.50" — es kommt "1.234,50" oder "89,5".
 * Ohne diese Normalisierung landet aus "89,50" eine 89 oder ein NaN in der DB.
 *
 * Gibt `null` zurück, wenn die Eingabe keine gültige, nicht-negative Zahl ist.
 */
export function parsePreis(eingabe: string): number | null {
  const roh = eingabe.trim().replace(/\s|€/g, "");
  if (!roh) return null;

  // Tausenderpunkte entfernen, Komma zum Dezimaltrenner machen.
  const normalisiert = roh.includes(",")
    ? roh.replace(/\./g, "").replace(",", ".")
    : roh;

  const zahl = Number(normalisiert);
  if (!Number.isFinite(zahl) || zahl < 0) return null;
  return Math.round(zahl * 100) / 100;
}

const EURO = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** 89.5 → "89,50 €" */
export function formatEuro(n: number): string {
  return EURO.format(n);
}

/** 89.5 → "89,50" (für Eingabefelder, ohne Währungszeichen) */
export function formatPreisEingabe(n: number): string {
  return n.toFixed(2).replace(".", ",");
}
