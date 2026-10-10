import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * Das Kundenportal — dort kündigt und ändert der Betrieb sein Abo. Kein
 * echtes Stripe, keine Zahlung.
 */

let db: FakeDb;
let stripeFehler: Error | null;
let angelegt: Record<string, unknown>[];

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => db.client }));
vi.mock("@/lib/env", () => ({
  publicEnv: { siteUrl: "https://baustift.onrender.com" },
  serverEnv: () => ({}),
}));
vi.mock("@/lib/stripe/client", () => ({
  stripe: () => ({
    billingPortal: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          if (stripeFehler) throw stripeFehler;
          angelegt.push(args);
          return { url: "https://billing.stripe.com/p/session/xyz" };
        },
      },
    },
  }),
}));

function start(profil: Record<string, unknown> = {}, optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase({ profiles: [{ id: "u1", stripe_customer_id: "cus_1", ...profil }] }, optionen);
}

async function post() {
  const { POST } = await import("./route");
  return POST();
}

beforeEach(() => {
  vi.resetModules();
  stripeFehler = null;
  angelegt = [];
  start();
});

it("weist ab, wer nicht angemeldet ist", async () => {
  start({}, { user: null });
  expect((await post()).status).toBe(401);
  expect(angelegt).toEqual([]);
});

it("sagt sachlich Bescheid, wenn es gar kein Abo gibt", async () => {
  start({ stripe_customer_id: null });

  const antwort = await post();

  expect(antwort.status).toBe(400);
  expect(angelegt).toEqual([]);
});

it("öffnet das Portal für den eigenen Kunden und führt zurück", async () => {
  const antwort = await post();

  expect(antwort.status).toBe(200);
  expect(angelegt[0]).toMatchObject({
    customer: "cus_1",
    return_url: "https://baustift.onrender.com/einstellungen",
  });
});

it("antwortet mit 502, wenn Stripe nicht erreichbar ist", async () => {
  // Wer kündigen will und eine leere Seite sieht, ruft an — oder macht
  // eine Rückbuchung.
  stripeFehler = new Error("connection error");

  const antwort = await post();

  expect(antwort.status).toBe(502);
  expect((await antwort.json()).fehler).toContain("später");
});
