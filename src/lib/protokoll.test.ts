import { afterEach, describe, expect, it, vi } from "vitest";

import { protokolliereFehler, protokolliereWarnung } from "./protokoll";

/**
 * Das Protokoll sieht harmlos aus, hat aber eine Eigenschaft, die man nicht
 * dem Zufall überlassen darf: es darf keine Inhalte Dritter enthalten. Ein
 * Logfile mit Kundennamen oder Transkripten ist eine Datenpanne mit Ansage —
 * spätestens, wenn es bei einem Dienstleister landet.
 */

const zeilen: string[] = [];
vi.spyOn(console, "error").mockImplementation((z) => zeilen.push(String(z)));
vi.spyOn(console, "warn").mockImplementation((z) => zeilen.push(String(z)));

afterEach(() => {
  zeilen.length = 0;
});

describe("protokolliereFehler", () => {
  it("schreibt eine Zeile auswertbares JSON", () => {
    protokolliereFehler({ vorgang: "angebot.extraktion", userId: "u1" }, new Error("kaputt"));

    const eintrag = JSON.parse(zeilen[0]);
    expect(eintrag.vorgang).toBe("angebot.extraktion");
    expect(eintrag.schwere).toBe("fehler");
    expect(eintrag.user).toBe("u1");
    expect(eintrag.fehler).toContain("kaputt");
    expect(eintrag.zeit).toBeTruthy();
  });

  it("nimmt Kennzahlen als Zusatz auf", () => {
    protokolliereFehler(
      { vorgang: "angebot.positionen", details: { anzahl: 5 } },
      new Error("x"),
    );
    expect(JSON.parse(zeilen[0]).anzahl).toBe(5);
  });

  it("kürzt lange Fehlermeldungen", () => {
    // Meldungen können Bruchstücke der Eingabe enthalten — die Zuordnung
    // leistet ohnehin der Vorgang, nicht der Text.
    protokolliereFehler({ vorgang: "x" }, new Error("y".repeat(5000)));
    expect(JSON.parse(zeilen[0]).fehler.length).toBeLessThanOrEqual(300);
  });

  it("kommt ohne User und ohne Fehlerobjekt aus", () => {
    protokolliereFehler({ vorgang: "stripe.webhook" }, undefined);

    const eintrag = JSON.parse(zeilen[0]);
    expect(eintrag.user).toBeNull();
    expect(eintrag.fehler).toBe("");
  });

  it("verträgt geworfene Nicht-Fehler", () => {
    protokolliereFehler({ vorgang: "x" }, "einfach ein Text");
    expect(JSON.parse(zeilen[0]).fehler).toBe("einfach ein Text");
  });
});

describe("protokolliereWarnung", () => {
  it("landet als Warnung, nicht als Fehler", () => {
    protokolliereWarnung({ vorgang: "angebot.verbrauch" });
    expect(JSON.parse(zeilen[0]).schwere).toBe("warnung");
  });
});
