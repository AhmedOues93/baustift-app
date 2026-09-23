import { describe, expect, it } from "vitest";

import { formatEuro, formatPreisEingabe, parsePreis } from "./format";

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
