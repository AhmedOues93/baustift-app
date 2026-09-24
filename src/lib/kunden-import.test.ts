import { describe, expect, it } from "vitest";

import { parseKundenCsv } from "./kunden-import";

/**
 * Die Dateien kommen aus Excel oder aus alten Handwerkerprogrammen — mit
 * BOM, Semikolon, deutschen Umlauten in den Kopfzeilen und regelmässig
 * doppelten Zeilen.
 */
describe("parseKundenCsv", () => {
  it("liest einen deutschen Excel-Export", () => {
    const csv =
      "﻿Name;Straße;PLZ;Ort;Telefon\r\n" +
      "Familie Becker;Lindenstr. 12;50667;Köln;0221 998877\r\n" +
      "Bäckerei Hof;Marktplatz 3;50676;Köln;\r\n";

    const { zeilen, fehler } = parseKundenCsv(csv);

    expect(fehler).toHaveLength(0);
    expect(zeilen[0]).toMatchObject({
      name: "Familie Becker",
      strasse: "Lindenstr. 12",
      plz: "50667",
      ort: "Köln",
      telefon: "0221 998877",
    });
    // Leere Felder werden null, nicht leerer Text.
    expect(zeilen[1].telefon).toBeNull();
  });

  it("erkennt auch andere übliche Spaltennamen", () => {
    const csv = "Firma,Adresse,Stadt,Mail\nHausverwaltung Nord,Ringstr. 40,Köln,nord@example.de\n";
    const { zeilen } = parseKundenCsv(csv);

    expect(zeilen[0].name).toBe("Hausverwaltung Nord");
    expect(zeilen[0].strasse).toBe("Ringstr. 40");
    expect(zeilen[0].email).toBe("nord@example.de");
  });

  it("überspringt doppelte Namen und meldet sie", () => {
    // Exporte aus alten Programmen enthalten sie regelmässig.
    const csv = "Name\nFamilie Becker\nfamilie becker\n";
    const { zeilen, fehler } = parseKundenCsv(csv);

    expect(zeilen).toHaveLength(1);
    expect(fehler[0].grund).toContain("doppelt");
  });

  it("überspringt Zeilen ohne Namen, statt abzubrechen", () => {
    const csv = "Name;Ort\nBecker;Köln\n;Düsseldorf\nHof;Köln\n";
    const { zeilen, fehler } = parseKundenCsv(csv);

    expect(zeilen).toHaveLength(2);
    expect(fehler).toHaveLength(1);
    expect(fehler[0].zeile).toBe(3);
  });

  it("sagt klar, wenn die Kopfzeile nicht passt", () => {
    const { zeilen, fehler } = parseKundenCsv("Spalte A;Spalte B\nx;y\n");

    expect(zeilen).toHaveLength(0);
    expect(fehler[0].grund).toContain("Name");
  });

  it("beachtet Anführungszeichen um Felder mit Trennzeichen", () => {
    const csv = 'Name;Notizen\nBecker;"Schlüssel bei Nachbarin; klingeln"\n';
    const { zeilen } = parseKundenCsv(csv);
    expect(zeilen[0].notizen).toBe("Schlüssel bei Nachbarin; klingeln");
  });
});
