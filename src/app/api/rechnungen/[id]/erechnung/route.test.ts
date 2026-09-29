import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Download der E-Rechnung
 * =============================================================================
 * Hier wurde bisher nur geprüft, was in der XML steht (en16931.test.ts) — nicht,
 * wer sie bekommt. Genau das ist der Teil, der im Betrieb wehtut: die Datei
 * enthält vollständige Kunden- und Bankdaten.
 */

let db: FakeDb;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));

const FIRMA = {
  id: "u1", firma_name: "Schulz Sanitär GmbH", inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8", plz: "50667", ort: "Köln", telefon: "0221 123456",
  email: "info@schulz.de", steuernummer: "215/5721/0341", ust_id: "DE123456789",
  iban: "DE89 3704 0044 0532 0130 00", kleinunternehmer: false, mwst_satz: 19,
};

const RECHNUNG = {
  id: "r1", user_id: "u1", kunde_id: "k1", nummer: "RE-2026-0016", status: "gestellt",
  datum: "2026-08-26", leistung_von: "2026-08-20", faellig_am: "2026-09-08",
  netto: 420, mwst_satz: 19, mwst_betrag: 79.8, brutto: 499.8,
  festgeschrieben_am: "2026-08-26T10:00:00Z",
};

function start(aenderung: Record<string, unknown> = {}, optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      profiles: [FIRMA],
      rechnungen: [{ ...RECHNUNG, ...aenderung }],
      kunden: [{ id: "k1", user_id: "u1", name: "Hausverwaltung Nord", strasse: "Ringstr. 40", plz: "50733", ort: "Köln" }],
      rechnung_positionen: [
        { id: "p1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Wartung Gastherme", menge: 1, einheit: "pauschal", einzelpreis: 420, gesamtpreis: 420 },
      ],
    },
    optionen,
  );
}

async function hole(id = "r1") {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/rechnungen/${id}/erechnung`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.resetModules();
  start();
});

describe("Zugriff", () => {
  it("weist ab, wer nicht angemeldet ist", async () => {
    start({}, { user: null });
    expect((await hole()).status).toBe(401);
  });

  it("gibt die Rechnung eines anderen Betriebs nicht heraus", async () => {
    // So verhält sich auch die Datenbank: RLS liefert die Zeile gar nicht.
    // Der Filter auf user_id im Code ist die zweite Schicht.
    start({ user_id: "fremd" });

    const antwort = await hole();

    expect(antwort.status).toBe(404);
    expect(await antwort.text()).not.toContain("Hausverwaltung");
  });

  it("gibt den Kunden eines anderen Betriebs nicht mit heraus", async () => {
    db.tabellen.kunden[0].user_id = "fremd";
    expect((await hole()).status).toBe(422);
  });
});

describe("Zustand der Rechnung", () => {
  it("liefert keine E-Rechnung für einen Entwurf", async () => {
    // Eine nicht festgeschriebene Rechnung darf nicht in die Buchhaltung des
    // Kunden wandern — sie kann sich noch ändern.
    start({ festgeschrieben_am: null, status: "entwurf" });

    const antwort = await hole();

    expect(antwort.status).toBe(409);
  });

  it("nennt die fehlenden Angaben, statt eine kaputte Datei zu liefern", async () => {
    db.tabellen.profiles[0].strasse = null;

    const antwort = await hole();

    expect(antwort.status).toBe(422);
    expect(await antwort.text()).toContain("Firmenstrasse");
  });
});

describe("die Datei selbst", () => {
  it("liefert XML zum Download mit sprechendem Dateinamen", async () => {
    const antwort = await hole();

    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("Content-Type")).toContain("xml");
    expect(antwort.headers.get("Content-Disposition")).toContain("RE-2026-0016");

    const xml = await antwort.text();
    expect(xml).toContain("urn:cen.eu:en16931:2017");
    expect(xml).toContain("<ram:ID>RE-2026-0016</ram:ID>");
  });

  it("wird nicht zwischengespeichert", async () => {
    const antwort = await hole();
    expect(antwort.headers.get("Cache-Control") ?? "").toMatch(/no-store|private/);
  });
});
