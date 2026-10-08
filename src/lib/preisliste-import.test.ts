import { describe, expect, it } from "vitest";

import { MAX_ZEILEN, parseCsv, textAusBytes } from "./preisliste-import";

/**
 * Die Dateien kommen aus Excel von echten Betrieben — mit BOM, Semikolon,
 * Umlauten in den Kopfzeilen und Preisen in deutscher Schreibweise.
 */
describe("parseCsv", () => {
  it("liest einen deutschen Excel-Export", () => {
    const csv =
      "﻿Bezeichnung;Kategorie;Einheit;Preis\r\n" +
      "Fliesen verlegen 30x60;Fliesenarbeiten;qm;52,00\r\n" +
      "Monteurstunde;Arbeitszeit;Std.;62,00\r\n";

    const { zeilen, fehler } = parseCsv(csv);

    expect(fehler).toHaveLength(0);
    expect(zeilen).toHaveLength(2);
    expect(zeilen[0]).toMatchObject({
      bezeichnung: "Fliesen verlegen 30x60",
      kategorie: "Fliesenarbeiten",
      // "qm" ist die Schreibweise, die in Handwerkerlisten wirklich steht.
      einheit: "m2",
      einzelpreis: 52,
    });
    expect(zeilen[1].einheit).toBe("h");
  });

  it("kommt auch mit Komma-getrennten Dateien zurecht", () => {
    const csv = "Leistung,Preis\nDuschwanne montieren,189.00\n";
    const { zeilen } = parseCsv(csv);
    expect(zeilen[0].einzelpreis).toBe(189);
  });

  it("beachtet Anführungszeichen um Felder mit Trennzeichen", () => {
    const csv = 'Bezeichnung;Preis\n"Fliesen 30x60, rutschhemmend";52,00\n';
    const { zeilen } = parseCsv(csv);
    expect(zeilen[0].bezeichnung).toBe("Fliesen 30x60, rutschhemmend");
  });

  it("überspringt kaputte Zeilen und meldet sie, statt alles abzubrechen", () => {
    const csv =
      "Bezeichnung;Preis\n" +
      "Gute Zeile;52,00\n" +
      ";10,00\n" +
      "Ohne Preis;keine Ahnung\n";

    const { zeilen, fehler } = parseCsv(csv);

    // Ein Tippfehler in Zeile 40 darf nicht den Import der anderen 39 kosten.
    expect(zeilen).toHaveLength(1);
    expect(fehler).toHaveLength(2);
    expect(fehler[0].zeile).toBe(3);
  });

  it("sagt klar, wenn die Kopfzeile nicht passt", () => {
    const { zeilen, fehler } = parseCsv("Spalte A;Spalte B\nx;y\n");
    expect(zeilen).toHaveLength(0);
    expect(fehler[0].grund).toContain("Bezeichnung");
  });

  it("zerlegt Stichworte", () => {
    const csv = "Bezeichnung;Preis;Stichworte\nFliesen;52,00;bad fliesen, verfliesen\n";
    const { zeilen } = parseCsv(csv);
    expect(zeilen[0].stichworte).toEqual(["bad fliesen", "verfliesen"]);
  });
});

/**
 * =============================================================================
 * Fälle aus echten Excel-Exporten
 * =============================================================================
 * Alle fünf hier geprüften Punkte waren vorher kaputt und sind an einer
 * echten Datei nachgestellt worden, nicht ausgedacht.
 */

describe("mehrzeilige Felder", () => {
  it("behält einen Langtext mit Zeilenumbruch vollständig", () => {
    // Vorher: der Text wurde nach der ersten Zeile abgeschnitten, und
    // dahinter stand eine erfundene Fehlerzeile „Preis nicht lesbar“.
    const ergebnis = parseCsv(
      'Bezeichnung;Preis;Beschreibung\n"Fliesen verlegen";48,00;"Untergrund vorbereiten.\nFugen verschliessen."\nWC tauschen;380,00;kurz\n',
    );

    expect(ergebnis.fehler).toEqual([]);
    expect(ergebnis.zeilen).toHaveLength(2);
    expect(ergebnis.zeilen[0].beschreibung).toBe(
      "Untergrund vorbereiten.\nFugen verschliessen.",
    );
    expect(ergebnis.zeilen[1].bezeichnung).toBe("WC tauschen");
  });

  it("versteht ein doppeltes Anführungszeichen im Feld", () => {
    const ergebnis = parseCsv('Bezeichnung;Preis\n"Rohr 1"" verzinkt";12,50\n');
    expect(ergebnis.zeilen[0].bezeichnung).toBe('Rohr 1" verzinkt');
  });

  it("nimmt auch einen Trenner im Anführungszeichen hin", () => {
    const ergebnis = parseCsv('Bezeichnung;Preis\n"Fliesen 30;60";48\n');
    expect(ergebnis.zeilen[0].bezeichnung).toBe("Fliesen 30;60");
  });
});

describe("Zeichensatz", () => {
  it("liest eine Datei aus Excel unter Windows richtig", () => {
    // Excel speichert "CSV (Trennzeichen-getrennt)" in Codepage 1252.
    // Als UTF-8 gelesen wurde aus "Stück" ein "St?ck" — und das stand
    // dann so im Angebot beim Kunden.
    const bytes = Buffer.from("Bezeichnung;Preis\nStück Rohr 1/2 Zoll;9,90\n", "latin1");
    const ergebnis = parseCsv(textAusBytes(bytes));

    expect(ergebnis.zeilen[0].bezeichnung).toBe("Stück Rohr 1/2 Zoll");
  });

  it("liest eine UTF-8-Datei unverändert", () => {
    const bytes = Buffer.from("Bezeichnung;Preis\nStück Rohr;9,90\n", "utf8");
    expect(parseCsv(textAusBytes(bytes)).zeilen[0].bezeichnung).toBe("Stück Rohr");
  });

  it("entfernt die Bytefolge am Dateianfang", () => {
    const bytes = Buffer.from("﻿Bezeichnung;Preis\nFliesen;48\n", "utf8");
    const ergebnis = parseCsv(textAusBytes(bytes));
    expect(ergebnis.zeilen).toHaveLength(1);
  });

  it("liest auch eine als Unicode gespeicherte Datei", () => {
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from("Bezeichnung;Preis\nStück Rohr;9,90\n", "utf16le"),
    ]);
    expect(parseCsv(textAusBytes(bytes)).zeilen[0].bezeichnung).toBe("Stück Rohr");
  });
});

describe("Einheiten", () => {
  it("meldet eine unbekannte Einheit, statt stillschweigend Stück zu nehmen", () => {
    // 52 €/m² als 52 €/Stück zu führen macht aus einem Bad von 8 m²
    // ein Angebot über 52 € statt 416 €. Das fällt erst beim Kunden auf.
    const ergebnis = parseCsv("Bezeichnung;Preis;Einheit\nFliesen;52;Quadratmter\n");

    expect(ergebnis.zeilen).toHaveLength(1);
    expect(ergebnis.zeilen[0].einheit).toBe("stk");
    expect(ergebnis.warnungen).toHaveLength(1);
    expect(ergebnis.warnungen[0].grund).toContain("Quadratmter");
  });

  it("schweigt bei einer leeren Einheit — Stück ist dann die Vorgabe", () => {
    const ergebnis = parseCsv("Bezeichnung;Preis;Einheit\nWC tauschen;380;\n");
    expect(ergebnis.warnungen).toEqual([]);
    expect(ergebnis.zeilen[0].einheit).toBe("stk");
  });
});

describe("Dubletten in derselben Datei", () => {
  it("nimmt dieselbe Leistung nur einmal", () => {
    const ergebnis = parseCsv(
      "Bezeichnung;Preis;Einheit\nFliesen verlegen;48;qm\nFliesen verlegen;52;qm\n",
    );

    expect(ergebnis.zeilen).toHaveLength(1);
    expect(ergebnis.fehler[0].grund).toContain("Zeile 2");
  });

  it("unterscheidet dieselbe Leistung in anderer Einheit", () => {
    // "Rohr" als Meterware und als Stück sind zwei echte Positionen.
    const ergebnis = parseCsv("Bezeichnung;Preis;Einheit\nRohr;9;m\nRohr;12;stk\n");
    expect(ergebnis.zeilen).toHaveLength(2);
  });
});

describe("Preise", () => {
  it("nennt einen negativen Preis beim Namen", () => {
    const ergebnis = parseCsv("Bezeichnung;Preis\nNachlass;-50,00\n");
    expect(ergebnis.fehler[0].grund).toContain("negativ");
  });
});

describe("Umfang", () => {
  it("hört nach der Obergrenze auf und sagt es", () => {
    const viele = ["Bezeichnung;Preis"];
    for (let i = 0; i < MAX_ZEILEN + 50; i++) viele.push(`Leistung ${i};10`);

    const ergebnis = parseCsv(viele.join("\n"));

    expect(ergebnis.zeilen).toHaveLength(MAX_ZEILEN);
    expect(ergebnis.fehler.at(-1)?.grund).toContain(String(MAX_ZEILEN));
  });
});
