/**
 * Bankverbindung pruefen.
 *
 * Eine falsche IBAN faellt im PDF niemandem auf — der Kunde kann nur nicht
 * ueberweisen, und in der E-Rechnung wird sie von der Buchhaltungssoftware
 * des Kunden beanstandet (BR-DE-19). Beides merkt der Handwerker erst, wenn
 * das Geld ausbleibt. Also lieber beim Eintippen pruefen.
 */

/** Grossschreibung, ohne Leerzeichen und Bindestriche. */
export function ibanNormalisieren(roh: string): string {
  return roh.replace(/[\s-]/g, "").toUpperCase();
}

/** Lesbar in Vierergruppen — so steht sie auf jedem Kontoauszug. */
export function ibanFormatieren(roh: string): string {
  return ibanNormalisieren(roh).replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Pruefsumme nach ISO 13616 (Modulo 97). Die Laenge ist je Land fest;
 * geprueft werden die Laender, die bei deutschen Betrieben vorkommen.
 */
const LAENGEN: Record<string, number> = {
  DE: 22, AT: 20, CH: 21, LI: 21, LU: 20, NL: 18, BE: 16, FR: 27,
  IT: 27, ES: 24, PL: 28, CZ: 24, DK: 18, SE: 24, HU: 28, PT: 25,
};

export function ibanGueltig(roh: string): boolean {
  const iban = ibanNormalisieren(roh);
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)) return false;

  const erwartet = LAENGEN[iban.slice(0, 2)];
  if (erwartet !== undefined && iban.length !== erwartet) return false;

  // Die ersten vier Zeichen wandern nach hinten, Buchstaben werden zu Zahlen.
  const umgestellt = iban.slice(4) + iban.slice(0, 4);
  let rest = 0;
  for (const zeichen of umgestellt) {
    const wert = zeichen >= "A" ? (zeichen.charCodeAt(0) - 55).toString() : zeichen;
    for (const ziffer of wert) rest = (rest * 10 + Number(ziffer)) % 97;
  }
  return rest === 1;
}

/** BIC nach ISO 9362 — 8 oder 11 Stellen. */
export function bicGueltig(roh: string): boolean {
  return /^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(roh.replace(/\s/g, "").toUpperCase());
}
