import { describe, expect, it } from "vitest";

import { bicGueltig, ibanFormatieren, ibanGueltig, ibanNormalisieren } from "./bank";

describe("IBAN", () => {
  it("nimmt echte deutsche IBANs an, egal wie getippt", () => {
    expect(ibanGueltig("DE89 3704 0044 0532 0130 00")).toBe(true);
    expect(ibanGueltig("de89370400440532013000")).toBe(true);
    expect(ibanGueltig("DE89-3704-0044-0532-0130-00")).toBe(true);
  });

  it("erkennt einen Zahlendreher an der Pruefsumme", () => {
    // Die Ziffern 13 und 31 vertauscht — sonst identisch.
    expect(ibanGueltig("DE89 3704 0044 0532 0310 00")).toBe(false);
  });

  it("weist die falsche Pruefzahl ab", () => {
    expect(ibanGueltig("DE88 3704 0044 0532 0130 00")).toBe(false);
  });

  it("weist eine zu kurze deutsche IBAN ab", () => {
    expect(ibanGueltig("DE89 3704 0044 0532 0130")).toBe(false);
  });

  it("prueft auch Nachbarlaender", () => {
    expect(ibanGueltig("AT61 1904 3002 3457 3201")).toBe(true);
    expect(ibanGueltig("CH93 0076 2011 6238 5295 7")).toBe(true);
  });

  it("weist Unsinn ab, ohne zu stolpern", () => {
    for (const unsinn of ["", "   ", "Sparkasse", "1234567890", "DEXX370400440532013000"]) {
      expect(ibanGueltig(unsinn), unsinn).toBe(false);
    }
  });

  it("stellt lesbar in Vierergruppen dar", () => {
    expect(ibanFormatieren("de89370400440532013000")).toBe("DE89 3704 0044 0532 0130 00");
    expect(ibanNormalisieren("DE89 3704 0044 0532 0130 00")).toBe("DE89370400440532013000");
  });
});

describe("BIC", () => {
  it("nimmt 8 und 11 Stellen", () => {
    expect(bicGueltig("COBADEFFXXX")).toBe(true);
    expect(bicGueltig("colsde33")).toBe(true);
  });

  it("weist falsche Laengen und Ziffern am Anfang ab", () => {
    expect(bicGueltig("COLSDE3")).toBe(false);
    expect(bicGueltig("1OLSDE33")).toBe(false);
  });
});
