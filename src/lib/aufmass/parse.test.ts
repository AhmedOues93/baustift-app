import { describe, expect, it } from "vitest";

import { messwert, parseMessung } from "./parse";

/**
 * Der Parser für gesprochene Masse.
 *
 * Die Sätze hier sind so formuliert, wie auf einer Baustelle gesprochen wird,
 * nicht wie in einer Bedienungsanleitung. Ein falsch verstandenes Mass ist
 * hier die teure Sorte Fehler: aus 2,50 m wird 250 m, und das Angebot geht
 * mit dem Hundertfachen raus.
 */

describe("Fläche", () => {
  it("versteht die Grundform mit Bezeichnung", () => {
    expect(parseMessung("Wand 1: 5 Meter mal 2,50 Meter")).toMatchObject({
      bezeichnung: "Wand 1",
      art: "flaeche",
      laenge: 5,
      breite: 2.5,
      anzahl: 1,
      abzug: false,
      zuPruefen: false,
    });
  });

  it("versteht 'auf' statt 'mal'", () => {
    expect(parseMessung("Boden 3,20 auf 2,40")).toMatchObject({
      bezeichnung: "Boden",
      art: "flaeche",
      laenge: 3.2,
      breite: 2.4,
    });
  });

  it("versteht das gesprochene x", () => {
    expect(parseMessung("Decke 4 x 5")).toMatchObject({
      art: "flaeche",
      laenge: 4,
      breite: 5,
    });
  });

  it("versteht ausgeschriebene Zahlen", () => {
    expect(parseMessung("Wand zwei: fünf Meter mal drei Meter")).toMatchObject({
      art: "flaeche",
      laenge: 5,
      breite: 3,
    });
  });

  it("setzt die nachgeschobene Nachkommastelle zusammen", () => {
    // "zwei Meter fünfzig" ist gesprochenes Deutsch für 2,50.
    expect(parseMessung("Wand: 5 Meter 20 mal 2 Meter 50")).toMatchObject({
      art: "flaeche",
      laenge: 5.2,
      breite: 2.5,
    });
  });
});

describe("Raum erkennen", () => {
  it("trennt bekannte Räume von der Bezeichnung ab", () => {
    expect(parseMessung("Bad Wand 1: 3 Meter mal 2,50 Meter")).toMatchObject({
      raum: "Bad",
      bezeichnung: "Wand 1",
    });
  });

  it("lässt unbekannte Wörter in Ruhe", () => {
    // Nicht raten: "Werkbank" ist kein Raum, auch wenn es vorne steht.
    expect(parseMessung("Werkbank hinten: 2 Meter mal 0,80 Meter")).toMatchObject({
      raum: null,
      bezeichnung: "Werkbank hinten",
    });
  });
});

describe("Einheiten", () => {
  it("rechnet Zentimeter in Meter", () => {
    expect(parseMessung("Sockel: 250 Zentimeter mal 10 Zentimeter")).toMatchObject({
      laenge: 2.5,
      breite: 0.1,
      zuPruefen: false,
    });
  });

  it("deutet blosse Zahlen ab 25 als Zentimeter — und markiert das", () => {
    // "Tür 90 mal 2,10": niemand baut eine Tür von 90 Metern. Geraten wird
    // richtig, aber sichtbar.
    const m = parseMessung("Tür 90 mal 2,10")!;
    expect(m.laenge).toBe(0.9);
    expect(m.breite).toBe(2.1);
    expect(m.zuPruefen).toBe(true);
  });

  it("lässt kleine Zahlen als Meter stehen", () => {
    expect(parseMessung("Wand 4 mal 3")).toMatchObject({
      laenge: 4,
      breite: 3,
      zuPruefen: false,
    });
  });
});

describe("Anzahl und Abzüge", () => {
  it("versteht 'drei Fenster je 1,20 mal 1,40'", () => {
    expect(parseMessung("drei Fenster je 1,20 mal 1,40")).toMatchObject({
      art: "flaeche",
      anzahl: 3,
      laenge: 1.2,
      breite: 1.4,
    });
  });

  it("erkennt einen Abzug", () => {
    const m = parseMessung("abzüglich Tür 1 Meter mal 2,10 Meter")!;
    expect(m.abzug).toBe(true);
    expect(m.bezeichnung).toBe("Tür");
  });

  it("erkennt 'minus' als Abzug", () => {
    expect(parseMessung("minus Fenster 1,20 mal 1,40")?.abzug).toBe(true);
  });
});

describe("Länge, Volumen, Stück", () => {
  it("nimmt ein einzelnes Mass als laufenden Meter", () => {
    expect(parseMessung("Sockelleiste 12 Meter 50")).toMatchObject({
      art: "laenge",
      laenge: 12.5,
    });
  });

  it("nimmt drei Masse als Volumen", () => {
    expect(parseMessung("Raum Bad: 2,20 mal 1,80 mal 2,50")).toMatchObject({
      art: "volumen",
      laenge: 2.2,
      breite: 1.8,
      hoehe: 2.5,
    });
  });

  it("versteht eine blosse Stückzahl", () => {
    expect(parseMessung("vier Steckdosen")).toMatchObject({
      art: "stueck",
      anzahl: 4,
      bezeichnung: "Steckdosen",
    });
  });
});

describe("Was er NICHT versteht, gibt er ehrlich zu", () => {
  it("gibt null zurück, wenn gar kein Mass drinsteht", () => {
    expect(parseMessung("also dann machen wir da mal weiter")).toBeNull();
  });

  it("gibt null bei leerem Text zurück", () => {
    expect(parseMessung("   ")).toBeNull();
  });

  it("rät nicht bei mehreren Zahlen ohne Trennwort", () => {
    // "3 4 5" könnte alles heissen. Lieber die KI fragen als falsch rechnen.
    expect(parseMessung("Wand 3 4 5")).toBeNull();
  });
});

describe("messwert", () => {
  const basis = { laenge: null, breite: null, hoehe: null, anzahl: 1 } as const;

  it("rechnet Fläche, Volumen, Länge und Stück", () => {
    expect(messwert({ ...basis, art: "flaeche", laenge: 5, breite: 2.5 })).toBe(12.5);
    expect(messwert({ ...basis, art: "volumen", laenge: 2, breite: 3, hoehe: 4 })).toBe(24);
    expect(messwert({ ...basis, art: "laenge", laenge: 12.5 })).toBe(12.5);
    expect(messwert({ ...basis, art: "stueck", anzahl: 4 })).toBe(4);
  });

  it("nimmt die Anzahl mit", () => {
    expect(messwert({ ...basis, art: "flaeche", laenge: 1.2, breite: 1.4, anzahl: 3 }))
      .toBeCloseTo(5.04, 5);
  });

  it("gibt null zurück, solange ein Mass fehlt", () => {
    // Eine 0 sähe aus wie ein Ergebnis. Null ist ehrlicher.
    expect(messwert({ ...basis, art: "flaeche", laenge: 5 })).toBeNull();
    expect(messwert({ ...basis, art: "volumen", laenge: 2, breite: 3 })).toBeNull();
  });
});

describe("Rückfälle, die es schon einmal gab", () => {
  it("verwechselt das m in 'mal' nicht mit der Einheit Meter", () => {
    // Ohne Wortgrenze hinter der Einheit passte das "m" von "mal" auf
    // "Meter". Aus einer Tür von 90 cm wurde eine von 90 m — Faktor 100 im
    // Angebot, und nichts daran sah verdächtig aus.
    const m = parseMessung("Tür 90 mal 2,10")!;
    expect(m.laenge).toBe(0.9);
  });

  it("hält eine Zahl in der Bezeichnung aus dem Mass heraus", () => {
    // "Wand 1" ist ein Name, kein Mass. Ein "mal" heisst zwei Masse, egal
    // wie viele Zahlen sonst im Satz stehen.
    expect(parseMessung("Wand 1 5 Meter mal 2,50 Meter")).toMatchObject({
      art: "flaeche",
      laenge: 5,
      breite: 2.5,
    });
  });

  it("zählt die Anzahl nicht als drittes Mass", () => {
    expect(parseMessung("drei Fenster je 1,20 mal 1,40")).toMatchObject({
      art: "flaeche",
      anzahl: 3,
    });
  });
});

describe("Sätze aus dem Alltag", () => {
  /** Kurzform: was zählt, ist Art und gerechneter Wert. */
  function wert(satz: string) {
    const m = parseMessung(satz);
    return m ? { art: m.art, wert: messwert(m) } : null;
  }

  it("Badsanierung, wie sie wirklich diktiert wird", () => {
    expect(wert("Bad Boden: 2,40 mal 1,80")).toEqual({ art: "flaeche", wert: 4.32 });
    expect(wert("Bad Wand 1: 2,40 mal 2,50")).toEqual({ art: "flaeche", wert: 6 });
    expect(wert("abzüglich Tür 90 mal 2,10")).toEqual({ art: "flaeche", wert: 1.89 });
    expect(wert("Silikonfuge 8 Meter 40")).toEqual({ art: "laenge", wert: 8.4 });
    expect(wert("zwei Steckdosen")).toEqual({ art: "stueck", wert: 2 });
  });

  it("behält den Abzug als Abzug", () => {
    expect(parseMessung("abzüglich Tür 90 mal 2,10")?.abzug).toBe(true);
    expect(parseMessung("Bad Boden: 2,40 mal 1,80")?.abzug).toBe(false);
  });
});
