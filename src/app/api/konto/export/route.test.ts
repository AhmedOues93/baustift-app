import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Datenexport nach Art. 20 DSGVO
 * =============================================================================
 * Dass JEDE Tabelle mit Nutzerdaten abgefragt wird, prüft
 * vollstaendig.test.ts gegen die Migrationen — ein vergessener Export wäre
 * sonst erst bei einer Auskunftsanfrage aufgefallen. Hier geht es um die
 * Route selbst: Zugang, Form und dass nichts Fremdes mitkommt.
 */

let db: FakeDb;

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));

function start(optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      profiles: [{ id: "u1", firma_name: "Schulz Sanitär", iban: "DE89 3704 0044 0532 0130 00" }],
      kunden: [{ id: "k1", user_id: "u1", name: "Familie Becker" }],
      preisliste: [{ id: "p1", user_id: "u1", bezeichnung: "Fliesen", einzelpreis: 52 }],
      angebote: [{ id: "a1", user_id: "u1", nummer: "AN-2026-0041" }],
      leistungspakete: [{ id: "pk1", user_id: "u1", name: "Bad komplett" }],
      paket_positionen: [{ id: "pz1", paket_id: "pk1", bezeichnung: "Fliesen" }],
    },
    optionen,
  );
}

async function hole() {
  const { GET } = await import("./route");
  return GET();
}

beforeEach(() => {
  vi.resetModules();
  start();
});

it("weist ab, wer nicht angemeldet ist", async () => {
  start({ user: null });
  expect((await hole()).status).toBe(401);
});

it("liefert eine JSON-Datei zum Herunterladen", async () => {
  const antwort = await hole();

  expect(antwort.status).toBe(200);
  expect(antwort.headers.get("Content-Type")).toContain("json");
  expect(antwort.headers.get("Content-Disposition")).toContain("baustift-export-");
  expect(antwort.headers.get("Cache-Control")).toContain("no-store");
});

it("enthält Konto, Firmendaten und jede Datenart", async () => {
  const daten = await (await hole()).json();

  expect(daten.konto.id).toBe("u1");
  expect(daten.firmendaten.firma_name).toBe("Schulz Sanitär");
  for (const bereich of [
    "kunden", "preisliste", "angebote", "angebotspositionen", "rechnungen",
    "rechnungspositionen", "zahlungen", "aufmasse", "messungen", "auftraege",
    "baustellendokumentation", "leistungspakete", "paketpositionen",
    "ki_nutzung", "rueckmeldungen",
  ]) {
    expect(daten, bereich).toHaveProperty(bereich);
  }
});

it("nennt den Zweck, damit die Datei für sich spricht", async () => {
  // Wer sie Monate später öffnet, soll wissen, was er vor sich hat.
  const daten = await (await hole()).json();

  expect(daten.hinweis).toContain("Art. 20");
  expect(daten.erstellt_am).toBeTruthy();
});
