import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * CSV-Export
 * =============================================================================
 * Der Weg aus dem Produkt heraus. Er muss funktionieren, weil er das
 * Versprechen einlöst, dass die Daten dem Betrieb gehören — und weil ein
 * Export, der in Excel als Buchstabensalat aufgeht, niemandem nützt.
 */

let db: FakeDb;

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));

function start(optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      kunden: [
        { id: "k1", user_id: "u1", name: "Familie Becker", ansprechpartner: null,
          strasse: "Lindenstr. 12", plz: "50667", ort: "Köln", email: null,
          telefon: null, notizen: 'Sagt: "lieber vormittags"' },
      ],
      preisliste: [
        { id: "p1", user_id: "u1", bezeichnung: "Fliesen verlegen", kategorie: "Fliesen",
          einheit: "m2", einzelpreis: 52, beschreibung: null, stichworte: ["bad"], aktiv: true },
      ],
      angebote: [
        { id: "a1", user_id: "u1", kunde_id: "k1", nummer: "AN-2026-0041", titel: "Bad",
          status: "entwurf", datum: "2026-09-23", netto: 2754, mwst_betrag: 523.26, brutto: 3277.26 },
      ],
      rechnungen: [
        { id: "r1", user_id: "u1", kunde_id: "k1", nummer: "RE-2026-0016", titel: "Wartung",
          status: "gestellt", datum: "2026-08-26", netto: 420, mwst_betrag: 79.8, brutto: 499.8 },
      ],
    },
    optionen,
  );
}

async function hole(was: string) {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/export/${was}`), {
    params: Promise.resolve({ was }),
  });
}

beforeEach(() => {
  vi.resetModules();
  start();
});

describe("Zugang", () => {
  it("weist ab, wer nicht angemeldet ist", async () => {
    start({ user: null });
    expect((await hole("kunden")).status).toBe(401);
  });

  it("antwortet auf einen erfundenen Export mit 404, nicht mit 500", async () => {
    // Sonst sieht jeder Tippfehler in der Adresse wie ein Serverfehler aus.
    expect((await hole("unsinn")).status).toBe(404);
    expect((await hole("../../etc/passwd")).status).toBe(404);
  });
});

describe("die vier Exporte", () => {
  for (const was of ["kunden", "preisliste", "angebote", "rechnungen"]) {
    it(`liefert ${was} als CSV zum Herunterladen`, async () => {
      const antwort = await hole(was);

      expect(antwort.status, was).toBe(200);
      expect(antwort.headers.get("Content-Type")).toContain("csv");
      expect(antwort.headers.get("Content-Disposition")).toContain(`${was}-`);
      expect((await antwort.text()).length).toBeGreaterThan(10);
    });
  }
});

describe("damit Excel es lesen kann", () => {
  it("beginnt mit der Bytefolge für UTF-8", async () => {
    // Ohne sie macht Excel unter Windows aus "Köln" ein "KÃ¶ln" — und das
    // ist der erste Eindruck vom Export.
    //
    // Geprüft wird auf Byte-Ebene: `text()` dekodiert als UTF-8 und
    // entfernt die Kennung dabei, ein Test darauf wäre also blind.
    const bytes = new Uint8Array(await (await hole("kunden")).arrayBuffer());

    expect([bytes[0], bytes[1], bytes[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("trennt mit Semikolon und beendet Zeilen mit CRLF", async () => {
    // Komma als Trenner legt in Excel die ganze Zeile in Spalte A.
    const text = await (await hole("preisliste")).text();

    expect(text.split("\r\n")[0]).toContain(";");
    expect(text).toContain("\r\n");
  });

  it("schützt Anführungszeichen im Text", async () => {
    const text = await (await hole("kunden")).text();
    // Ein ungeschütztes " zerlegt die Zeile beim Einlesen.
    expect(text).toContain('""lieber vormittags""');
  });

  it("nennt die Beträge in deutscher Schreibweise", async () => {
    const text = await (await hole("angebote")).text();
    expect(text).toContain("3277,26");
  });
});
