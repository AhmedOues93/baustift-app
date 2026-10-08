/**
 * CSV-Import für die Preisliste.
 *
 * Warum das kein Nice-to-have ist: ein Betrieb mit leerer Preisliste bekommt
 * beim ersten Angebot lauter "zu prüfen"-Zeilen. Das Produkt wirkt dann
 * kaputt, obwohl es genau so arbeitet wie gedacht. Fast jeder Handwerker hat
 * seine Preise schon irgendwo in Excel — dieser Import ist der kürzeste Weg
 * vom ersten Login zum ersten brauchbaren Angebot.
 *
 * Absichtlich ohne CSV-Bibliothek: Excel-Exporte aus dem deutschen Raum sind
 * überschaubar (Semikolon oder Komma, Anführungszeichen, CRLF), und ein
 * eigener Parser mit klaren Fehlermeldungen ist hier nützlicher als ein
 * Paket, dessen Meldungen niemand versteht.
 *
 * Eigener Parser heisst aber: er muss CSV auch wirklich können. Die erste
 * Fassung zerlegte die Datei zuerst in Zeilen und erst danach in Felder —
 * damit war jeder Langtext mit Zeilenumbruch abgeschnitten, und dahinter
 * stand eine erfundene Fehlerzeile. Jetzt läuft ein Durchgang über den
 * ganzen Text, und Zeilenumbrüche in Anführungszeichen gehören zum Feld.
 */

import { parsePreis } from "@/lib/format";
import type { Einheit } from "@/types/database";

export interface ImportZeile {
  bezeichnung: string;
  kategorie: string | null;
  einheit: Einheit;
  einzelpreis: number;
  beschreibung: string | null;
  stichworte: string[];
}

export interface ImportErgebnis {
  zeilen: ImportZeile[];
  /** Zeilen, die übersprungen wurden, mit Begründung fürs UI. */
  fehler: { zeile: number; grund: string }[];
  /**
   * Zeilen, die übernommen wurden, bei denen aber etwas geraten werden
   * musste. Die gehören angezeigt: eine stillschweigend auf "Stück"
   * geratene Einheit macht aus 52 €/m² einen Preis von 52 € pro Stück,
   * und das fällt erst im Angebot beim Kunden auf.
   */
  warnungen: { zeile: number; grund: string }[];
}

/**
 * Mehr Zeilen nimmt ein Import nicht an. Eine Handwerker-Preisliste hat
 * selten mehr als ein paar hundert Einträge; alles darüber ist entweder ein
 * Versehen oder eine Datei, die so niemand mehr durchsieht. Der Deckel
 * schützt ausserdem davor, dass ein einziges Insert mit zehntausenden Zeilen
 * die Anfrage sprengt.
 */
export const MAX_ZEILEN = 2000;

/** Schreibweisen, unter denen eine Spalte auftauchen kann. */
const SPALTEN: Record<keyof ImportZeile, string[]> = {
  bezeichnung: ["bezeichnung", "leistung", "artikel", "name", "position", "titel"],
  kategorie: ["kategorie", "gewerk", "gruppe", "bereich"],
  einheit: ["einheit", "einh", "me", "mengeneinheit"],
  einzelpreis: ["preis", "einzelpreis", "ep", "netto", "preis netto", "betrag"],
  beschreibung: ["beschreibung", "text", "langtext", "details"],
  stichworte: ["stichworte", "stichwörter", "schlagworte", "synonyme"],
};

/** Einheiten, wie sie in Excel-Listen geschrieben werden. */
const EINHEITEN: Record<string, Einheit> = {
  stk: "stk", stck: "stk", "st": "stk", stueck: "stk", "stück": "stk", psch: "pauschal",
  pauschal: "pauschal", pausch: "pauschal", pau: "pauschal",
  m: "m", lfm: "m", "lfdm": "m", laufmeter: "m",
  m2: "m2", qm: "m2", "m²": "m2", quadratmeter: "m2",
  m3: "m3", cbm: "m3", "m³": "m3", kubikmeter: "m3",
  h: "h", std: "h", stunde: "h", stunden: "h", akh: "h",
  tag: "tag", tage: "tag", ta: "tag",
  kg: "kg", l: "l", ltr: "l", liter: "l",
};

/**
 * Textdatei aus Rohbytes lesen.
 *
 * Excel exportiert "CSV (Trennzeichen-getrennt)" unter Windows in der Regel
 * NICHT als UTF-8, sondern in der Windows-Codepage 1252. Liest man das als
 * UTF-8, wird aus "Stück" ein "St?ck" — und zwar in der Bezeichnung, die
 * später im Angebot beim Kunden steht. Deshalb wird hier zuerst geprüft, ob
 * die Bytes überhaupt gültiges UTF-8 sind, und sonst auf 1252 zurückgefallen.
 */
export function textAusBytes(bytes: ArrayBuffer | Uint8Array): string {
  const daten = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  // UTF-16 erkennt man an der Bytefolge am Anfang; Excel bietet das als
  // "Unicode-Text" an, und manche speichern genau das als .csv.
  if (daten[0] === 0xff && daten[1] === 0xfe) {
    return new TextDecoder("utf-16le").decode(daten);
  }
  if (daten[0] === 0xfe && daten[1] === 0xff) {
    return new TextDecoder("utf-16be").decode(daten);
  }

  try {
    // `fatal` wirft bei ungültigen Bytefolgen, statt sie durch ein
    // Ersatzzeichen zu ersetzen — genau das brauchen wir als Erkennung.
    return new TextDecoder("utf-8", { fatal: true }).decode(daten);
  } catch {
    return new TextDecoder("windows-1252").decode(daten);
  }
}

/**
 * Den ganzen Text in Datensätze und Felder zerlegen.
 *
 * Ein Zeilenumbruch beendet den Datensatz nur ausserhalb von
 * Anführungszeichen. Innerhalb gehört er zum Feld — das ist der Fall, den
 * jeder Excel-Export mit einem mehrzeiligen Langtext erzeugt.
 */
export function zerlegeDatei(text: string, trenner: string): string[][] {
  const saetze: string[][] = [];
  let felder: string[] = [];
  let aktuell = "";
  let inAnfuehrung = false;

  const satzEnde = () => {
    felder.push(aktuell);
    aktuell = "";
    // Eine Zeile, die nur aus Trennern und Leerraum besteht, ist keine Zeile.
    if (felder.some((f) => f.trim() !== "")) saetze.push(felder.map((f) => f.trim()));
    felder = [];
  };

  for (let i = 0; i < text.length; i++) {
    const z = text[i];

    if (z === '"') {
      // Doppeltes Anführungszeichen innerhalb eines Feldes = ein echtes ".
      if (inAnfuehrung && text[i + 1] === '"') {
        aktuell += '"';
        i++;
      } else {
        inAnfuehrung = !inAnfuehrung;
      }
      continue;
    }

    if (inAnfuehrung) {
      aktuell += z;
      continue;
    }

    if (z === trenner) {
      felder.push(aktuell);
      aktuell = "";
    } else if (z === "\n") {
      satzEnde();
    } else if (z === "\r") {
      // CRLF: das \n macht die Arbeit, das \r wird verworfen.
      if (text[i + 1] !== "\n") satzEnde();
    } else {
      aktuell += z;
    }
  }

  if (aktuell !== "" || felder.length > 0) satzEnde();
  return saetze;
}

/** Eine einzelne Zeile zerlegen — für Tests und die Trennererkennung. */
export function zerlege(zeile: string, trenner: string): string[] {
  return zerlegeDatei(zeile, trenner)[0] ?? [""];
}

/**
 * Semikolon oder Komma? Excel schreibt im deutschsprachigen Raum Semikolon,
 * weil das Komma schon der Dezimaltrenner ist. Wir zählen einfach nach.
 */
export function erkenneTrenner(kopfzeile: string): string {
  const semikolon = (kopfzeile.match(/;/g) ?? []).length;
  const komma = (kopfzeile.match(/,/g) ?? []).length;
  const tab = (kopfzeile.match(/\t/g) ?? []).length;
  if (tab > semikolon && tab > komma) return "\t";
  return semikolon >= komma ? ";" : ",";
}

export function findeSpalte(kopf: string[], kandidaten: string[]): number {
  return kopf.findIndex((k) =>
    kandidaten.includes(k.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, "").trim()),
  );
}

/** Erkennungsmerkmal für eine Dublette: gleiche Leistung in gleicher Einheit. */
export function schluessel(z: Pick<ImportZeile, "bezeichnung" | "einheit">): string {
  return `${z.bezeichnung.toLowerCase().replace(/\s+/g, " ").trim()}|${z.einheit}`;
}

export function parseCsv(inhalt: string): ImportErgebnis {
  // BOM entfernen — Excel schreibt ihn, und sonst heisst die erste Spalte
  // "﻿Bezeichnung" und wird nicht erkannt.
  const text = inhalt.replace(/^﻿/, "");

  const ergebnis: ImportErgebnis = { zeilen: [], fehler: [], warnungen: [] };

  // Für die Trennererkennung reicht die erste physische Zeile.
  const ersteZeile = text.split(/\r?\n/, 1)[0] ?? "";
  const trenner = erkenneTrenner(ersteZeile);
  const saetze = zerlegeDatei(text, trenner);

  if (saetze.length < 2) {
    ergebnis.fehler.push({ zeile: 0, grund: "Die Datei enthält keine Datenzeilen." });
    return ergebnis;
  }

  const kopf = saetze[0];
  const idx = {
    bezeichnung: findeSpalte(kopf, SPALTEN.bezeichnung),
    kategorie: findeSpalte(kopf, SPALTEN.kategorie),
    einheit: findeSpalte(kopf, SPALTEN.einheit),
    einzelpreis: findeSpalte(kopf, SPALTEN.einzelpreis),
    beschreibung: findeSpalte(kopf, SPALTEN.beschreibung),
    stichworte: findeSpalte(kopf, SPALTEN.stichworte),
  };

  if (idx.bezeichnung === -1 || idx.einzelpreis === -1) {
    ergebnis.fehler.push({
      zeile: 1,
      grund:
        "Es fehlt eine Spalte für die Bezeichnung oder den Preis. Erwartet werden Kopfzeilen wie „Bezeichnung“ und „Preis“.",
    });
    return ergebnis;
  }

  /** Schon gesehene Leistungen — gegen Dubletten innerhalb derselben Datei. */
  const gesehen = new Map<string, number>();

  for (let i = 1; i < saetze.length; i++) {
    if (ergebnis.zeilen.length >= MAX_ZEILEN) {
      ergebnis.fehler.push({
        zeile: i + 1,
        grund: `Mehr als ${MAX_ZEILEN} Zeilen — der Rest der Datei wurde nicht gelesen.`,
      });
      break;
    }

    const felder = saetze[i];
    const bezeichnung = felder[idx.bezeichnung] ?? "";
    const preisRoh = felder[idx.einzelpreis] ?? "";

    if (!bezeichnung) {
      ergebnis.fehler.push({ zeile: i + 1, grund: "Keine Bezeichnung." });
      continue;
    }

    const preis = parsePreis(preisRoh);
    if (preis === null) {
      // Ein Minuszeichen ist etwas anderes als Buchstabensalat; wer eine
      // Rabattzeile in der Liste hat, soll wissen, warum sie fehlt.
      const negativ = /^-\s*\d/.test(preisRoh.trim());
      ergebnis.fehler.push({
        zeile: i + 1,
        grund: negativ
          ? `Preis „${preisRoh}“ ist negativ — in der Preisliste stehen nur Preise, Abzüge gehören ins Angebot.`
          : `Preis „${preisRoh}“ nicht lesbar.`,
      });
      continue;
    }

    const einheitRoh = (felder[idx.einheit] ?? "")
      .toLowerCase()
      .replace(/\.$/, "")
      .trim();
    const einheit = EINHEITEN[einheitRoh];

    if (einheitRoh !== "" && einheit === undefined) {
      ergebnis.warnungen.push({
        zeile: i + 1,
        grund: `Einheit „${felder[idx.einheit]}“ ist unbekannt — als Stück übernommen. Bitte in der Liste nachsehen.`,
      });
    }

    const zeile: ImportZeile = {
      bezeichnung,
      kategorie: felder[idx.kategorie]?.trim() || null,
      einheit: einheit ?? "stk",
      einzelpreis: preis,
      beschreibung: felder[idx.beschreibung]?.trim() || null,
      stichworte:
        felder[idx.stichworte]
          ?.split(/[,;/]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20) ?? [],
    };

    const k = schluessel(zeile);
    const schon = gesehen.get(k);
    if (schon !== undefined) {
      ergebnis.fehler.push({
        zeile: i + 1,
        grund: `„${bezeichnung}“ steht schon in Zeile ${schon} derselben Datei.`,
      });
      continue;
    }
    gesehen.set(k, i + 1);

    ergebnis.zeilen.push(zeile);
  }

  return ergebnis;
}
