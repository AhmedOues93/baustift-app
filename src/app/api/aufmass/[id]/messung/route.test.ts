import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Eine gesprochene Messung aufnehmen
 * =============================================================================
 * Der Takt beim Aufmass: antippen, Mass sprechen, antippen — zwanzigmal
 * hintereinander. Jede dieser Anfragen geht hier durch. Kein Whisper, keine
 * KI; mit getipptem Text läuft derselbe Weg durch den deterministischen
 * Parser.
 */

let db: FakeDb;
let kiAufrufe: string[];

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: () => db.client,
}));

vi.mock("@/lib/ai/transcribe", () => ({
  AUDIO_MAX_BYTES: 25 * 1024 * 1024,
  AUDIO_MAX_SEKUNDEN: 600,
  transkribiere: async () => {
    kiAufrufe.push("whisper");
    return { text: "Wand 3: 4 Meter mal 2,50 Meter", sekunden: 4 };
  },
}));

function start(aufmass: Record<string, unknown> = {}, optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      aufmass: [
        { id: "auf1", user_id: "u1", titel: "Bad", raum: "Bad", status: "offen", abgeschlossen_am: null, ...aufmass },
      ],
      aufmass_positionen: [],
      ki_nutzung: [],
      ki_anfragen: [],
    },
    { rpc: { ki_anfrage_erlaubt: true }, ...optionen },
  );
}

async function post(id: string, felder: Record<string, string> = { text: "Wand 3: 4 Meter mal 2,50 Meter" }) {
  const { POST } = await import("./route");
  const fd = new FormData();
  for (const [k, v] of Object.entries(felder)) fd.set(k, v);
  return POST(new Request(`http://localhost/api/aufmass/${id}/messung`, { method: "POST", body: fd }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.resetModules();
  kiAufrufe = [];
  start();
});

describe("Zugang", () => {
  it("weist ab, wer nicht angemeldet ist", async () => {
    start({}, { user: null });

    const antwort = await post("auf1");

    expect(antwort.status).toBe(401);
    expect(kiAufrufe).toEqual([]);
  });

  it("antwortet auf ein fremdes oder erfundenes Aufmass mit 404", async () => {
    expect((await post("gibtsnicht")).status).toBe(404);

    start({ user_id: "fremd" });
    expect((await post("auf1")).status).toBe(404);
    expect(db.tabellen.aufmass_positionen).toHaveLength(0);
  });

  it("nimmt in ein abgeschlossenes Aufmass nichts mehr auf", async () => {
    // Sonst wandert eine Messung in ein Aufmass, aus dem längst ein
    // Angebot entstanden ist.
    start({ status: "abgeschlossen" });

    expect((await post("auf1")).status).toBe(409);
    expect(db.tabellen.aufmass_positionen).toHaveLength(0);
  });
});

describe("Messung aufnehmen", () => {
  it("zerlegt den Text und legt die Zeile an", async () => {
    const antwort = await post("auf1");

    expect(antwort.status).toBe(200);
    expect(db.tabellen.aufmass_positionen).toHaveLength(1);

    const zeile = db.tabellen.aufmass_positionen[0];
    expect(zeile.aufmass_id).toBe("auf1");
    expect(zeile.laenge).toBe(4);
    expect(zeile.breite).toBe(2.5);
  });

  it("weist eine leere Eingabe ab, bevor sie Geld kostet", async () => {
    const antwort = await post("auf1", { text: "" });

    expect(antwort.status).toBe(400);
    expect(kiAufrufe).toEqual([]);
  });

  it("zählt die Zeilen fortlaufend weiter", async () => {
    await post("auf1");
    await post("auf1", { text: "Wand 4: 3 Meter mal 2,50 Meter" });

    expect(db.tabellen.aufmass_positionen.map((p) => p.pos_nr)).toEqual([1, 2]);
  });
});

describe("Kostenschutz", () => {
  it("bremst zu viele Anfragen mit 429", async () => {
    // Beim Aufmass kommen zwanzig Messungen hintereinander — die Bremse
    // zählt deshalb getrennt von der Angebotserstellung.
    start({}, { rpc: { ki_anfrage_erlaubt: false } });

    const antwort = await post("auf1");

    expect(antwort.status).toBe(429);
    expect(kiAufrufe).toEqual([]);
  });
});
