import { describe, expect, it } from "vitest";

import { KONTINGENT, darfAngebotErstellen, istPilot, planName } from "./abo";

/**
 * Das Kontingent ist der Kostenschutz des Geschäftsmodells. Wenn es in die
 * falsche Richtung irrt, zahlen entweder wir drauf oder ein zahlender Kunde
 * steht vor verschlossener Tür.
 */
describe("darfAngebotErstellen", () => {
  it("lässt in der Testphase bis zur Grenze arbeiten", () => {
    expect(darfAngebotErstellen("trial", 0).erlaubt).toBe(true);
    expect(darfAngebotErstellen("trial", KONTINGENT.trial - 1).erlaubt).toBe(true);
  });

  it("stoppt genau an der Grenze, nicht erst danach", () => {
    const ergebnis = darfAngebotErstellen("trial", KONTINGENT.trial);
    expect(ergebnis.erlaubt).toBe(false);
    expect(ergebnis.grund).toContain("Abo");
  });

  it("gibt dem zahlenden Kunden deutlich mehr Luft", () => {
    expect(darfAngebotErstellen("aktiv", KONTINGENT.trial + 1).erlaubt).toBe(true);
    expect(darfAngebotErstellen("aktiv", KONTINGENT.aktiv).erlaubt).toBe(false);
  });

  it("sperrt gekündigte und pausierte Konten", () => {
    expect(darfAngebotErstellen("gekuendigt", 0).erlaubt).toBe(false);
    expect(darfAngebotErstellen("pausiert", 0).erlaubt).toBe(false);
  });

  it("lässt Testbetriebe deutlich weiter arbeiten als die Probephase", () => {
    // Ein Pilot, der nach zehn Angeboten vor einer Bezahlschranke steht,
    // liefert genau dann keine Daten mehr, wenn es interessant wird.
    expect(KONTINGENT.pilot).toBeGreaterThan(KONTINGENT.aktiv);
    expect(darfAngebotErstellen("pilot", 250).erlaubt).toBe(true);
  });

  it("deckelt auch den Testbetrieb", () => {
    // Auch ein Tester kann versehentlich eine Schleife bauen — und die
    // zahlen wir.
    expect(darfAngebotErstellen("pilot", KONTINGENT.pilot).erlaubt).toBe(false);
  });

  it("behandelt einen unbekannten Status wie die Testphase", () => {
    // Lieber vorsichtig weiterarbeiten lassen als einem zahlenden Kunden
    // wegen eines neuen Stripe-Zustands den Zugang sperren.
    expect(darfAngebotErstellen("kennen-wir-nicht", 0).erlaubt).toBe(true);
  });
});

describe("istPilot", () => {
  it("erkennt nur den Testbetrieb", () => {
    // Davon hängt ab, ob der Rückmeldeknopf und die Auswertung erscheinen.
    // Ein zahlender Kunde soll sich nicht als Versuchskaninchen fühlen.
    expect(istPilot("pilot")).toBe(true);
    expect(istPilot("aktiv")).toBe(false);
    expect(istPilot("trial")).toBe(false);
  });
});

describe("planName", () => {
  it("nennt den Testbetrieb beim Namen", () => {
    expect(planName("pilot")).toBe("Testbetrieb");
    expect(planName("aktiv")).toBe("Baustift Pro");
  });
});
