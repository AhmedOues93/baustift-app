import { describe, expect, it } from "vitest";

import { mwstBetrag, nettosumme, summen, zeilensumme } from "./rechnen";

/**
 * Die Vergleichswerte stammen nicht aus dem Kopf, sondern aus Postgres.
 * supabase/test/20_rechnen.sql prüft dieselben Regeln noch einmal gegen eine
 * echte Datenbank — hier stehen die Fälle, die vorher falsch waren.
 */

describe("Zeilensumme", () => {
  it("rechnet die Fälle richtig, die vorher einen Cent verloren", () => {
    // Alle vier wurden an echtem Postgres nachgemessen.
    expect(zeilensumme(1.005, 1.0)).toBe(1.01);
    expect(zeilensumme(0.018, 7.5)).toBe(0.14);
    expect(zeilensumme(0.019, 65)).toBe(1.24);
    expect(zeilensumme(0.022, 2.5)).toBe(0.06);
  });

  it("rechnet die alltäglichen Fälle wie erwartet", () => {
    expect(zeilensumme(8, 65)).toBe(520);
    expect(zeilensumme(1, 1450)).toBe(1450);
    expect(zeilensumme(12.5, 48)).toBe(600);
    expect(zeilensumme(2.25, 17.85)).toBe(40.16);
  });

  it("rundet kaufmännisch, also die Hälfte nach oben", () => {
    // Postgres rundet die Hälfte vom Nullpunkt weg. Vorher entschied hier
    // die Binärdarstellung, und die liegt mal darüber, mal darunter.
    expect(zeilensumme(0.125, 1)).toBe(0.13);
    expect(zeilensumme(0.135, 1)).toBe(0.14);
    expect(zeilensumme(0.145, 1)).toBe(0.15);
  });

  it("kommt mit null und leeren Werten zurecht", () => {
    expect(zeilensumme(0, 100)).toBe(0);
    expect(zeilensumme(5, 0)).toBe(0);
    expect(zeilensumme(Number.NaN, 10)).toBe(0);
  });

  it("verkraftet grosse Positionen ohne Genauigkeitsverlust", () => {
    // Gegengerechnet in Postgres: round(9999.999 * 999.99, 2) = 9999899.00.
    expect(zeilensumme(9999.999, 999.99)).toBe(9999899);
  });
});

describe("Nettosumme", () => {
  it("rundet jede Zeile einzeln — wie sum(gesamtpreis)", () => {
    // Zwei Zeilen zu je 0,125: die Datenbank rundet jede für sich auf
    // 0,13 und summiert 0,26. Wer erst summiert und dann rundet, bekommt
    // 0,25 — und damit eine andere Summe als im PDF.
    const zeilen = [
      { menge: 0.125, einzelpreis: 1 },
      { menge: 0.125, einzelpreis: 1 },
    ];
    expect(nettosumme(zeilen)).toBe(0.26);
  });

  it("addiert ohne Gleitkomma-Reste", () => {
    const zeilen = Array.from({ length: 100 }, () => ({ menge: 1, einzelpreis: 0.1 }));
    expect(nettosumme(zeilen)).toBe(10);
  });

  it("ist bei einer leeren Liste null", () => {
    expect(nettosumme([])).toBe(0);
  });
});

describe("Umsatzsteuer", () => {
  it("entspricht dem Trigger round(netto * satz / 100, 2)", () => {
    expect(mwstBetrag(0.5, 19)).toBe(0.1);
    expect(mwstBetrag(2.5, 19)).toBe(0.48);
    expect(mwstBetrag(7.5, 19)).toBe(1.43);
    expect(mwstBetrag(2754, 19)).toBe(523.26);
  });

  it("kennt die anderen Sätze", () => {
    expect(mwstBetrag(100, 7)).toBe(7);
    expect(mwstBetrag(100, 0)).toBe(0);
    expect(mwstBetrag(100, 5.5)).toBe(5.5);
  });
});

describe("Summenzeile", () => {
  it("liefert netto, MwSt und brutto zusammenhängend", () => {
    const zeilen = [
      { menge: 8, einzelpreis: 28 },
      { menge: 8, einzelpreis: 65 },
      { menge: 1, einzelpreis: 1450 },
      { menge: 1, einzelpreis: 380 },
      { menge: 1, einzelpreis: 180 },
    ];

    const { netto, mwst, brutto } = summen(zeilen, 19);

    expect(netto).toBe(2754);
    expect(mwst).toBe(523.26);
    // Brutto ist die Summe, nicht eine zweite Rundung.
    expect(brutto).toBe(3277.26);
  });

  it("weist beim Kleinunternehmer keine Steuer aus", () => {
    const { netto, mwst, brutto } = summen([{ menge: 1, einzelpreis: 420 }], 0);
    expect(netto).toBe(420);
    expect(mwst).toBe(0);
    expect(brutto).toBe(420);
  });
});
