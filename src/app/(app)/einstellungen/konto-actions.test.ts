import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Konto löschen.
 *
 * Die einzige unumkehrbare Aktion im ganzen Produkt. Geprüft wird vor allem,
 * wann sie NICHT ausgeführt wird — ein versehentliches Löschen ist nicht zu
 * reparieren.
 */

let db: FakeDb;
let geloescht: string[] = [];

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((ziel: string) => {
    throw new Error(`REDIRECT:${ziel}`);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: () => ({
    ...db.client,
    auth: {
      ...db.client.auth,
      admin: {
        deleteUser: async (id: string) => {
          geloescht.push(id);
          return { error: null };
        },
      },
    },
  }),
}));

const { kontoLoeschen } = await import("./konto-actions");

function formular(bestaetigung: string) {
  const fd = new FormData();
  fd.set("bestaetigung", bestaetigung);
  return fd;
}

beforeEach(() => {
  geloescht = [];
  db = fakeSupabase({
    profiles: [
      { id: "u1", firma_name: "Schulz Sanitär GmbH", stripe_subscription_id: null },
    ],
  });
});

describe("kontoLoeschen", () => {
  it("löscht erst, wenn der Firmenname genau eingetippt wurde", async () => {
    await expect(kontoLoeschen({}, formular("Schulz Sanitär GmbH"))).rejects.toThrow(
      /REDIRECT/,
    );
    expect(geloescht).toEqual(["u1"]);
  });

  it("verzeiht Gross- und Kleinschreibung", async () => {
    await expect(kontoLoeschen({}, formular("schulz sanitär gmbh"))).rejects.toThrow(
      /REDIRECT/,
    );
    expect(geloescht).toEqual(["u1"]);
  });

  it("löscht nicht bei falscher Eingabe", async () => {
    const ergebnis = await kontoLoeschen({}, formular("Schulz"));

    expect(ergebnis.fehler).toContain("Schulz Sanitär GmbH");
    expect(geloescht).toEqual([]);
  });

  it("löscht nicht bei leerer Bestätigung", async () => {
    const ergebnis = await kontoLoeschen({}, formular("   "));
    expect(ergebnis.fehler).toBeTruthy();
    expect(geloescht).toEqual([]);
  });

  it("löscht nicht, solange ein Abo läuft", async () => {
    // Sonst wird weiter abgerechnet, während die Daten schon weg sind.
    db.tabellen.profiles[0].stripe_subscription_id = "sub_123";

    const ergebnis = await kontoLoeschen({}, formular("Schulz Sanitär GmbH"));

    expect(ergebnis.fehler).toContain("Abo");
    expect(geloescht).toEqual([]);
  });

  it("nimmt die ID aus der Session, nicht aus dem Formular", async () => {
    const fd = formular("Schulz Sanitär GmbH");
    fd.set("user_id", "jemand-anderes");

    await expect(kontoLoeschen({}, fd)).rejects.toThrow(/REDIRECT/);

    // Ein manipulierter Request darf kein fremdes Konto treffen.
    expect(geloescht).toEqual(["u1"]);
  });
});
