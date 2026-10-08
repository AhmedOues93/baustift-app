import { describe, expect, it } from "vitest";

import { formatEuro, formatPreisEingabe, parseMenge, parsePreis } from "./format";

/**
 * Eingaben aus der Praxis. Ein falsch gelesener Preis fällt niemandem auf —
 * er steht einfach im Angebot.
 */
describe("parsePreis", () => {
  it("liest die deutsche Schreibweise", () => {
    expect(parsePreis("89,50")).toBe(89.5);
    expect(parsePreis("1.234,50")).toBe(1234.5);
  });

  it("liest den Punkt als Tausendertrenner, wenn drei Ziffern folgen", () => {
    // Der teuerste Fehler der ganzen App: aus 1.450 € würde sonst 1,45 €.
    expect(parsePreis("1.450")).toBe(1450);
    expect(parsePreis("12.000")).toBe(12000);
    expect(parsePreis("1.234.567")).toBe(1234567);
  });

  it("liest auch die englische Schreibweise", () => {
    expect(parsePreis("89.50")).toBe(89.5);
  });

  it("verträgt Leerzeichen und Eurozeichen", () => {
    expect(parsePreis(" 89,50 € ")).toBe(89.5);
  });

  it("rundet auf Cent", () => {
    expect(parsePreis("10,999")).toBe(11);
  });

  it("weist Unbrauchbares zurück, statt 0 zu liefern", () => {
    // Wichtig: null und nicht 0 — sonst landet stillschweigend ein
    // Nullpreis im Angebot.
    expect(parsePreis("")).toBeNull();
    expect(parsePreis("abc")).toBeNull();
    expect(parsePreis("-5")).toBeNull();
  });
});

describe("formatEuro", () => {
  it("formatiert deutsch", () => {
    // Geschütztes Leerzeichen vor dem Eurozeichen — daher der Vergleich
    // ohne Rücksicht auf die Art des Leerzeichens.
    expect(formatEuro(1234.5).replace(/\s/g, " ")).toBe("1.234,50 €");
    expect(formatEuro(0).replace(/\s/g, " ")).toBe("0,00 €");
  });
});

describe("formatPreisEingabe", () => {
  it("gibt den Wert so aus, wie er wieder eingelesen werden kann", () => {
    const wert = 1234.5;
    expect(parsePreis(formatPreisEingabe(wert))).toBe(wert);
  });
});

describe("parseMenge", () => {
  it("behält die dritte Nachkommastelle", () => {
    // Aus dem Aufmass kommen Werte wie 1,005 m³. parsePreis hätte daraus
    // stillschweigend 1,01 gemacht — ein gemessener Wert wird zum geratenen.
    expect(parseMenge("1,005")).toBe(1.005);
    expect(parseMenge("12,375")).toBe(12.375);
    expect(parseMenge("0,125")).toBe(0.125);
  });

  it("rundet erst ab der vierten Stelle — so weit reicht das Schema", () => {
    expect(parseMenge("1,0054")).toBe(1.005);
    expect(parseMenge("1,0056")).toBe(1.006);
  });

  it("versteht dieselben Schreibweisen wie ein Preis", () => {
    expect(parseMenge("8")).toBe(8);
    expect(parseMenge("1.250")).toBe(1250);
    expect(parseMenge("2.5")).toBe(2.5);
  });

  it("weist Unsinn und negative Mengen ab", () => {
    expect(parseMenge("")).toBeNull();
    expect(parseMenge("keine Ahnung")).toBeNull();
    expect(parseMenge("-3")).toBeNull();
  });
});
