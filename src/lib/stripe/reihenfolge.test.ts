import { describe, expect, it } from "vitest";

import { ereignisZeit, istVeraltet } from "./reihenfolge";

/**
 * Stripe garantiert die Zustellung, nicht die Reihenfolge. Was hier falsch
 * entschieden wird, sperrt jemanden aus, der bezahlt hat.
 */
describe("istVeraltet", () => {
  const jetzt = Date.parse("2026-09-25T10:00:00Z") / 1000;

  it("lässt das erste Ereignis immer durch", () => {
    expect(istVeraltet(null, jetzt)).toBe(false);
    expect(istVeraltet(undefined, jetzt)).toBe(false);
  });

  it("verwirft ein älteres Ereignis", () => {
    expect(istVeraltet("2026-09-25T10:00:00Z", jetzt - 120)).toBe(true);
  });

  it("lässt ein neueres durch", () => {
    expect(istVeraltet("2026-09-25T10:00:00Z", jetzt + 1)).toBe(false);
  });

  it("lässt gleichzeitige Ereignisse durch", () => {
    // Stripe schickt zu einem Vorgang mehrere Ereignisse mit demselben
    // Zeitstempel — die gehören alle verarbeitet.
    expect(istVeraltet("2026-09-25T10:00:00Z", jetzt)).toBe(false);
  });

  it("lässt bei unbrauchbarem Zeitstempel lieber durch als aus", () => {
    // Im Zweifel verarbeiten: ein verworfenes Ereignis sperrt jemanden aus,
    // ein doppelt verarbeitetes ändert nichts.
    expect(istVeraltet("Unsinn", jetzt)).toBe(false);
  });
});

describe("ereignisZeit", () => {
  it("rechnet Stripes Sekunden in eine ISO-Zeit", () => {
    expect(ereignisZeit(Date.parse("2026-09-25T10:00:00Z") / 1000)).toBe(
      "2026-09-25T10:00:00.000Z",
    );
  });
});
