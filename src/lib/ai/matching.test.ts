import { describe, expect, it } from "vitest";

import {
  aehnlichkeit,
  matchePosition,
  normalisiere,
  type KiPosition,
} from "./matching";
import type { PreislisteEintrag } from "@/types/database";

/**
 * Das Preis-Matching ist die Stelle, an der die App still falsch sein kann:
 * ein danebengegriffener Eintrag erzeugt kein Fehlerbild, sondern ein
 * plausibel aussehendes Angebot mit dem falschen Betrag. Deshalb hier die
 * Fälle aus der Praxis, nicht bloss ein Glücksfall.
 */

function eintrag(
  id: string,
  bezeichnung: string,
  einzelpreis: number,
  extra: Partial<PreislisteEintrag> = {},
): PreislisteEintrag {
  return {
    id,
    user_id: "u1",
    bezeichnung,
    beschreibung: null,
    kategorie: null,
    einheit: "m2",
    einzelpreis,
    stichworte: [],
    aktiv: true,
    created_at: "",
    updated_at: "",
    ...extra,
  };
}

const katalog: PreislisteEintrag[] = [
  eintrag("k1", "Fliesen verlegen 30x60", 52, {
    kategorie: "Fliesenarbeiten",
    stichworte: ["bad fliesen", "verfliesen"],
  }),
  eintrag("k2", "Duschwanne montieren", 189, {
    einheit: "stk",
    kategorie: "Sanitär",
  }),
  eintrag("k3", "Monteurstunde", 62, { einheit: "h", kategorie: "Arbeitszeit" }),
];

function position(teil: Partial<KiPosition>): KiPosition {
  return {
    bezeichnung: "",
    menge: 1,
    konfidenz: 0.95,
    einheit: "m2",
    preisliste_id: null,
    ...teil,
  };
}

describe("normalisiere", () => {
  it("macht Umlaute in beiden Schreibweisen vergleichbar", () => {
    // So tippt man auf dem Handy: ohne Umlaut.
    expect(normalisiere("Sanitär")).toBe(normalisiere("sanitar"));
    expect(normalisiere("Sanitär")).toBe(normalisiere("sanitaer"));
    expect(normalisiere("Größe")).toBe(normalisiere("grosse"));
  });

  it("wirft Satzzeichen weg", () => {
    expect(normalisiere("Fliesen, 30x60 cm!")).toBe("fliesen 30x60 cm");
  });
});

describe("aehnlichkeit", () => {
  it("erkennt Gleiches als 1 und Fremdes als nahezu 0", () => {
    expect(aehnlichkeit("Fliesen", "Fliesen")).toBe(1);
    expect(aehnlichkeit("Fliesen verlegen", "Heizung entlüften")).toBeLessThan(0.3);
  });

  it("verträgt Wortformen", () => {
    expect(aehnlichkeit("Fliesen verlegen", "Fliesen verlegt")).toBeGreaterThan(0.7);
  });
});

describe("matchePosition", () => {
  it("nimmt den Preis aus der Datenbank, nicht aus der KI-Antwort", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Fliesen verlegen", preisliste_id: "k1" }),
      katalog,
    );
    expect(ergebnis.einzelpreis).toBe(52);
    expect(ergebnis.preisliste_id).toBe("k1");
    expect(ergebnis.zu_pruefen).toBe(false);
    expect(ergebnis.match_grund).toBe("katalog");
  });

  it("fällt bei erfundener ID auf die Textsuche zurück", () => {
    // Genau dieser Fall macht die Prüfung nötig: Claude liefert eine ID, die
    // es nicht gibt. Ungeprüft übernommen wäre der Preis 0.
    const ergebnis = matchePosition(
      position({
        bezeichnung: "Fliesen verlegen 30x60",
        preisliste_id: "gibt-es-nicht",
      }),
      katalog,
    );
    expect(ergebnis.preisliste_id).toBe("k1");
    expect(ergebnis.einzelpreis).toBe(52);
  });

  it("findet den Eintrag über ein Stichwort des Handwerkers", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Bad fliesen, 8 Quadratmeter" }),
      katalog,
    );
    expect(ergebnis.preisliste_id).toBe("k1");
  });

  it("markiert Unbekanntes als zu prüfen statt es zu raten", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Photovoltaik-Anlage aufs Dach", einheit: "stk" }),
      katalog,
    );
    expect(ergebnis.preisliste_id).toBeNull();
    expect(ergebnis.einzelpreis).toBe(0);
    expect(ergebnis.zu_pruefen).toBe(true);
    expect(ergebnis.match_grund).toBe("kein_treffer");
  });

  it("übernimmt inaktive Einträge nicht", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Monteurstunde", einheit: "h" }),
      [eintrag("k3", "Monteurstunde", 62, { einheit: "h", aktiv: false })],
    );
    expect(ergebnis.preisliste_id).toBeNull();
  });

  it("kommt mit leerer Preisliste klar", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Irgendwas" }),
      [],
    );
    expect(ergebnis.zu_pruefen).toBe(true);
    expect(ergebnis.einzelpreis).toBe(0);
  });

  it("behält die diktierte Menge", () => {
    const ergebnis = matchePosition(
      position({ bezeichnung: "Fliesen verlegen 30x60", menge: 8 }),
      katalog,
    );
    expect(ergebnis.menge).toBe(8);
  });
});


describe("Sicherheitsprüfung des Preis-Matchings", () => {
  it.each([null, 0, -1, NaN, Infinity])("rät keine ungültige Menge (%s)", (menge) => {
    expect(() => matchePosition(position({ bezeichnung: "Fliesen", menge }), katalog))
      .toThrow("gültige Menge");
  });
  it.each([undefined, null, 0.4, -1, 2, NaN])("verlangt Prüfung bei unsicherer Konfidenz (%s)", (konfidenz) => {
    for (const preisliste_id of [null, "k1"]) {
      expect(matchePosition(position({ bezeichnung: "Fliesen verlegen 30x60", preisliste_id, konfidenz }), katalog).zu_pruefen).toBe(true);
    }
  });
  it("verwirft auch ausdrücklich vorgeschlagene inaktive Einträge", () => {
    const result = matchePosition(position({ bezeichnung: "Fliesen", preisliste_id: "k1" }),
      [{ ...katalog[0], aktiv: false }]);
    expect(result.preisliste_id).toBeNull();
    expect(result.zu_pruefen).toBe(true);
  });
  it("übernimmt weder per ID noch per Text Preise mit falscher Einheit", () => {
    for (const preisliste_id of [null, "k1"]) {
      const result = matchePosition(position({ bezeichnung: "Fliesen verlegen 30x60", einheit: "h", preisliste_id }), [katalog[0]]);
      expect(result.preisliste_id).toBeNull();
      expect(result.einzelpreis).toBe(0);
      expect(result.zu_pruefen).toBe(true);
    }
  });
});
