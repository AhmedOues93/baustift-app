import { describe, expect, it } from "vitest";

import { gruppiere, gruppenName, masseText, wertText } from "./gruppen";
import type { AufmassPosition } from "@/types/database";

/**
 * Vom Aufmass zur Kalkulation.
 *
 * Hier wird aus vielen Massen eine Menge. Ein Fehler beim Abziehen der
 * Fenster kostet den Handwerker bares Geld — oder er verliert den Auftrag,
 * weil er zu teuer ist.
 */

function messung(teil: Partial<AufmassPosition>): AufmassPosition {
  return {
    id: Math.random().toString(36),
    aufmass_id: "a1",
    pos_nr: 1,
    raum: null,
    bezeichnung: "Messung",
    art: "flaeche",
    laenge: null,
    breite: null,
    hoehe: null,
    anzahl: 1,
    abzug: false,
    wert: null,
    einheit: "m2",
    gesprochen: null,
    zu_pruefen: false,
    created_at: "",
    updated_at: "",
    ...teil,
  };
}

describe("gruppiere", () => {
  it("zählt gleiche Einheiten im selben Raum zusammen", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", bezeichnung: "Wand 1", wert: 6 }),
      messung({ raum: "Bad", bezeichnung: "Wand 2", wert: 4.5 }),
    ]);

    expect(gruppen).toHaveLength(1);
    expect(gruppen[0].menge).toBe(10.5);
    expect(gruppen[0].anzahlMessungen).toBe(2);
  });

  it("zieht Abzüge ab", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", bezeichnung: "Wand", wert: 42 }),
      messung({ raum: "Bad", bezeichnung: "Fenster", wert: 1.68, abzug: true }),
      messung({ raum: "Bad", bezeichnung: "Tür", wert: 1.89, abzug: true }),
    ]);

    // 42 − 1,68 − 1,89 = 38,43
    expect(gruppen[0].menge).toBe(38.43);
  });

  it("hält Abzüge in den Einzelheiten sichtbar", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", bezeichnung: "Wand", wert: 42 }),
      messung({
        raum: "Bad", bezeichnung: "Fenster", wert: 1.68, abzug: true,
        laenge: 1.2, breite: 1.4,
      }),
    ]);

    // Der Kunde misst nach und fragt, warum 40,32 statt 42. Die Antwort
    // steht im Angebot.
    expect(gruppen[0].einzelheiten).toContain("− Fenster 1,2 × 1,4");
  });

  it("trennt nach Raum und nach Einheit", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", wert: 6, einheit: "m2" }),
      messung({ raum: "Bad", wert: 8.4, einheit: "m", art: "laenge" }),
      messung({ raum: "Küche", wert: 12, einheit: "m2" }),
    ]);

    expect(gruppen).toHaveLength(3);
    expect(gruppen.map((g) => g.menge)).toEqual([6, 8.4, 12]);
  });

  it("behält die Reihenfolge des Aufmasses", () => {
    // Er ist durchs Haus gegangen; alphabetisch zu sortieren würde diese
    // Reihenfolge zerreissen.
    const gruppen = gruppiere([
      messung({ raum: "Küche", wert: 12 }),
      messung({ raum: "Bad", wert: 6 }),
    ]);
    expect(gruppen.map((g) => g.raum)).toEqual(["Küche", "Bad"]);
  });

  it("überspringt unvollständige Messungen", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", wert: 6 }),
      messung({ raum: "Bad", wert: null }),
    ]);
    expect(gruppen[0].menge).toBe(6);
    expect(gruppen[0].anzahlMessungen).toBe(1);
  });

  it("merkt sich, wenn eine Messung noch zu prüfen ist", () => {
    const gruppen = gruppiere([
      messung({ raum: "Bad", wert: 6 }),
      messung({ raum: "Bad", wert: 2, zu_pruefen: true }),
    ]);
    expect(gruppen[0].zuPruefen).toBe(true);
  });

  it("verträgt ein leeres Aufmass", () => {
    expect(gruppiere([])).toEqual([]);
  });
});

describe("Darstellung", () => {
  it("schreibt Masse deutsch und ohne unnötige Nullen", () => {
    expect(masseText(messung({ laenge: 2.4, breite: 1.8 }))).toBe("2,4 × 1,8");
    expect(masseText(messung({ laenge: 1.2, breite: 1.4, anzahl: 3 }))).toBe(
      "3 × 1,2 × 1,4",
    );
  });

  it("zeigt den Wert mit Einheit", () => {
    expect(wertText(messung({ wert: 4.32, einheit: "m2" }))).toBe("4,32 m²");
    expect(wertText(messung({ wert: null }))).toBe("—");
  });

  it("schlägt einen Namen vor", () => {
    expect(gruppenName(gruppiere([messung({ raum: "Bad", wert: 6 })])[0])).toBe(
      "Bad: Fläche",
    );
    expect(gruppenName(gruppiere([messung({ wert: 6 })])[0])).toBe("Fläche");
  });
});
