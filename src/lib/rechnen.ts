/**
 * =============================================================================
 * Geldbeträge rechnen — so, wie die Datenbank es tut
 * =============================================================================
 * Es gibt im Angebot zwei Stellen, an denen gerechnet wird: im Bildschirm,
 * damit der Handwerker beim Tippen sofort die Summe sieht, und in Postgres,
 * wo `gesamtpreis` eine generierte Spalte ist und ein Trigger netto, MwSt und
 * brutto setzt. Aus der Datenbank kommt, was im PDF steht und was der Kunde
 * bekommt.
 *
 * Beide rechneten verschieden. Postgres rundet exakt und kaufmännisch (die
 * Hälfte vom Nullpunkt weg); JavaScript rechnete mit Gleitkommazahlen, und
 * `Math.round(0.135 * 100) / 100` ergibt 0,13 statt 0,14, weil es 0,135 im
 * Binärformat gar nicht gibt.
 *
 * Nachgemessen an 30 000 realistischen Kombinationen aus Menge und
 * Einzelpreis: 388 davon — 1,3 % — wichen ab. Immer um einen Cent, immer so,
 * dass der Bildschirm weniger zeigte als das PDF. Niemand prüft eine Summe
 * auf den Cent gegen; auffallen würde es erst, wenn der Kunde nachrechnet.
 *
 * Deshalb hier Ganzzahl-Arithmetik. Das Schema gibt die Stellen vor:
 * `menge numeric(12,3)`, `einzelpreis numeric(12,2)`. In Tausendsteln bzw.
 * Hundertsteln gerechnet sind das ganze Zahlen — und ganze Zahlen haben kein
 * Rundungsproblem.
 */

/**
 * Kaufmännisch runden auf die ganze Zahl: die Hälfte vom Nullpunkt weg,
 * genau wie Postgres `round(numeric, n)`.
 */
function kaufmaennisch(ganz: number, rest: number, nenner: number, negativ: boolean): number {
  const auf = Math.abs(rest) * 2 >= nenner ? ganz + 1 : ganz;
  return negativ ? -auf : auf;
}

/**
 * Eine Zahl mit bekannter Stellenzahl als ganze Zahl.
 *
 * `Math.round` fängt hier nur die Darstellungsungenauigkeit ab (2,5 liegt als
 * 2.4999999999999996 im Speicher); die Stelle selbst ist laut Schema schon
 * vorhanden, es wird also nichts weggerundet, was zählt.
 */
function alsGanzzahl(wert: number, stellen: number): number {
  return Number.isFinite(wert) ? Math.round(wert * stellen) : 0;
}

/**
 * Zeilensumme: Menge × Einzelpreis, auf den Cent.
 *
 * Entspricht Zeichen für Zeichen der generierten Spalte
 * `round(menge * einzelpreis, 2)`.
 *
 * Gerechnet wird `m · p / 1000` mit ganzen Zahlen, aufgeteilt in ganze und
 * gebrochene Mengeneinheiten. Das hält jedes Zwischenergebnis weit unter der
 * Grenze, ab der JavaScript ganze Zahlen nicht mehr genau darstellt — ohne
 * BigInt, das hier bei jedem Tastendruck im Angebot liefe.
 */
export function zeilensumme(menge: number, einzelpreis: number): number {
  const m = alsGanzzahl(menge, 1000); // Tausendstel
  const p = alsGanzzahl(einzelpreis, 100); // Hundertstel
  const negativ = m * p < 0;
  const mAbs = Math.abs(m);
  const pAbs = Math.abs(p);

  const ganzeEinheiten = Math.floor(mAbs / 1000);
  const restEinheiten = mAbs - ganzeEinheiten * 1000; // 0 … 999

  const ausGanzen = ganzeEinheiten * pAbs; // schon in Cent
  const ausRest = restEinheiten * pAbs; // in Tausendstel-Cent
  const cent = ausGanzen + Math.floor(ausRest / 1000);
  const rest = ausRest % 1000;

  return kaufmaennisch(cent, rest, 1000, negativ) / 100;
}

/**
 * Summe mehrerer Zeilen.
 *
 * Jede Zeile wird einzeln gerundet und erst danach addiert — genau wie
 * `sum(gesamtpreis)` über die generierte Spalte. Addiert wird in Cent, damit
 * nicht am Ende doch wieder Gleitkomma-Reste zusammenkommen.
 */
export function nettosumme(
  zeilen: readonly { menge: number; einzelpreis: number }[],
): number {
  let cent = 0;
  for (const z of zeilen) cent += alsGanzzahl(zeilensumme(z.menge, z.einzelpreis), 100);
  return cent / 100;
}

/**
 * Umsatzsteuer auf einen Nettobetrag.
 *
 * Entspricht dem Trigger: `round(netto * satz / 100, 2)`.
 */
export function mwstBetrag(netto: number, satz: number): number {
  const n = alsGanzzahl(netto, 100); // Cent
  const s = alsGanzzahl(satz, 100); // Hundertstel Prozent
  const negativ = n * s < 0;
  const produkt = Math.abs(n) * Math.abs(s); // Cent · Hundertstel Prozent

  const cent = Math.floor(produkt / 10_000);
  const rest = produkt % 10_000;

  return kaufmaennisch(cent, rest, 10_000, negativ) / 100;
}

/** Netto, Umsatzsteuer und Brutto in einem Rutsch — die Summenzeile. */
export function summen(
  zeilen: readonly { menge: number; einzelpreis: number }[],
  mwstSatz: number,
): { netto: number; mwst: number; brutto: number } {
  const netto = nettosumme(zeilen);
  const mwst = mwstBetrag(netto, mwstSatz);
  // Brutto wird nicht nochmal gerundet — der Trigger addiert ebenfalls nur.
  return {
    netto,
    mwst,
    brutto: (alsGanzzahl(netto, 100) + alsGanzzahl(mwst, 100)) / 100,
  };
}
