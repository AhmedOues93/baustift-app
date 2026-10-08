import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Preisliste.
 *
 * Der Import ist der erste ernste Kontakt mit dem Produkt. Er darf weder an
 * einer kaputten Zeile scheitern noch stillschweigend die gepflegte Liste
 * überschreiben.
 */

let db: FakeDb;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: async () => db.client,
}));

const { preisAnlegen, preislisteImportieren } = await import("./actions");

beforeEach(() => {
  db = fakeSupabase({ preisliste: [] });
});

describe("preisAnlegen", () => {
  it("speichert mit der user_id aus der Session, nicht aus dem Formular", async () => {
    const fd = new FormData();
    fd.set("bezeichnung", "Fliesen verlegen");
    fd.set("einzelpreis", "52,00");
    fd.set("einheit", "m2");
    // Ein manipulierter Request versucht, in fremde Listen zu schreiben.
    fd.set("user_id", "jemand-anderes");

    await preisAnlegen({}, fd);

    expect(db.tabellen.preisliste[0].user_id).toBe("u1");
  });

  it("liest den Tausenderpunkt richtig", async () => {
    const fd = new FormData();
    fd.set("bezeichnung", "Bodengleiche Dusche");
    fd.set("einzelpreis", "1.450");
    fd.set("einheit", "pauschal");

    await preisAnlegen({}, fd);

    // Der teuerste Fehler der App: 1,45 € statt 1.450 €.
    expect(db.tabellen.preisliste[0].einzelpreis).toBe(1450);
  });

  it("weist einen unlesbaren Preis ab", async () => {
    const fd = new FormData();
    fd.set("bezeichnung", "Irgendwas");
    fd.set("einzelpreis", "keine Ahnung");

    const ergebnis = await preisAnlegen({}, fd);

    expect(ergebnis.fehler).toContain("Preis");
    expect(db.tabellen.preisliste).toHaveLength(0);
  });

  it("zerlegt die Stichworte", async () => {
    const fd = new FormData();
    fd.set("bezeichnung", "Fliesen");
    fd.set("einzelpreis", "52");
    fd.set("stichworte", "bad fliesen, verfliesen ,  ");

    await preisAnlegen({}, fd);

    expect(db.tabellen.preisliste[0].stichworte).toEqual(["bad fliesen", "verfliesen"]);
  });
});

describe("preislisteImportieren", () => {
  function csvFormular(inhalt: string) {
    const fd = new FormData();
    fd.set("datei", new File([inhalt], "preise.csv", { type: "text/csv" }));
    return fd;
  }

  it("legt die Zeilen an und ergänzt, statt zu ersetzen", async () => {
    db.tabellen.preisliste.push({
      id: "vorhanden", user_id: "u1", bezeichnung: "Alter Preis", einzelpreis: 1,
    });

    const ergebnis = await preislisteImportieren(
      {},
      csvFormular("Bezeichnung;Einheit;Preis\nFliesen verlegen;qm;52,00\nMonteurstunde;Std.;62,00\n"),
    );

    expect(ergebnis.erfolg).toContain("2");
    // Ein Import, der die gepflegte Liste ersetzt, ist beim ersten
    // Fehlversuch ein Datenverlust.
    expect(db.tabellen.preisliste).toHaveLength(3);
    expect(db.tabellen.preisliste.every((p) => p.user_id === "u1")).toBe(true);
  });

  it("meldet übersprungene Zeilen, statt den Import abzubrechen", async () => {
    const ergebnis = await preislisteImportieren(
      {},
      csvFormular("Bezeichnung;Preis\nGut;52,00\nKaputt;keine Ahnung\n"),
    );

    expect(ergebnis.erfolg).toContain("1 Preis");
    expect(ergebnis.erfolg).toContain("übersprungen");
    expect(db.tabellen.preisliste).toHaveLength(1);
  });

  it("sagt Bescheid, wenn die Kopfzeile nicht passt", async () => {
    const ergebnis = await preislisteImportieren({}, csvFormular("Spalte A;Spalte B\nx;y\n"));

    expect(ergebnis.fehler).toBeTruthy();
    expect(db.tabellen.preisliste).toHaveLength(0);
  });

  it("legt dieselbe Datei kein zweites Mal an", async () => {
    // Wer nach einem abgebrochenen Versuch nochmal auf „Importieren“
    // drückt, hatte sonst alles doppelt in der Liste.
    const csv = "Bezeichnung;Einheit;Preis\nFliesen verlegen;qm;52,00\nMonteurstunde;Std.;62,00\n";

    await preislisteImportieren({}, csvFormular(csv));
    expect(db.tabellen.preisliste).toHaveLength(2);

    const zweiter = await preislisteImportieren({}, csvFormular(csv));

    expect(db.tabellen.preisliste).toHaveLength(2);
    expect(zweiter.fehler).toContain("stehen schon");
  });

  it("ergänzt nur das Neue, wenn die Datei gewachsen ist", async () => {
    await preislisteImportieren(
      {},
      csvFormular("Bezeichnung;Einheit;Preis\nFliesen verlegen;qm;52,00\n"),
    );

    const ergebnis = await preislisteImportieren(
      {},
      csvFormular("Bezeichnung;Einheit;Preis\nFliesen verlegen;qm;52,00\nWC tauschen;stk;380,00\n"),
    );

    expect(db.tabellen.preisliste).toHaveLength(2);
    expect(ergebnis.erfolg).toContain("1 Preis importiert");
    expect(ergebnis.erfolg).toContain("schon vorhanden");
  });

  it("liest eine Datei aus Excel unter Windows richtig ein", async () => {
    const fd = new FormData();
    const bytes = Buffer.from("Bezeichnung;Preis\nStück Rohr;9,90\n", "latin1");
    fd.set("datei", new File([bytes], "preise.csv", { type: "text/csv" }));

    await preislisteImportieren({}, fd);

    // Vorher stand hier "St?ck Rohr" — und zwar bis ins Angebot beim Kunden.
    expect(db.tabellen.preisliste[0].bezeichnung).toBe("Stück Rohr");
  });

  it("weist auf eine geratene Einheit hin, statt sie zu verschweigen", async () => {
    const ergebnis = await preislisteImportieren(
      {},
      csvFormular("Bezeichnung;Preis;Einheit\nFliesen;52;Quadratmter\n"),
    );

    expect(ergebnis.erfolg).toContain("Quadratmter");
    expect(db.tabellen.preisliste[0].einheit).toBe("stk");
  });

  it("behält einen mehrzeiligen Langtext", async () => {
    await preislisteImportieren(
      {},
      csvFormular('Bezeichnung;Preis;Beschreibung\n"Fliesen";48,00;"Zeile eins\nZeile zwei"\n'),
    );

    expect(db.tabellen.preisliste).toHaveLength(1);
    expect(db.tabellen.preisliste[0].beschreibung).toBe("Zeile eins\nZeile zwei");
  });

  it("lehnt eine zu grosse Datei ab", async () => {
    const fd = new FormData();
    fd.set("datei", new File([new Uint8Array(3 * 1024 * 1024)], "gross.csv", { type: "text/csv" }));

    const ergebnis = await preislisteImportieren({}, fd);
    expect(ergebnis.fehler).toContain("gross");
  });
});
