import { describe, expect, it } from "vitest";

import { csvDatei, csvZeile } from "./csv";

/**
 * Der Export muss sich beim Handwerker per Doppelklick in Excel öffnen.
 * Alles hier prüft genau das — nicht die Einhaltung eines RFC.
 */
describe("csvZeile", () => {
  it("trennt mit Semikolon, wie Excel es hier erwartet", () => {
    expect(csvZeile(["Fliesen", "Bad", 52])).toBe("Fliesen;Bad;52");
  });

  it("schreibt Zahlen mit Komma", () => {
    // Sonst behandelt Excel den Betrag als Text und rechnet nicht damit.
    expect(csvZeile([52.5])).toBe("52,5");
  });

  it("quotet Felder mit Semikolon, Anführungszeichen oder Umbruch", () => {
    expect(csvZeile(['Fliesen; rutschhemmend'])).toBe('"Fliesen; rutschhemmend"');
    expect(csvZeile(['Grösse 30"'])).toBe('"Grösse 30"""');
    expect(csvZeile(["Zeile1\nZeile2"])).toBe('"Zeile1\nZeile2"');
  });

  it("macht aus leeren Werten leere Felder, nicht 'null'", () => {
    expect(csvZeile([null, undefined, ""])).toBe(";;");
  });

  it("schreibt Ja und Nein statt true und false", () => {
    expect(csvZeile([true, false])).toBe("ja;nein");
  });
});

describe("csvDatei", () => {
  it("beginnt mit der Kopfzeile und endet mit einem Umbruch", () => {
    const datei = csvDatei(["A", "B"], [[1, 2]]);
    expect(datei).toBe("A;B\r\n1;2\r\n");
  });

  it("kommt ohne Datenzeilen aus", () => {
    expect(csvDatei(["A"], [])).toBe("A\r\n");
  });
});
