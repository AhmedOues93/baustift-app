import { describe, expect, it } from "vitest";

import { extraktionKosten, formatZehntelcent, transkriptionKosten } from "./kosten";

/**
 * Die Kostenschätzung entscheidet über die Marge. Getestet wird vor allem,
 * dass kleine Beträge nicht verschwinden — genau das passiert, wenn man in
 * ganzen Cent rechnet.
 */
describe("Kostenschätzung", () => {
  it("verliert einen 90-Sekunden-Lauf nicht in der Rundung", () => {
    const kosten = transkriptionKosten(90);
    expect(kosten).toBeGreaterThan(0);
  });

  it("rechnet die Transkription mit der Dauer hoch", () => {
    // Nicht exakt das Doppelte: gespeichert wird in ganzen Zehntel-Cent, und
    // jeder Lauf wird einzeln gerundet. Für eine Kostenschätzung reicht das.
    const einfach = transkriptionKosten(60);
    const doppelt = transkriptionKosten(120);
    expect(doppelt).toBeGreaterThan(einfach);
    expect(Math.abs(doppelt - 2 * einfach)).toBeLessThanOrEqual(1);
  });

  it("bewertet Cache-Token deutlich günstiger als frische Eingabe", () => {
    const frisch = extraktionKosten({
      modell: "claude-opus-5",
      eingabeToken: 100_000,
      ausgabeToken: 0,
      cacheToken: 0,
    });
    const gecacht = extraktionKosten({
      modell: "claude-opus-5",
      eingabeToken: 0,
      ausgabeToken: 0,
      cacheToken: 100_000,
    });
    // Genau dafür liegt der Preiskatalog im gecachten Prompt-Prefix.
    expect(gecacht * 5).toBeLessThan(frisch);
  });

  it("bleibt ein typisches Angebot unter zehn Cent", () => {
    // Grundlage der Kalkulation: bei 39 € im Monat und 200 Angeboten darf
    // ein Lauf nicht mehr als ein paar Cent kosten.
    const kosten =
      transkriptionKosten(60) +
      extraktionKosten({
        modell: "claude-opus-5",
        eingabeToken: 1_500,
        ausgabeToken: 1_200,
        cacheToken: 4_000,
      });
    expect(kosten).toBeLessThan(100); // 100 Zehntelcent = 0,10 €
  });

  it("zeigt Beträge in Euro an", () => {
    expect(formatZehntelcent(1000).replace(/\s/g, " ")).toBe("1,00 €");
  });
});
