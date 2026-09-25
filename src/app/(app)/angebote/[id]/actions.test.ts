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
/**
 * E-Mail-Versand als Doppelgänger: die Nachfass-Tests müssen sehen, ob eine
 * Mail rausging und an wen — und der Versand muss umschaltbar sein, weil die
 * App ohne Resend-Schlüssel weiterläuft.
 */
const post = {
  verfuegbar: false,
  gesendet: [] as { an: string; betreff: string }[],
  fehler: undefined as string | undefined,
};

vi.mock("@/lib/email/senden", () => ({
  emailVerfuegbar: () => post.verfuegbar,
  sendeEmail: async (args: { an: string; betreff: string }) => {
    if (post.fehler) return { fehler: post.fehler };
    post.gesendet.push({ an: args.an, betreff: args.betreff });
    return {};
  },
  angebotNachricht: () => ({ betreff: "", text: "" }),
  nachfassNachricht: (args: { stufe: number }) => ({
    betreff: `Nachfrage (Stufe ${args.stufe})`,
    text: "",
  }),
}));

vi.mock("@/lib/pdf/erzeugen", () => ({
  angebotPdfErzeugen: async (_client: unknown, id: string) => {
    const angebot = db.tabellen.angebote.find((a) => a.id === id);
    if (!angebot) return { fehler: "Angebot nicht gefunden." };
    return {
      angebot,
      kunde: db.tabellen.kunden?.[0] ?? null,
      firma: db.tabellen.profiles[0],
      puffer: Buffer.from("PDF"),
      dateiname: `${angebot.nummer}.pdf`,
    };
  },
}));

const {
  angebotKopieren,
  angebotNachfassen,
  angebotSpeichern,
  statusSetzen,
} = await import("./actions");

/** Ein Zeitpunkt vor `tage` Tagen. */
function vor(tage: number): string {
  return new Date(Date.now() - tage * 86_400_000).toISOString();
}

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
      profiles: [
        {
          id: "u1", mwst_satz: 19, kleinunternehmer: false, angebot_gueltig_tage: 14,
          firma_name: "Müller Sanitär GmbH", email: "info@mueller.de", telefon: "0221 1234",
        },
      ],
      kunden: [
        { id: "k1", user_id: "u1", name: "Familie Becker", email: "becker@example.de", ansprechpartner: null },
      ],
    },
    { rpc: { next_angebot_nummer: "AN-2026-0002" } },
  );
  post.verfuegbar = false;
  post.gesendet = [];
  post.fehler = undefined;
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

describe("angebotNachfassen", () => {
  /** Ein verschicktes Angebot, seit `tage` Tagen ohne Antwort. */
  function liegt(tage: number, extra: Record<string, unknown> = {}) {
    Object.assign(db.tabellen.angebote[0], {
      nummer: "AN-2026-0001",
      status: "gesendet",
      gesendet_am: vor(tage),
      nachgefasst_am: null,
      nachfassungen: 0,
      gueltig_bis: "2026-12-31",
      ...extra,
    });
    post.verfuegbar = true;
  }

  it("fragt nach und vermerkt es am Angebot", async () => {
    liegt(10);

    const ergebnis = await angebotNachfassen("a1");

    expect(ergebnis.erfolg).toContain("becker@example.de");
    expect(post.gesendet).toHaveLength(1);
    const a = db.tabellen.angebote[0];
    expect(a.nachfassungen).toBe(1);
    expect(a.nachgefasst_am).toBeTruthy();
    // Der Status bleibt "gesendet": nachgefasst wurde ja gerade, das Angebot
    // wartet weiter auf eine Entscheidung.
    expect(a.status).toBe("gesendet");
  });

  it("zählt die Stufe hoch", async () => {
    liegt(30, { nachgefasst_am: vor(10), nachfassungen: 1 });

    await angebotNachfassen("a1");

    expect(post.gesendet[0].betreff).toBe("Nachfrage (Stufe 2)");
    expect(db.tabellen.angebote[0].nachfassungen).toBe(2);
  });

  it("fragt nicht nach, solange das Angebot frisch ist", async () => {
    liegt(3);

    const ergebnis = await angebotNachfassen("a1");

    expect(ergebnis.fehler).toContain("frisch");
    expect(post.gesendet).toHaveLength(0);
  });

  it("fragt nicht zweimal in derselben Woche nach", async () => {
    liegt(30, { nachgefasst_am: vor(2), nachfassungen: 1 });

    const ergebnis = await angebotNachfassen("a1");

    // Genau die Aufdringlichkeit, die einen Kunden im Ort kostet.
    expect(ergebnis.fehler).toContain("gerade erst");
    expect(post.gesendet).toHaveLength(0);
  });

  it("fragt nicht zu einem entschiedenen Angebot nach", async () => {
    liegt(30, { status: "angenommen" });

    const ergebnis = await angebotNachfassen("a1");
    expect(ergebnis.fehler).toContain("entschieden");
  });

  it("fragt nicht zu einem Entwurf nach", async () => {
    liegt(30, { status: "entwurf", gesendet_am: null });

    const ergebnis = await angebotNachfassen("a1");
    expect(ergebnis.fehler).toContain("beim Kunden");
  });

  it("vermerkt nichts, wenn der Versand scheitert", async () => {
    liegt(10);
    post.fehler = "Resend antwortet nicht.";

    const ergebnis = await angebotNachfassen("a1");

    expect(ergebnis.fehler).toBe("Resend antwortet nicht.");
    // Sonst verschwindet das Angebot aus der Nachfass-Liste, ohne dass je
    // eine Mail rausging.
    expect(db.tabellen.angebote[0].nachfassungen).toBe(0);
    expect(db.tabellen.angebote[0].nachgefasst_am).toBeNull();
  });

  it("fragt nicht zu fremden Angeboten nach", async () => {
    liegt(10, { user_id: "jemand-anderes" });

    const ergebnis = await angebotNachfassen("a1");
    expect(ergebnis.fehler).toContain("nicht gefunden");
    expect(post.gesendet).toHaveLength(0);
  });
});
