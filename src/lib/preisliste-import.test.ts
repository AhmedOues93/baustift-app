import { describe, expect, it } from "vitest";

import { parseCsv } from "./preisliste-import";

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
