import { describe, expect, it } from "vitest";

import { istUeberfaellig, rechnungUeberfaellig, tageUeberfaellig } from "./rechnung";
import type { Rechnung } from "@/types/database";

/**
 * Fälligkeit.
 *
 * Sieht nach einem Dreizeiler aus, entscheidet aber, wann eine Erinnerung an
 * einen Kunden rausgeht. Einen Tag zu früh ist peinlich, viele Tage zu spät
 * kostet Geld — beides liegt hier nur einen Vergleichsoperator auseinander.
 */

function tag(versatz: number): string {
  const d = new Date();
  d.setDate(d.getDate() + versatz);
  return d.toISOString().slice(0, 10);
}

describe("istUeberfaellig", () => {
  it("ist am Fälligkeitstag selbst noch nicht überfällig", () => {
    expect(istUeberfaellig(tag(0))).toBe(false);
  });

  it("ist am Tag nach der Fälligkeit überfällig", () => {
    expect(istUeberfaellig(tag(-1))).toBe(true);
  });

  it("ist vor der Fälligkeit nicht überfällig", () => {
    expect(istUeberfaellig(tag(7))).toBe(false);
  });

  it("behandelt ein fehlendes Zahlungsziel als nicht überfällig", () => {
    expect(istUeberfaellig(null)).toBe(false);
  });

  it("verträgt einen vollen Zeitstempel", () => {
    expect(istUeberfaellig(`${tag(-2)}T23:59:59Z`)).toBe(true);
  });
});

describe("rechnungUeberfaellig", () => {
  const basis = { status: "gestellt", faellig_am: tag(-5) } as Pick<
    Rechnung,
    "status" | "faellig_am"
  >;

  it("gilt nur für gestellte Rechnungen", () => {
    expect(rechnungUeberfaellig(basis)).toBe(true);
    // Eine bezahlte Rechnung mit altem Datum ist nicht überfällig — genau
    // dieser Fall würde sonst eine Erinnerung an einen zahlenden Kunden
    // schicken.
    expect(rechnungUeberfaellig({ ...basis, status: "bezahlt" })).toBe(false);
    expect(rechnungUeberfaellig({ ...basis, status: "entwurf" })).toBe(false);
    expect(rechnungUeberfaellig({ ...basis, status: "storniert" })).toBe(false);
  });
});

describe("tageUeberfaellig", () => {
  it("zählt die Tage seit der Fälligkeit", () => {
    expect(tageUeberfaellig(tag(-1))).toBe(1);
    expect(tageUeberfaellig(tag(-14))).toBe(14);
  });

  it("gibt 0 zurück, solange das Ziel läuft", () => {
    expect(tageUeberfaellig(tag(0))).toBe(0);
    expect(tageUeberfaellig(tag(3))).toBe(0);
    expect(tageUeberfaellig(null)).toBe(0);
  });
});
