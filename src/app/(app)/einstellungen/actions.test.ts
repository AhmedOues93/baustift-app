import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Firmendaten.
 *
 * Eine Regel hier ist teurer als alle anderen: beim Kleinunternehmer nach
 * §19 UStG darf keine Umsatzsteuer im PDF stehen. Deshalb wird der Satz beim
 * Speichern hart auf 0 geschrieben und nicht bloss beim Anzeigen versteckt —
 * sonst rutscht der alte Wert über irgendeinen anderen Pfad doch ins
 * Dokument.
 */

let db: FakeDb;

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: async () => db.client,
}));

const { firmendatenSpeichern } = await import("./actions");

beforeEach(() => {
  db = fakeSupabase({
    profiles: [{ id: "u1", firma_name: "Alt", mwst_satz: 19, kleinunternehmer: false }],
  });
});

function formular(werte: Record<string, string>) {
  const fd = new FormData();
  fd.set("firma_name", "Schulz Sanitär GmbH");
  fd.set("mwst_satz", "19");
  for (const [k, v] of Object.entries(werte)) fd.set(k, v);
  return fd;
}

describe("firmendatenSpeichern", () => {
  it("setzt beim Kleinunternehmer den Steuersatz auf 0", async () => {
    await firmendatenSpeichern({}, formular({ kleinunternehmer: "on", mwst_satz: "19" }));

    const p = db.tabellen.profiles[0];
    expect(p.kleinunternehmer).toBe(true);
    // Auch wenn im Feld noch 19 stand.
    expect(p.mwst_satz).toBe(0);
  });

  it("übernimmt den Satz, wenn kein Kleinunternehmer", async () => {
    await firmendatenSpeichern({}, formular({ mwst_satz: "7" }));
    expect(db.tabellen.profiles[0].mwst_satz).toBe(7);
  });

  it("versteht die deutsche Schreibweise des Satzes", async () => {
    await firmendatenSpeichern({}, formular({ mwst_satz: "19,0" }));
    expect(db.tabellen.profiles[0].mwst_satz).toBe(19);
  });

  it("weist einen unmöglichen Steuersatz ab", async () => {
    const ergebnis = await firmendatenSpeichern({}, formular({ mwst_satz: "190" }));

    expect(ergebnis.fehler).toContain("MwSt");
    expect(db.tabellen.profiles[0].mwst_satz).toBe(19);
  });

  it("macht aus leeren Feldern null statt leerer Texte", async () => {
    await firmendatenSpeichern({}, formular({ strasse: "   ", iban: "" }));

    const p = db.tabellen.profiles[0];
    // Sonst druckt das PDF eine leere Zeile statt sie wegzulassen.
    expect(p.strasse).toBeNull();
    expect(p.iban).toBeNull();
  });

  it("fängt eine unsinnige Gültigkeitsdauer ab", async () => {
    await firmendatenSpeichern({}, formular({ angebot_gueltig_tage: "0" }));
    expect(db.tabellen.profiles[0].angebot_gueltig_tage).toBe(30);
  });

  it("lehnt ein Logo im falschen Format ab", async () => {
    const fd = formular({});
    fd.set("logo", new File(["x"], "logo.svg", { type: "image/svg+xml" }));

    const ergebnis = await firmendatenSpeichern({}, fd);

    expect(ergebnis.fehler).toContain("PNG");
    // Und speichert dann gar nichts, statt halb.
    expect(db.tabellen.profiles[0].firma_name).toBe("Alt");
  });

  it("lehnt ein zu grosses Logo ab", async () => {
    const fd = formular({});
    const gross = new Uint8Array(3 * 1024 * 1024);
    fd.set("logo", new File([gross], "logo.png", { type: "image/png" }));

    const ergebnis = await firmendatenSpeichern({}, fd);
    expect(ergebnis.fehler).toContain("2 MB");
  });
});
