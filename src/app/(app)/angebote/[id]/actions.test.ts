import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Angebots-Actions.
 *
 * Der heikle Teil ist das Speichern der Positionen: die Zeilen kommen als
 * vollständige Liste, und die Action muss daraus ableiten, was gelöscht,
 * geändert und angelegt gehört. Ein Fehler darin löscht entweder fremde
 * Zeilen oder legt bei jedem Tastendruck neue an.
 */

let db: FakeDb;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: async () => db.client,
}));
vi.mock("@/lib/email/senden", () => ({
  emailVerfuegbar: () => false,
  sendeEmail: async () => ({}),
  angebotNachricht: () => ({ betreff: "", text: "" }),
}));

const { angebotKopieren, angebotSpeichern, statusSetzen } = await import(
  "./actions",
);

beforeEach(() => {
  db = fakeSupabase(
    {
      angebote: [
        { id: "a1", user_id: "u1", status: "entwurf", titel: "Alt", netto: 0, mwst_betrag: 0, brutto: 0, kunde_id: "k1", notiz: "Gültig 14 Tage." },
      ],
      positionen: [
        { id: "p1", angebot_id: "a1", pos_nr: 1, bezeichnung: "Fliesen", beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 52, zu_pruefen: false },
        { id: "p2", angebot_id: "a1", pos_nr: 2, bezeichnung: "WC", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 380, zu_pruefen: true },
      ],
      profiles: [{ id: "u1", mwst_satz: 19, kleinunternehmer: false, angebot_gueltig_tage: 14 }],
    },
    { rpc: { next_angebot_nummer: "AN-2026-0002" } },
  );
});

function speichern(positionen: any[], extra: Partial<Record<string, unknown>> = {}) {
  return angebotSpeichern({
    angebotId: "a1",
    titel: "Badsanierung",
    kundeId: null,
    notiz: null,
    positionen,
    ...extra,
  } as any);
}

describe("angebotSpeichern", () => {
  it("behält bestehende Zeilen und ergänzt neue", async () => {
    const ergebnis = await speichern([
      { id: "p1", bezeichnung: "Fliesen", beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 52, preisliste_id: null, zu_pruefen: false },
      { id: "p2", bezeichnung: "WC", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 380, preisliste_id: null, zu_pruefen: false },
      { bezeichnung: "Entsorgung", beschreibung: null, menge: 1, einheit: "pauschal", einzelpreis: 180, preisliste_id: null, zu_pruefen: false },
    ]);

    expect(db.tabellen.positionen).toHaveLength(3);
    // Die vorhandenen IDs bleiben — sonst verliert das Formular beim
    // nächsten Speicherlauf die Zuordnung.
    expect(ergebnis.positionIds!.slice(0, 2)).toEqual(["p1", "p2"]);
  });

  it("löscht entfernte Zeilen, aber nur die des eigenen Angebots", async () => {
    db.tabellen.positionen.push({
      id: "fremd", angebot_id: "a2", pos_nr: 1, bezeichnung: "Anderes Angebot",
      menge: 1, einheit: "stk", einzelpreis: 99, zu_pruefen: false,
    });

    await speichern([
      { id: "p2", bezeichnung: "WC", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 380, preisliste_id: null, zu_pruefen: false },
    ]);

    const eigene = db.tabellen.positionen.filter((p) => p.angebot_id === "a1");
    expect(eigene.map((p) => p.id)).toEqual(["p2"]);
    // Die Zeile eines anderen Angebots darf der Löschlauf nicht erwischen.
    expect(db.tabellen.positionen.some((p) => p.id === "fremd")).toBe(true);
  });

  it("löscht alle Zeilen, wenn der Nutzer die letzte entfernt", async () => {
    await speichern([]);
    expect(db.tabellen.positionen.filter((p) => p.angebot_id === "a1")).toHaveLength(0);
  });

  it("nummeriert die Zeilen in der übergebenen Reihenfolge durch", async () => {
    await speichern([
      { id: "p2", bezeichnung: "WC", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 380, preisliste_id: null, zu_pruefen: false },
      { id: "p1", bezeichnung: "Fliesen", beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 52, preisliste_id: null, zu_pruefen: false },
    ]);

    const nach = (id: string) => db.tabellen.positionen.find((p) => p.id === id)!;
    expect(nach("p2").pos_nr).toBe(1);
    expect(nach("p1").pos_nr).toBe(2);
  });

  it("ersetzt unsinnige Werte, statt sie zu speichern", async () => {
    await speichern([
      { id: "p1", bezeichnung: "   ", beschreibung: null, menge: Number.NaN, einheit: "m2", einzelpreis: Number.NaN, preisliste_id: null, zu_pruefen: false },
    ]);

    const zeile = db.tabellen.positionen.find((p) => p.id === "p1")!;
    // Eine leere Position im PDF sieht nach einem Fehler des Handwerkers aus.
    expect(zeile.bezeichnung).toBe("Position");
    expect(zeile.menge).toBe(1);
    expect(zeile.einzelpreis).toBe(0);
  });

  it("verweigert fremde Angebote", async () => {
    db.tabellen.angebote[0].user_id = "jemand-anderes";
    const ergebnis = await speichern([]);

    expect(ergebnis.fehler).toContain("nicht gefunden");
    // Und rührt dabei nichts an.
    expect(db.tabellen.positionen).toHaveLength(2);
  });
});

describe("statusSetzen", () => {
  it("setzt beim Versenden den Zeitstempel fürs Nachfassen", async () => {
    await statusSetzen("a1", "gesendet");

    const a = db.tabellen.angebote[0];
    expect(a.status).toBe("gesendet");
    expect(a.gesendet_am).toBeTruthy();
    // Entschieden ist noch nichts.
    expect(a.entschieden_am).toBeUndefined();
  });

  it("setzt bei Annahme und Absage den Entscheidungszeitpunkt", async () => {
    await statusSetzen("a1", "angenommen");
    expect(db.tabellen.angebote[0].entschieden_am).toBeTruthy();
  });

  it("setzt beim Zurücksetzen auf Entwurf keine Zeitstempel", async () => {
    await statusSetzen("a1", "entwurf");
    const a = db.tabellen.angebote[0];
    expect(a.gesendet_am).toBeUndefined();
    expect(a.entschieden_am).toBeUndefined();
  });
});

describe("angebotKopieren", () => {
  it("legt einen Entwurf mit eigener Nummer und allen Positionen an", async () => {
    const ergebnis = await angebotKopieren("a1");

    const kopie = db.tabellen.angebote.find((a) => a.id === ergebnis.angebotId)!;
    expect(kopie.nummer).toBe("AN-2026-0002");
    expect(kopie.status).toBe("entwurf");
    expect(kopie.titel).toBe("Alt (Kopie)");
    // Fachlicher Inhalt kommt mit.
    expect(kopie.kunde_id).toBe("k1");
    expect(kopie.notiz).toBe("Gültig 14 Tage.");

    const zeilen = db.tabellen.positionen
      .filter((p) => p.angebot_id === kopie.id)
      .sort((a, b) => a.pos_nr - b.pos_nr);
    expect(zeilen.map((z) => [z.bezeichnung, z.einzelpreis, z.zu_pruefen])).toEqual([
      ["Fliesen", 52, false],
      ["WC", 380, true],
    ]);
  });

  it("nimmt die Geschichte des Originals nicht mit", async () => {
    db.tabellen.angebote[0].gesendet_am = "2026-01-05T10:00:00Z";
    db.tabellen.angebote[0].status = "angenommen";

    const { angebotId } = await angebotKopieren("a1");
    const kopie = db.tabellen.angebote.find((a) => a.id === angebotId)!;

    expect(kopie.gesendet_am).toBeNull();
    expect(kopie.entschieden_am).toBeNull();
    expect(kopie.pdf_path).toBeNull();
    // Das Diktat gehört zum Original — zu dieser Kopie hat nie eins
    // stattgefunden.
    expect(kopie.transkript).toBeNull();
    expect(kopie.ki_hinweis).toBeNull();
    // Und sie darf die Sprachquote des Piloten nicht verfälschen.
    expect(kopie.eingabe_art).toBe("kopie");
    expect(kopie.aufnahme_sekunden).toBeNull();
  });

  it("rechnet mit den heutigen Firmendaten, nicht mit denen des Originals", async () => {
    db.tabellen.angebote[0].mwst_satz = 7;
    db.tabellen.profiles[0].kleinunternehmer = true;

    const { angebotId } = await angebotKopieren("a1");
    const kopie = db.tabellen.angebote.find((a) => a.id === angebotId)!;

    // Kleinunternehmer weisen keine Umsatzsteuer aus (§ 19 UStG).
    expect(kopie.mwst_satz).toBe(0);
  });

  it("kopiert keine fremden Angebote", async () => {
    db.tabellen.angebote[0].user_id = "jemand-anderes";

    const ergebnis = await angebotKopieren("a1");
    expect(ergebnis.fehler).toContain("nicht gefunden");
    expect(db.tabellen.angebote).toHaveLength(1);
  });
});
