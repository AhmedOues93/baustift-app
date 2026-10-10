import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Leistungspakete
 * =============================================================================
 * Was die Datenbank beim Übernehmen tut — Preis aus dem Katalog, hinten
 * einsortieren, fremde Pakete abweisen — prüft supabase/test/10_flow.sql an
 * echtem Postgres (Schritte 34–36). Hier geht es um die Schicht davor.
 */

let db: FakeDb;
let rpcAntwort: number | null;
let rpcAufrufe: Record<string, unknown>[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    ...db.client,
    rpc: async (name: string, args: Record<string, unknown>) => {
      rpcAufrufe.push({ name, ...args });
      return { data: rpcAntwort, error: null };
    },
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

function start() {
  db = fakeSupabase({
    leistungspakete: [
      { id: "pk1", user_id: "u1", name: "Bad komplett", beschreibung: null, aktiv: true },
    ],
    paket_positionen: [
      { id: "pz1", paket_id: "pk1", pos_nr: 1, bezeichnung: "Fliesen", menge: 10, einheit: "m2", einzelpreis: 0, preisliste_id: "pl1" },
    ],
    preisliste: [{ id: "pl1", user_id: "u1", bezeichnung: "Fliesen", einzelpreis: 52, einheit: "m2", aktiv: true }],
  });
}

async function formular(werte: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(werte)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  vi.resetModules();
  rpcAntwort = 2;
  rpcAufrufe = [];
  start();
});

describe("Paket anlegen", () => {
  it("nimmt die user_id aus der Session, nicht aus dem Formular", async () => {
    const { paketAnlegen } = await import("./actions");

    await paketAnlegen({}, await formular({ name: "Gäste-WC", user_id: "fremd" }));

    const neu = db.tabellen.leistungspakete.find((p) => p.name === "Gäste-WC");
    expect(neu?.user_id).toBe("u1");
  });

  it("verlangt einen Namen", async () => {
    const { paketAnlegen } = await import("./actions");
    const ergebnis = await paketAnlegen({}, await formular({ name: "   " }));

    expect(ergebnis.fehler).toBeTruthy();
    expect(db.tabellen.leistungspakete).toHaveLength(1);
  });
});

describe("Zeile im Paket", () => {
  it("hängt hinten an, statt eine Nummer doppelt zu vergeben", async () => {
    const { paketZeileAnlegen } = await import("./actions");

    await paketZeileAnlegen(
      {},
      await formular({ paket_id: "pk1", bezeichnung: "Entsorgung", menge: "1", einheit: "pauschal", einzelpreis: "180" }),
    );

    const neu = db.tabellen.paket_positionen.find((z) => z.bezeichnung === "Entsorgung");
    expect(neu?.pos_nr).toBe(2);
    expect(neu?.einzelpreis).toBe(180);
  });

  it("speichert keinen Preis, wenn die Zeile am Katalog hängt", async () => {
    // Sonst steht im Paket ein eingefrorener Preis, der bei der nächsten
    // Preiserhöhung still falsch wird.
    const { paketZeileAnlegen } = await import("./actions");

    await paketZeileAnlegen(
      {},
      await formular({ paket_id: "pk1", bezeichnung: "Fliesen", preisliste_id: "pl1", menge: "8", einzelpreis: "999" }),
    );

    const neu = db.tabellen.paket_positionen.find((z) => z.menge === 8);
    expect(neu?.einzelpreis).toBe(0);
    expect(neu?.preisliste_id).toBe("pl1");
  });

  it("behält drei Nachkommastellen bei der Menge", async () => {
    const { paketZeileAnlegen } = await import("./actions");

    await paketZeileAnlegen(
      {},
      await formular({ paket_id: "pk1", bezeichnung: "Beton", menge: "1,125", einheit: "m3" }),
    );

    expect(db.tabellen.paket_positionen.find((z) => z.bezeichnung === "Beton")?.menge).toBe(1.125);
  });

  it("weist eine Menge von null ab", async () => {
    const { paketZeileAnlegen } = await import("./actions");
    const ergebnis = await paketZeileAnlegen(
      {},
      await formular({ paket_id: "pk1", bezeichnung: "Nichts", menge: "0" }),
    );

    expect(ergebnis.fehler).toContain("Menge");
    expect(db.tabellen.paket_positionen).toHaveLength(1);
  });

  it("schreibt nicht in ein fremdes Paket", async () => {
    db.tabellen.leistungspakete[0].user_id = "fremd";
    const { paketZeileAnlegen } = await import("./actions");

    const ergebnis = await paketZeileAnlegen(
      {},
      await formular({ paket_id: "pk1", bezeichnung: "Fremd", menge: "1" }),
    );

    expect(ergebnis.fehler).toContain("nicht gefunden");
    expect(db.tabellen.paket_positionen).toHaveLength(1);
  });
});

describe("Paket ins Angebot übernehmen", () => {
  it("überlässt der Datenbank die Arbeit und meldet die Anzahl", async () => {
    const { paketUebernehmen } = await import("./actions");

    const ergebnis = await paketUebernehmen("a1", "pk1");

    expect(ergebnis.zeilen).toBe(2);
    expect(rpcAufrufe[0]).toMatchObject({
      name: "paket_in_angebot",
      p_paket_id: "pk1",
      p_angebot_id: "a1",
    });
  });

  it("meldet sachlich, wenn nichts übernommen wurde", async () => {
    // Null Zeilen heisst leeres Paket ODER fremdes Paket. Die Meldung
    // unterscheidet das bewusst nicht.
    rpcAntwort = 0;
    const { paketUebernehmen } = await import("./actions");

    const ergebnis = await paketUebernehmen("a1", "fremd");

    expect(ergebnis.fehler).toContain("keine Zeile");
    expect(ergebnis.zeilen).toBeUndefined();
  });
});
