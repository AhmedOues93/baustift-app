import { describe, expect, it } from "vitest";

import { istNachfassFaellig, tageOhneAntwort } from "./angebot";

/**
 * Nachfass-Regel.
 *
 * Entscheidet, wann eine Nachfrage beim Kunden rausgeht. Zu früh wirkt
 * gedrängelt, zu spät ist der Auftrag vergeben — und zweimal in derselben
 * Woche beim selben Kunden ist genau die Aufdringlichkeit, die sich ein
 * Handwerksbetrieb im Ort nicht leisten kann.
 */

/** Ein Zeitpunkt vor `tage` Tagen. */
function vor(tage: number): string {
  return new Date(Date.now() - tage * 86_400_000).toISOString();
}

const verschickt = (tage: number, extra = {}) => ({
  status: "gesendet" as const,
  gesendet_am: vor(tage),
  nachgefasst_am: null,
  ...extra,
});

describe("istNachfassFaellig", () => {
  it("wird nach einer Woche ohne Antwort fällig", () => {
    expect(istNachfassFaellig(verschickt(6))).toBe(false);
    expect(istNachfassFaellig(verschickt(7))).toBe(true);
    expect(istNachfassFaellig(verschickt(30))).toBe(true);
  });

  it("gilt nur für verschickte Angebote", () => {
    expect(istNachfassFaellig({ ...verschickt(30), status: "entwurf" })).toBe(false);
    // Entschieden ist entschieden — hier nachzufragen wäre peinlich.
    expect(istNachfassFaellig({ ...verschickt(30), status: "angenommen" })).toBe(false);
    expect(istNachfassFaellig({ ...verschickt(30), status: "abgelehnt" })).toBe(false);
  });

  it("braucht einen Versandzeitpunkt", () => {
    expect(istNachfassFaellig({ ...verschickt(30), gesendet_am: null })).toBe(false);
  });

  it("beginnt nach einer Nachfrage von vorn", () => {
    // Sonst stünde das Angebot am Tag nach dem Nachhaken wieder auf der Liste.
    expect(
      istNachfassFaellig(verschickt(40, { nachgefasst_am: vor(2) })),
    ).toBe(false);
    expect(
      istNachfassFaellig(verschickt(40, { nachgefasst_am: vor(8) })),
    ).toBe(true);
  });
});

describe("tageOhneAntwort", () => {
  it("zählt die Tage seit dem Versand", () => {
    expect(tageOhneAntwort(verschickt(12))).toBe(12);
  });

  it("zählt nichts, solange das Angebot nicht raus ist", () => {
    expect(tageOhneAntwort({ status: "entwurf", gesendet_am: null })).toBe(0);
  });
});
