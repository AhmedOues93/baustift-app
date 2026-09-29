import { PDFParse } from "pdf-parse";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * PDF-Ausgabe von Angebot und Rechnung
 * =============================================================================
 * Diese beiden Routen haben in Produktion über Tage 500 geliefert, während
 * alle Tests grün waren — weil kein Test die Route selbst aufgerufen hat, nur
 * die PDF-Bausteine darunter. Also wird hier die Route aufgerufen, vom
 * Aufruf bis zum lesbaren Text im PDF.
 *
 * Und, zweiter Punkt: das PDF enthält Anschrift, Preise und Bankverbindung.
 * Wer es abrufen darf, ist damit eine Zugriffsfrage, keine Formatfrage.
 */

let db: FakeDb;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));

const FIRMA = {
  id: "u1", firma_name: "Schulz Sanitär GmbH", inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8", plz: "50667", ort: "Köln", telefon: "0221 123456",
  email: "info@schulz.de", steuernummer: "215/5721/0341", ust_id: "DE123456789",
  iban: "DE89 3704 0044 0532 0130 00", bic: "COLSDE33", bank_name: "Sparkasse",
  logo_url: null, kleinunternehmer: false, mwst_satz: 19, angebot_gueltig_tage: 30,
};

const KUNDE = {
  id: "k1", user_id: "u1", name: "Hausverwaltung Nord",
  strasse: "Ringstr. 40", plz: "50733", ort: "Köln",
};

function start(aenderung: { angebot?: Record<string, unknown>; rechnung?: Record<string, unknown> } = {}, optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      profiles: [FIRMA],
      kunden: [KUNDE],
      angebote: [{
        id: "a1", user_id: "u1", kunde_id: "k1", nummer: "AN-2026-0041",
        titel: "Bad Erdgeschoss", status: "entwurf", datum: "2026-08-20",
        gueltig_bis: "2026-09-19", netto: 576, mwst_satz: 19, mwst_betrag: 109.44,
        brutto: 685.44, transkript: null, ki_hinweis: null, notiz: null,
        ...(aenderung.angebot ?? {}),
      }],
      positionen: [{
        id: "p1", angebot_id: "a1", pos_nr: 1, bezeichnung: "Wandfliesen verlegen",
        beschreibung: null, menge: 12, einheit: "m2", einzelpreis: 48, gesamtpreis: 576,
      }],
      rechnungen: [{
        id: "r1", user_id: "u1", kunde_id: "k1", nummer: "RE-2026-0016",
        titel: "Wartung Heizung", status: "gestellt", datum: "2026-08-26",
        leistung_von: "2026-08-20", faellig_am: "2026-09-08", zahlungsziel_tage: 14,
        netto: 420, mwst_satz: 19, mwst_betrag: 79.8, brutto: 499.8,
        festgeschrieben_am: "2026-08-26T10:00:00Z", notiz: null,
        ...(aenderung.rechnung ?? {}),
      }],
      rechnung_positionen: [{
        id: "rp1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Wartung Gastherme",
        beschreibung: null, menge: 1, einheit: "pauschal", einzelpreis: 420, gesamtpreis: 420,
      }],
    },
    optionen,
  );
}

async function angebotPdf(id = "a1", abfrage = "") {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/api/angebote/${id}/pdf${abfrage}`), {
    params: Promise.resolve({ id }),
  });
}

async function rechnungPdf(id = "r1") {
  const { GET } = await import("../../../rechnungen/[id]/pdf/route");
  return GET(new Request(`http://localhost/api/rechnungen/${id}/pdf`), {
    params: Promise.resolve({ id }),
  });
}

async function text(antwort: Response): Promise<string> {
  const puffer = Buffer.from(await antwort.arrayBuffer());
  const gelesen = await new PDFParse({ data: puffer }).getText();
  return gelesen.text.replace(/\s+/g, " ");
}

beforeEach(() => {
  vi.resetModules();
  start();
});

describe("Angebots-PDF", () => {
  it("liefert ein PDF, in dem Nummer, Kunde und Summe stehen", async () => {
    const antwort = await angebotPdf();

    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("Content-Type")).toBe("application/pdf");

    const inhalt = await text(antwort);
    expect(inhalt).toContain("AN-2026-0041");
    expect(inhalt).toContain("Hausverwaltung Nord");
    expect(inhalt).toContain("Wandfliesen verlegen");
    expect(inhalt).toContain("685,44");
  });

  it("zeigt es im Browser an, lädt es aber auf Wunsch herunter", async () => {
    expect((await angebotPdf("a1")).headers.get("Content-Disposition")).toContain("inline");

    start();
    const geladen = await angebotPdf("a1", "?download=1");
    expect(geladen.headers.get("Content-Disposition")).toContain("attachment");
    expect(geladen.headers.get("Content-Disposition")).toContain("Angebot-AN-2026-0041.pdf");
  });

  it("landet nicht in einem Zwischenspeicher", async () => {
    expect((await angebotPdf()).headers.get("Cache-Control")).toContain("no-store");
  });

  it("weist ab, wer nicht angemeldet ist", async () => {
    start({}, { user: null });
    expect((await angebotPdf()).status).toBe(401);
  });

  it("gibt das Angebot eines anderen Betriebs nicht heraus", async () => {
    start({ angebot: { user_id: "fremd" } });

    const antwort = await angebotPdf();

    expect(antwort.status).toBe(404);
    expect(await antwort.text()).not.toContain("Hausverwaltung");
  });

  it("antwortet mit 404 bei einer erfundenen Kennung, nicht mit 500", async () => {
    expect((await angebotPdf("gibt-es-nicht")).status).toBe(404);
  });
});

describe("Rechnungs-PDF", () => {
  it("liefert ein PDF mit Nummer, Fälligkeit und Bankverbindung", async () => {
    const antwort = await rechnungPdf();

    expect(antwort.status).toBe(200);

    const inhalt = await text(antwort);
    expect(inhalt).toContain("RE-2026-0016");
    expect(inhalt).toContain("DE89 3704 0044 0532 0130 00");
    expect(inhalt).toContain("499,80");
  });

  it("gibt die Rechnung eines anderen Betriebs nicht heraus", async () => {
    start({ rechnung: { user_id: "fremd" } });
    expect((await rechnungPdf()).status).toBe(404);
  });

  it("weist ab, wer nicht angemeldet ist", async () => {
    start({}, { user: null });
    expect((await rechnungPdf()).status).toBe(401);
  });
});
