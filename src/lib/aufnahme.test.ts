import { describe, expect, it } from "vitest";

import {
  FORMATE,
  MIN_AUFNAHME_BYTES,
  SENDE_ZEITGRENZE_MS,
  aufnahmeBrauchbar,
  endung,
  istStille,
  waehleFormat,
} from "./aufnahme";

describe("Aufnahmeformat", () => {
  it("nimmt Opus, wenn der Browser es kann", () => {
    expect(waehleFormat(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("weicht auf mp4 aus — sonst nimmt jedes iPhone stumm nichts auf", () => {
    const safari = (typ: string) => typ === "audio/mp4";
    expect(waehleFormat(safari)).toBe("audio/mp4");
  });

  it("überlässt es dem Browser, wenn er nichts davon kann", () => {
    // Ein erzwungenes Format, das der Browser nicht kennt, heisst: keine
    // Aufnahme. Lieber gar keine Vorgabe.
    expect(waehleFormat(() => false)).toBe("");
  });

  it("gibt zu jedem Format eine Endung, die Whisper kennt", () => {
    for (const format of FORMATE) {
      expect(["webm", "m4a", "ogg"]).toContain(endung(format));
    }
    expect(endung("")).toBe("webm");
  });
});

describe("leere Aufnahme", () => {
  it("lässt eine Aufnahme mit Inhalt durch", () => {
    expect(aufnahmeBrauchbar(MIN_AUFNAHME_BYTES)).toBe(true);
    expect(aufnahmeBrauchbar(120_000)).toBe(true);
  });

  it("hält eine leere Aufnahme zurück, bevor sie Geld kostet", () => {
    // Abgeschaltetes Mikrofon, belegte Audiohardware: der Recorder läuft,
    // aber es kommt kein einziger Datenblock an.
    expect(aufnahmeBrauchbar(0)).toBe(false);
    expect(aufnahmeBrauchbar(300)).toBe(false);
  });
});

describe("Zeitgrenze", () => {
  it("liegt über der Rechenzeit der Route, aber nicht im Unendlichen", () => {
    // Die Route darf 120 s. Ohne eigene Grenze wartet der Browser im
    // Funkloch ewig, und Neuladen wirft die Aufnahme weg.
    expect(SENDE_ZEITGRENZE_MS).toBeGreaterThan(120_000);
    expect(SENDE_ZEITGRENZE_MS).toBeLessThanOrEqual(180_000);
  });
});

describe("Stille, die Whisper für Untertitel hält", () => {
  it("erkennt die bekannten Floskeln", () => {
    // Whisper ist auf YouTube-Untertiteln trainiert und gibt bei Stille
    // deren Abspann aus. Ohne Filter baut die KI daraus ein Angebot.
    for (const erfunden of [
      "Untertitel von Stephanie Geiger",
      "Untertitelung des ZDF für funk, 2017",
      "Vielen Dank.",
      "Vielen Dank fürs Zuschauen!",
      "Untertitel der Amara.org-Community",
      "Das war's für heute. Bis zum nächsten Mal.",
      "Musik",
      "   ",
      "",
    ]) {
      expect(istStille(erfunden), erfunden).toBe(true);
    }
  });

  it("lässt ein echtes Diktat in Ruhe", () => {
    for (const echt of [
      "Bad komplett, acht Quadratmeter. Alte Fliesen raus, neue 60 auf 60.",
      "Heizkörper tauschen, vier Stück. Vielen Dank.",
      "Wand 1: 5 Meter mal 2,50 Meter.",
      "WC tauschen inklusive Montage und Entsorgung.",
    ]) {
      expect(istStille(echt), echt).toBe(false);
    }
  });

  it("verschluckt kein Diktat, das zufällig mit einer Floskel endet", () => {
    // Der gefährliche Fehler wäre andersherum: ein echtes Angebot
    // wegzuwerfen, weil ein Satz darin wie eine Floskel aussieht.
    expect(istStille("Dusche bodengleich mit Rinne. Vielen Dank.")).toBe(false);
  });
});
