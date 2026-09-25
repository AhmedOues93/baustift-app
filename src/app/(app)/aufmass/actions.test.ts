import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Aufmass-Actions.
 *
 * Der heikle Teil ist der Übergang ins Angebot: dort wird aus vielen Massen
 * eine Menge und aus einer Menge ein Preis. Ein Fehler darin geht als Zahl
 * raus, die niemand nachrechnet.
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

const { angebotAusAufmass, aufmassAbschliessen, messungSpeichern } = await import(
  "./actions"
);

const PREISE = [
  {
    id: "p1", user_id: "u1", bezeichnung: "Fliesen verlegen 30x60",
    beschreibung: null, kategorie: "Fliesenarbeiten", einheit: "m2",
    einzelpreis: 52, stichworte: [], aktiv: true,
  },
  {
    id: "p2", user_id: "u1", bezeichnung: "Silikonfugen erneuern",
    beschreibung: null, kategorie: "Fliesenarbeiten", einheit: "m",
    einzelpreis: 12.5, stichworte: [], aktiv: true,
  },
  {
    id: "p3", user_id: "u1", bezeichnung: "Monteurstunde",
    beschreibung: null, kategorie: "Arbeitszeit", einheit: "h",
    einzelpreis: 62, stichworte: [], aktiv: true,
  },
];

/** Eine Messung, wie die Datenbank sie zurückgibt (wert ist generiert). */
function messung(teil: Record<string, unknown>) {
  return {
    id: `m${Math.random().toString(36).slice(2, 8)}`,
    aufmass_id: "auf1", pos_nr: 1, raum: null, bezeichnung: "Messung",
    art: "flaeche", laenge: null, breite: null, hoehe: null, anzahl: 1,
    abzug: false, wert: null, einheit: "m2", gesprochen: null,
    zu_pruefen: false, ...teil,
  };
}

beforeEach(() => {
  db = fakeSupabase(
    {
      aufmass: [
        {
          id: "auf1", user_id: "u1", kunde_id: "k1", titel: "Bad Lindenstr. 12",
          status: "offen", notiz: null, angebot_id: null, abgeschlossen_am: null,
        },
      ],
      aufmass_positionen: [
        messung({ pos_nr: 1, raum: "Bad", bezeichnung: "Wand 1", wert: 12, einheit: "m2" }),
        messung({ pos_nr: 2, raum: "Bad", bezeichnung: "Wand 2", wert: 10, einheit: "m2" }),
        messung({ pos_nr: 3, raum: "Bad", bezeichnung: "Fenster", wert: 1.68, einheit: "m2", abzug: true }),
        messung({ pos_nr: 4, raum: "Bad", bezeichnung: "Silikonfuge", wert: 8.4, einheit: "m", art: "laenge" }),
      ],
      preisliste: PREISE,
      angebote: [],
      positionen: [],
      profiles: [{ id: "u1", mwst_satz: 19, kleinunternehmer: false, angebot_gueltig_tage: 30 }],
    },
    { rpc: { next_angebot_nummer: "AN-2026-0007" } },
  );
});

describe("angebotAusAufmass", () => {
  it("macht aus jeder Gruppe eine Position mit der Summe", async () => {
    const ergebnis = await angebotAusAufmass("auf1", {});

    expect(ergebnis.angebotId).toBeTruthy();
    const positionen = db.tabellen.positionen;
    expect(positionen).toHaveLength(2);

    // 12 + 10 − 1,68 = 20,32 m²
    const flaeche = positionen.find((p) => p.einheit === "m2")!;
    expect(flaeche.menge).toBe(20.32);

    const laenge = positionen.find((p) => p.einheit === "m")!;
    expect(laenge.menge).toBe(8.4);
  });

  it("übernimmt den Preis der gewählten Leistung", async () => {
    await angebotAusAufmass("auf1", { "Bad|m2": "p1", "Bad|m": "p2" });

    const flaeche = db.tabellen.positionen.find((p) => p.einheit === "m2")!;
    expect(flaeche.bezeichnung).toBe("Fliesen verlegen 30x60");
    expect(flaeche.einzelpreis).toBe(52);
    expect(flaeche.preisliste_id).toBe("p1");
    expect(flaeche.zu_pruefen).toBe(false);
  });

  it("legt ohne gewählte Leistung eine Zeile ohne Preis an, markiert", async () => {
    await angebotAusAufmass("auf1", {});

    const flaeche = db.tabellen.positionen.find((p) => p.einheit === "m2")!;
    expect(flaeche.einzelpreis).toBe(0);
    // Kein Fehler, eine offene Frage: im Angebot gelb markiert.
    expect(flaeche.zu_pruefen).toBe(true);
  });

  it("schreibt die gemessenen Einzelheiten in die Beschreibung", async () => {
    await angebotAusAufmass("auf1", {});

    const flaeche = db.tabellen.positionen.find((p) => p.einheit === "m2")!;
    // Der Kunde misst nach und fragt, warum 20,32 und nicht 22.
    expect(flaeche.beschreibung).toContain("Wand 1");
    expect(flaeche.beschreibung).toContain("− Fenster");
  });

  it("schliesst das Aufmass ab und verknüpft es mit dem Angebot", async () => {
    const ergebnis = await angebotAusAufmass("auf1", {});

    const auf = db.tabellen.aufmass[0];
    expect(auf.status).toBe("abgeschlossen");
    expect(auf.angebot_id).toBe(ergebnis.angebotId);
    // Sonst ändert jemand später ein Mass, und das verschickte Angebot
    // beruft sich auf Zahlen, die es nicht mehr gibt.
  });

  it("übernimmt Kunde und Titel des Aufmasses", async () => {
    await angebotAusAufmass("auf1", {});
    const angebot = db.tabellen.angebote[0];
    expect(angebot.kunde_id).toBe("k1");
    expect(angebot.titel).toBe("Bad Lindenstr. 12");
    // Eigene Eingabeart: verfälscht die Sprachquote des Piloten nicht.
    expect(angebot.eingabe_art).toBe("aufmass");
  });

  it("erstellt kein zweites Angebot aus demselben Aufmass", async () => {
    await angebotAusAufmass("auf1", {});
    const zweiter = await angebotAusAufmass("auf1", {});

    expect(zweiter.fehler).toContain("schon ein Angebot");
    expect(db.tabellen.angebote).toHaveLength(1);
  });

  it("rührt fremde Aufmasse nicht an", async () => {
    db.tabellen.aufmass[0].user_id = "jemand-anderes";
    const ergebnis = await angebotAusAufmass("auf1", {});

    expect(ergebnis.fehler).toContain("nicht gefunden");
    expect(db.tabellen.angebote).toHaveLength(0);
  });
});

describe("aufmassAbschliessen", () => {
  it("schliesst ab, wenn etwas gemessen wurde", async () => {
    const ergebnis = await aufmassAbschliessen("auf1");

    expect(ergebnis.fehler).toBeUndefined();
    expect(db.tabellen.aufmass[0].status).toBe("abgeschlossen");
    expect(db.tabellen.aufmass[0].abgeschlossen_am).toBeTruthy();
  });

  it("schliesst kein leeres Aufmass ab", async () => {
    db.tabellen.aufmass_positionen = [];
    const ergebnis = await aufmassAbschliessen("auf1");

    expect(ergebnis.fehler).toContain("noch nichts gemessen");
    expect(db.tabellen.aufmass[0].status).toBe("offen");
  });
});

describe("messungSpeichern", () => {
  it("nimmt die Korrektur an und markiert die Zeile als geprüft", async () => {
    const id = db.tabellen.aufmass_positionen[0].id;
    db.tabellen.aufmass_positionen[0].zu_pruefen = true;

    await messungSpeichern({
      messungId: id, raum: "Bad", bezeichnung: "Wand 1", art: "flaeche",
      laenge: 5, breite: 2.05, hoehe: null, anzahl: 1, abzug: false,
    });

    const m = db.tabellen.aufmass_positionen[0];
    expect(m.breite).toBe(2.05);
    // Von Hand angefasst heisst geprüft.
    expect(m.zu_pruefen).toBe(false);
  });

  it("ersetzt eine unsinnige Anzahl durch 1", async () => {
    const id = db.tabellen.aufmass_positionen[0].id;

    await messungSpeichern({
      messungId: id, raum: null, bezeichnung: "Wand", art: "flaeche",
      laenge: 5, breite: 2, hoehe: null, anzahl: Number.NaN, abzug: false,
    });

    expect(db.tabellen.aufmass_positionen[0].anzahl).toBe(1);
  });
});

describe("Wenn die Abzüge überwiegen", () => {
  it("übernimmt keine Position mit negativer Menge", async () => {
    // Eine Zeile über "−3,57 m²" wäre nicht nur falsch — sie ginge so zum
    // Kunden.
    db.tabellen.aufmass_positionen = [
      messung({ pos_nr: 1, raum: "Bad", bezeichnung: "Fenster", wert: 1.68, abzug: true }),
      messung({ pos_nr: 2, raum: "Bad", bezeichnung: "Tür", wert: 1.89, abzug: true }),
    ];

    const ergebnis = await angebotAusAufmass("auf1", {});

    expect(ergebnis.fehler).toContain("Abzüge sind grösser");
    expect(db.tabellen.angebote).toHaveLength(0);
  });

  it("lässt die brauchbaren Gruppen durch und die kaputte weg", async () => {
    db.tabellen.aufmass_positionen = [
      messung({ pos_nr: 1, raum: "Bad", bezeichnung: "Fenster", wert: 5, abzug: true }),
      messung({ pos_nr: 2, raum: "Küche", bezeichnung: "Boden", wert: 12 }),
    ];

    await angebotAusAufmass("auf1", {});

    expect(db.tabellen.positionen).toHaveLength(1);
    expect(db.tabellen.positionen[0].menge).toBe(12);
  });
});
