import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Rechnungs-Actions.
 *
 * Hier liegt das Geld und die Rechtssicherheit: eine Rechnung, die zu früh
 * festgeschrieben wird, lässt sich nicht mehr korrigieren; ein Storno, das
 * die Beträge nicht aufhebt, ergibt eine falsche Buchhaltung.
 *
 * Geprüft wird, WAS die Action schreiben will. Dass die Datenbank eine
 * gestellte Rechnung anschliessend dichtmacht, prüft scripts/db-test.sh
 * gegen echtes Postgres — beides zusammen deckt die Regel ab.
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
  rechnungNachricht: () => ({ betreff: "", text: "" }),
}));

const {
  rechnungAusAngebot,
  rechnungSpeichern,
  rechnungStellen,
  rechnungStornieren,
} = await import("./actions");

const ANGEBOT = {
  id: "a1",
  user_id: "u1",
  kunde_id: "k1",
  titel: "Badsanierung",
  mwst_satz: 19,
};

const POSITIONEN = [
  { id: "p1", angebot_id: "a1", pos_nr: 1, bezeichnung: "Fliesen", beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 52 },
  { id: "p2", angebot_id: "a1", pos_nr: 2, bezeichnung: "WC", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 380 },
];

beforeEach(() => {
  db = fakeSupabase(
    { angebote: [ANGEBOT], positionen: POSITIONEN, rechnungen: [], rechnung_positionen: [] },
    { rpc: { next_rechnung_nummer: "RE-2026-0001" } },
  );
});

describe("rechnungAusAngebot", () => {
  it("kopiert die Positionen, statt sie zu verknüpfen", async () => {
    await expect(rechnungAusAngebot("a1")).rejects.toThrow(/REDIRECT/);

    const positionen = db.tabellen.rechnung_positionen;
    expect(positionen).toHaveLength(2);
    // Eigene Zeilen mit eigenen IDs: eine spätere Änderung am Angebot darf
    // einen gestellten Beleg nicht rückwirkend verändern.
    expect(positionen.map((p) => p.id)).not.toContain("p1");
    expect(positionen[0]).toMatchObject({ bezeichnung: "Fliesen", menge: 8, einzelpreis: 52 });
  });

  it("legt die Rechnung als Entwurf an, nicht als Beleg", async () => {
    await expect(rechnungAusAngebot("a1")).rejects.toThrow(/REDIRECT/);

    const r = db.tabellen.rechnungen[0];
    expect(r.status).toBe("entwurf");
    expect(r.festgeschrieben_am).toBeNull();
    expect(r.nummer).toBe("RE-2026-0001");
    // Herkunft bleibt nachvollziehbar.
    expect(r.angebot_id).toBe("a1");
  });

  it("übernimmt den Steuersatz des Angebots", async () => {
    db.tabellen.angebote[0].mwst_satz = 0; // Kleinunternehmer
    await expect(rechnungAusAngebot("a1")).rejects.toThrow(/REDIRECT/);
    expect(db.tabellen.rechnungen[0].mwst_satz).toBe(0);
  });
});

describe("rechnungStellen", () => {
  beforeEach(() => {
    db.tabellen.rechnungen.push({
      id: "r1", user_id: "u1", nummer: "RE-2026-0001", netto: 936,
      status: "entwurf", festgeschrieben_am: null,
    });
  });

  it("schreibt fest und setzt das Rechnungsdatum", async () => {
    const ergebnis = await rechnungStellen("r1");
    expect(ergebnis.fehler).toBeUndefined();

    const r = db.tabellen.rechnungen[0];
    expect(r.status).toBe("gestellt");
    expect(r.festgeschrieben_am).toBeTruthy();
    // Das Rechnungsdatum ist erst jetzt fachlich wahr.
    expect(r.datum).toBe(new Date().toISOString().slice(0, 10));
  });

  it("weist eine Rechnung über 0 € ab", async () => {
    db.tabellen.rechnungen[0].netto = 0;
    const ergebnis = await rechnungStellen("r1");

    expect(ergebnis.fehler).toContain("0");
    expect(db.tabellen.rechnungen[0].festgeschrieben_am).toBeNull();
  });

  it("schreibt eine bereits gestellte Rechnung nicht erneut fest", async () => {
    db.tabellen.rechnungen[0].festgeschrieben_am = "2026-09-01T10:00:00Z";
    await rechnungStellen("r1");
    // Sonst würde das Rechnungsdatum bei jedem Klick weiterwandern.
    expect(db.tabellen.rechnungen[0].festgeschrieben_am).toBe("2026-09-01T10:00:00Z");
  });
});

describe("rechnungSpeichern", () => {
  it("lehnt Änderungen an einer gestellten Rechnung ab", async () => {
    db.tabellen.rechnungen.push({
      id: "r1", user_id: "u1", datum: "2026-09-01",
      festgeschrieben_am: "2026-09-01T10:00:00Z", titel: "Original",
    });

    const ergebnis = await rechnungSpeichern({
      rechnungId: "r1", titel: "Geändert", kundeId: null, notiz: null,
      leistungVon: null, leistungBis: null, zahlungszielTage: 14, positionen: [],
    });

    expect(ergebnis.fehler).toContain("gestellt");
    expect(db.tabellen.rechnungen[0].titel).toBe("Original");
  });

  it("rechnet die Fälligkeit aus Rechnungsdatum und Zahlungsziel", async () => {
    db.tabellen.rechnungen.push({
      id: "r1", user_id: "u1", datum: "2026-09-01", festgeschrieben_am: null,
    });

    await rechnungSpeichern({
      rechnungId: "r1", titel: "Bad", kundeId: null, notiz: null,
      leistungVon: null, leistungBis: null, zahlungszielTage: 14, positionen: [],
    });

    expect(db.tabellen.rechnungen[0].faellig_am).toBe("2026-09-15");
  });

  it("entfernt gelöschte Positionen und nummeriert neu durch", async () => {
    db.tabellen.rechnungen.push({ id: "r1", user_id: "u1", datum: "2026-09-01", festgeschrieben_am: null });
    db.tabellen.rechnung_positionen.push(
      { id: "rp1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "A", menge: 1, einheit: "stk", einzelpreis: 10 },
      { id: "rp2", rechnung_id: "r1", pos_nr: 2, bezeichnung: "B", menge: 1, einheit: "stk", einzelpreis: 20 },
    );

    // Der Nutzer hat die erste Zeile entfernt und eine neue angehängt.
    const ergebnis = await rechnungSpeichern({
      rechnungId: "r1", titel: "Bad", kundeId: null, notiz: null,
      leistungVon: null, leistungBis: null, zahlungszielTage: 14,
      positionen: [
        { id: "rp2", bezeichnung: "B", beschreibung: null, menge: 1, einheit: "stk", einzelpreis: 20 },
        { bezeichnung: "C", beschreibung: null, menge: 2, einheit: "stk", einzelpreis: 30 },
      ],
    });

    const zeilen = db.tabellen.rechnung_positionen;
    expect(zeilen.map((z) => z.bezeichnung).sort()).toEqual(["B", "C"]);
    // Durchnummeriert, damit das PDF keine Lücken zeigt.
    expect(zeilen.find((z) => z.bezeichnung === "B")!.pos_nr).toBe(1);
    expect(zeilen.find((z) => z.bezeichnung === "C")!.pos_nr).toBe(2);
    // Die neue Zeile bekommt ihre ID zurück, sonst legt der nächste
    // Speicherlauf sie ein zweites Mal an.
    expect(ergebnis.positionIds).toHaveLength(2);
  });
});

describe("rechnungStornieren", () => {
  beforeEach(() => {
    db.tabellen.rechnungen.push({
      id: "r1", user_id: "u1", nummer: "RE-2026-0001", titel: "Bad",
      kunde_id: "k1", angebot_id: "a1", mwst_satz: 19, status: "gestellt",
      leistung_von: "2026-09-01", leistung_bis: "2026-09-05",
      festgeschrieben_am: "2026-09-05T10:00:00Z",
    });
    db.tabellen.rechnung_positionen.push({
      id: "rp1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Fliesen",
      beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 52,
    });
  });

  it("legt eine Stornorechnung mit negativen Mengen an", async () => {
    const ergebnis = await rechnungStornieren("r1");
    expect(ergebnis.fehler).toBeUndefined();

    const storno = db.tabellen.rechnungen.find((r) => r.id === ergebnis.stornoId)!;
    expect(storno.nummer).toBe("RE-2026-0001"); // aus dem Nummernkreis
    expect(storno.titel).toContain("Storno");

    const zeile = db.tabellen.rechnung_positionen.find((p) => p.rechnung_id === storno.id)!;
    // Negative Menge statt negativem Preis: die Summen ergeben sich dann von
    // selbst wieder aus den Positionen.
    expect(zeile.menge).toBe(-8);
    expect(zeile.einzelpreis).toBe(52);
  });

  it("schreibt das Storno sofort fest und kennzeichnet das Original", async () => {
    const ergebnis = await rechnungStornieren("r1");

    const storno = db.tabellen.rechnungen.find((r) => r.id === ergebnis.stornoId)!;
    // Ein änderbares Storno wäre sinnlos.
    expect(storno.festgeschrieben_am).toBeTruthy();
    expect(storno.status).toBe("storniert");

    const original = db.tabellen.rechnungen.find((r) => r.id === "r1")!;
    expect(original.status).toBe("storniert");
    expect(original.storniert_durch).toBe(storno.id);
    // Beträge und Nummer des Originals bleiben unangetastet — es bleibt Beleg.
    expect(original.nummer).toBe("RE-2026-0001");
  });

  it("storniert keinen Entwurf", async () => {
    db.tabellen.rechnungen[0].festgeschrieben_am = null;
    const ergebnis = await rechnungStornieren("r1");

    expect(ergebnis.fehler).toContain("Entwurf");
    expect(db.tabellen.rechnungen).toHaveLength(1);
  });

  it("storniert nicht zweimal", async () => {
    await rechnungStornieren("r1");
    const zweiter = await rechnungStornieren("r1");
    expect(zweiter.fehler).toContain("Bereits storniert");
  });
});
