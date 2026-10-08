import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Die Entscheidung des Kunden
 * =============================================================================
 * Der einzige Weg in die Anwendung, der ohne Anmeldung offensteht. Was die
 * Datenbank dabei zulässt, prüft supabase/test/10_flow.sql an echtem Postgres
 * (Schritte 30–33). Hier geht es um die Schicht davor: was die Seite
 * weiterreicht, und vor allem, was sie nach aussen sagt.
 */

let db: FakeDb;
/** Was die Datenbankfunktion auf den Aufruf antwortet. */
let antwort: boolean;
let aufrufe: Record<string, unknown>[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      aufrufe.push({ name, ...args });
      return { data: antwort, error: null };
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

async function entscheiden(felder: Record<string, string>) {
  const { angebotEntscheiden } = await import("./actions");
  const fd = new FormData();
  for (const [k, v] of Object.entries(felder)) fd.set(k, v);
  return angebotEntscheiden({}, fd);
}

beforeEach(() => {
  vi.resetModules();
  db = fakeSupabase({});
  antwort = true;
  aufrufe = [];
});

describe("Zusage", () => {
  it("reicht Schlüssel, Entscheidung und Anmerkung durch", async () => {
    const ergebnis = await entscheiden({
      token: "tok123",
      entscheidung: "angenommen",
      anmerkung: "Bitte im Mai anfangen.",
    });

    expect(ergebnis.erfolg).toBeTruthy();
    expect(aufrufe[0]).toMatchObject({
      name: "angebot_entscheiden",
      p_token: "tok123",
      p_entscheidung: "angenommen",
      p_anmerkung: "Bitte im Mai anfangen.",
    });
  });

  it("schickt eine leere Anmerkung als nichts, nicht als leeren Text", async () => {
    await entscheiden({ token: "tok123", entscheidung: "angenommen", anmerkung: "" });
    expect(aufrufe[0].p_anmerkung).toBeNull();
  });
});

describe("Absage", () => {
  it("nimmt den Grund mit", async () => {
    const ergebnis = await entscheiden({
      token: "tok123",
      entscheidung: "abgelehnt",
      anmerkung: "zu teuer",
    });

    expect(ergebnis.erfolg).toBeTruthy();
    expect(aufrufe[0].p_entscheidung).toBe("abgelehnt");
  });
});

describe("was nicht durchgeht", () => {
  it("lehnt eine erfundene Entscheidung ab, ohne die Datenbank zu fragen", async () => {
    const ergebnis = await entscheiden({ token: "tok123", entscheidung: "storniert" });

    expect(ergebnis.fehler).toBeTruthy();
    expect(aufrufe).toHaveLength(0);
  });

  it("lehnt einen fehlenden Schlüssel ab", async () => {
    const ergebnis = await entscheiden({ token: "", entscheidung: "angenommen" });
    expect(ergebnis.fehler).toBeTruthy();
    expect(aufrufe).toHaveLength(0);
  });

  it("kürzt eine übermässig lange Anmerkung, statt sie weiterzureichen", async () => {
    await entscheiden({
      token: "tok123",
      entscheidung: "abgelehnt",
      anmerkung: "x".repeat(9000),
    });

    expect(String(aufrufe[0].p_anmerkung)).toHaveLength(2000);
  });
});

describe("was die Seite nach aussen sagt", () => {
  it("unterscheidet nicht zwischen falschem Schlüssel und schon entschieden", async () => {
    // Beides gibt `false` zurück. Wer Links durchprobiert, soll aus der
    // Antwort nicht ablesen können, ob er einen gültigen erwischt hat.
    antwort = false;

    const ergebnis = await entscheiden({ token: "falsch", entscheidung: "angenommen" });

    expect(ergebnis.fehler).toContain("lässt sich nicht mehr entscheiden");
    expect(ergebnis.fehler).not.toMatch(/nicht gefunden|unbekannt|existiert/i);
  });
});
