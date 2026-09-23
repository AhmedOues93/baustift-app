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
}

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

/** Eine CSV-Zeile in Felder zerlegen, Anführungszeichen beachtet. */
function zerlege(zeile: string, trenner: string): string[] {
  const felder: string[] = [];
  let aktuell = "";
  let inAnfuehrung = false;

  for (let i = 0; i < zeile.length; i++) {
    const z = zeile[i];
    if (z === '"') {
      // Doppeltes Anführungszeichen innerhalb eines Feldes = ein echtes ".
      if (inAnfuehrung && zeile[i + 1] === '"') {
        aktuell += '"';
        i++;
      } else {
        inAnfuehrung = !inAnfuehrung;
      }
    } else if (z === trenner && !inAnfuehrung) {
      felder.push(aktuell);
      aktuell = "";
    } else {
      aktuell += z;
    }
  }
  felder.push(aktuell);
  return felder.map((f) => f.trim());
}

/**
 * Semikolon oder Komma? Excel schreibt im deutschsprachigen Raum Semikolon,
 * weil das Komma schon der Dezimaltrenner ist. Wir zählen einfach nach.
 */
function erkenneTrenner(kopfzeile: string): string {
  const semikolon = (kopfzeile.match(/;/g) ?? []).length;
  const komma = (kopfzeile.match(/,/g) ?? []).length;
  const tab = (kopfzeile.match(/\t/g) ?? []).length;
  if (tab > semikolon && tab > komma) return "\t";
  return semikolon >= komma ? ";" : ",";
}

function findeSpalte(kopf: string[], kandidaten: string[]): number {
  return kopf.findIndex((k) =>
    kandidaten.includes(k.toLowerCase().replace(/[^a-zäöüß0-9 ]/g, "").trim()),
  );
}

export function parseCsv(inhalt: string): ImportErgebnis {
  // BOM entfernen — Excel schreibt ihn, und sonst heisst die erste Spalte
  // "﻿Bezeichnung" und wird nicht erkannt.
  const text = inhalt.replace(/^﻿/, "");
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim() !== "");

  if (zeilen.length < 2) {
    return {
      zeilen: [],
      fehler: [{ zeile: 0, grund: "Die Datei enthält keine Datenzeilen." }],
    };
  }

  const trenner = erkenneTrenner(zeilen[0]);
  const kopf = zerlege(zeilen[0], trenner);

  const idx = {
    bezeichnung: findeSpalte(kopf, SPALTEN.bezeichnung),
    kategorie: findeSpalte(kopf, SPALTEN.kategorie),
    einheit: findeSpalte(kopf, SPALTEN.einheit),
    einzelpreis: findeSpalte(kopf, SPALTEN.einzelpreis),
    beschreibung: findeSpalte(kopf, SPALTEN.beschreibung),
    stichworte: findeSpalte(kopf, SPALTEN.stichworte),
  };

  if (idx.bezeichnung === -1 || idx.einzelpreis === -1) {
    return {
      zeilen: [],
      fehler: [
        {
          zeile: 1,
          grund:
            "Es fehlt eine Spalte für die Bezeichnung oder den Preis. Erwartet werden Kopfzeilen wie „Bezeichnung“ und „Preis“.",
        },
      ],
    };
  }

  const ergebnis: ImportErgebnis = { zeilen: [], fehler: [] };

  for (let i = 1; i < zeilen.length; i++) {
    const felder = zerlege(zeilen[i], trenner);
    const bezeichnung = felder[idx.bezeichnung] ?? "";
    const preisRoh = felder[idx.einzelpreis] ?? "";

    if (!bezeichnung) {
      ergebnis.fehler.push({ zeile: i + 1, grund: "Keine Bezeichnung." });
      continue;
    }

    const preis = parsePreis(preisRoh);
    if (preis === null) {
      ergebnis.fehler.push({
        zeile: i + 1,
        grund: `Preis „${preisRoh}“ nicht lesbar.`,
      });
      continue;
    }

    const einheitRoh = (felder[idx.einheit] ?? "")
      .toLowerCase()
      .replace(/\.$/, "")
      .trim();

    ergebnis.zeilen.push({
      bezeichnung,
      kategorie: felder[idx.kategorie]?.trim() || null,
      einheit: EINHEITEN[einheitRoh] ?? "stk",
      einzelpreis: preis,
      beschreibung: felder[idx.beschreibung]?.trim() || null,
      stichworte:
        felder[idx.stichworte]
          ?.split(/[,;/]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 20) ?? [],
    });
  }

  return ergebnis;
}
