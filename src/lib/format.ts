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

  let normalisiert: string;

  if (roh.includes(",")) {
    // Eindeutig deutsch: Punkt ist Tausendertrenner, Komma ist Dezimaltrenner.
    normalisiert = roh.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(roh)) {
    // Kein Komma, aber ein Punkt vor genau drei Ziffern: "1.450" meint
    // eintausendvierhundertfünfzig, nicht eins Komma fünfundvierzig.
    // Ohne diese Regel wird aus einer bodengleichen Dusche für 1.450 €
    // stillschweigend eine für 1,45 € — und niemand bemerkt es, bis der
    // Kunde unterschreibt.
    normalisiert = roh.replace(/\./g, "");
  } else {
    // Ein einzelner Punkt mit ein, zwei oder mehr als drei Nachkommastellen
    // ist als Dezimaltrenner gemeint ("89.50" von einer englischen Tastatur).
    normalisiert = roh;
  }

  const zahl = Number(normalisiert);
  if (!Number.isFinite(zahl) || zahl < 0) return null;
  return Math.round(zahl * 100) / 100;
}

/**
 * Eine Menge lesen — mit drei Nachkommastellen.
 *
 * `parsePreis` rundet auf zwei Stellen, weil Geld zwei hat. Mengen haben im
 * Schema drei (`numeric(12,3)`), und das ist kein Zufall: aus dem Aufmass
 * kommen Werte wie 1,005 m³ oder 12,375 m². Wurde so eine Position im
 * Angebot auch nur angefasst, machte `parsePreis` stillschweigend 1,01
 * daraus — aus einem gemessenen Wert wurde ein gerundeter, ohne dass es
 * jemand sah.
 */
export function parseMenge(eingabe: string): number | null {
  const preis = parsePreis(eingabe);
  if (preis === null) return null;

  // parsePreis hat schon normalisiert; hier wird nur die dritte Stelle
  // zurückgeholt, die dort verloren ginge.
  const roh = eingabe.trim().replace(/\s|€/g, "");
  const normalisiert = roh.includes(",")
    ? roh.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(roh)
      ? roh.replace(/\./g, "")
      : roh;

  const zahl = Number(normalisiert);
  if (!Number.isFinite(zahl) || zahl < 0) return null;
  return Math.round(zahl * 1000) / 1000;
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
