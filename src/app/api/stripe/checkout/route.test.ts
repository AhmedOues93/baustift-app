import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Bezahlvorgang starten
 * =============================================================================
 * Die Route, an der Geld fliesst. Es wird kein Stripe angefasst: die
 * Bibliothek ist eine Attrappe, und nichts davon löst eine Zahlung aus.
 */

let db: FakeDb;
let stripeAufrufe: string[];
/** Soll Stripe diesmal scheitern? */
let stripeFehler: Error | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
}));

vi.mock("@/lib/env", () => ({
  publicEnv: { siteUrl: "https://baustift.onrender.com" },
  serverEnv: () => ({ stripePriceId: "price_abo" }),
}));

vi.mock("@/lib/stripe/client", () => ({
  stripe: () => ({
    customers: {
      create: async () => {
        if (stripeFehler) throw stripeFehler;
        stripeAufrufe.push("customers.create");
        return { id: "cus_neu" };
      },
    },
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          if (stripeFehler) throw stripeFehler;
          stripeAufrufe.push(`checkout:${String(args.customer)}`);
          return { url: "https://checkout.stripe.com/c/pay/abc" };
        },
      },
    },
  }),
}));

function start(profil: Record<string, unknown> = {}, optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      profiles: [
        {
          id: "u1", firma_name: "Schulz Sanitär", stripe_customer_id: null,
          stripe_subscription_id: null, subscription_status: "trial", ...profil,
        },
      ],
    },
    optionen,
  );
}

async function post() {
  const { POST } = await import("./route");
  return POST();
}

beforeEach(() => {
  vi.resetModules();
  stripeAufrufe = [];
  stripeFehler = null;
  start();
});

describe("Zugang", () => {
  it("weist ab, wer nicht angemeldet ist — bevor Stripe angefasst wird", async () => {
    start({}, { user: null });

    const antwort = await post();

    expect(antwort.status).toBe(401);
    expect(stripeAufrufe).toEqual([]);
  });
});

describe("Kunde bei Stripe", () => {
  it("legt ihn beim ersten Mal an und merkt sich die Kennung", async () => {
    // Ohne das entstehen bei jedem Versuch neue Kundendatensätze, und die
    // Zuordnung im Webhook wird zum Raten.
    const antwort = await post();

    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/abc" });
    expect(stripeAufrufe).toEqual(["customers.create", "checkout:cus_neu"]);
    expect(db.tabellen.profiles[0].stripe_customer_id).toBe("cus_neu");
  });

  it("legt ihn kein zweites Mal an", async () => {
    start({ stripe_customer_id: "cus_alt" });

    await post();

    expect(stripeAufrufe).toEqual(["checkout:cus_alt"]);
  });
});

describe("Doppelabo", () => {
  it("lehnt einen zweiten Abschluss ab, wenn schon eines läuft", async () => {
    // Der Knopf ist auf der Abo-Seite ausgeblendet. Ein zweiter Browsertab,
    // ein doppelter Klick oder ein direkter Aufruf kommen daran vorbei —
    // und dann zahlt jemand zweimal.
    start({ subscription_status: "aktiv", stripe_subscription_id: "sub_1", stripe_customer_id: "cus_alt" });

    const antwort = await post();
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(409);
    expect(rumpf.fehler).toContain("Kundenportal");
    expect(stripeAufrufe).toEqual([]);
  });

  it("lässt ein gekündigtes Konto wieder abschliessen", async () => {
    start({ subscription_status: "gekuendigt", stripe_subscription_id: "sub_1", stripe_customer_id: "cus_alt" });

    expect((await post()).status).toBe(200);
  });
});

describe("wenn Stripe nicht mitspielt", () => {
  it("antwortet mit 502 statt die Route durchwerfen zu lassen", async () => {
    // Falscher Schlüssel, abgelaufene Preis-ID, Stripe gestört: ohne
    // Behandlung sieht der Nutzer eine leere Seite.
    stripeFehler = new Error("Invalid API Key provided");

    const antwort = await post();
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(502);
    expect(rumpf.fehler).toContain("später");
    // Und die Meldung von Stripe erscheint nicht beim Nutzer.
    expect(JSON.stringify(rumpf)).not.toContain("API Key");
  });
});
