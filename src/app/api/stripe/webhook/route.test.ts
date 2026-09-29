import { createHmac } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Stripe-Webhook
 * =============================================================================
 * Die einzige Stelle, an der sich der Abo-Status ändert — und damit die
 * Stelle, an der ein Fehler entweder Geld kostet (jemand arbeitet, ohne zu
 * zahlen) oder einen Kunden aussperrt, der bezahlt hat.
 *
 * Getestet wird mit ECHTEN Signaturen: der Rumpf wird hier genauso signiert,
 * wie Stripe es tut, und von der echten Bibliothek geprüft. Damit deckt der
 * Test ab, was sonst nur im Testmodus mit `stripe listen` auffällt — dass
 * etwa der Rohtext gelesen werden muss und nicht das geparste JSON.
 *
 * Kein Netz, kein Stripe-Konto, keine echte Zahlung.
 */

const SECRET = "whsec_testgeheimnis_nur_fuer_diese_datei";

let db: FakeDb;
/** Abonnements, die der Client auf Nachfrage liefert. */
let abos: Record<string, { id: string; status: string }>;

vi.mock("@/lib/env", () => ({
  serverEnv: () => ({
    stripeSecretKey: "sk_test_egal",
    stripeWebhookSecret: SECRET,
    stripePriceId: "price_egal",
  }),
  publicEnv: { siteUrl: "http://localhost:3000" },
}));

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => db.client,
  createClient: async () => db.client,
}));

vi.mock("@/lib/stripe/client", async () => {
  const echt = await vi.importActual<typeof import("@/lib/stripe/client")>(
    "@/lib/stripe/client",
  );
  const Stripe = (await import("stripe")).default;
  return {
    // Der echte Statusübersetzer — den wollen wir mitprüfen.
    aboStatusAus: echt.aboStatusAus,
    stripe: () => {
      const client = new Stripe("sk_test_egal", { apiVersion: "2025-08-27.basil" });
      // Nur das Abrufen eines Abos wird ersetzt; die Signaturprüfung bleibt
      // die echte Bibliothek.
      client.subscriptions.retrieve = (async (id: string) =>
        abos[id] ?? { id, status: "active" }) as never;
      return client;
    },
  };
});

const { POST } = await import("./route");

/** Signiert wie Stripe: `t=<zeit>,v1=<hmac von "zeit.rumpf">`. */
function signiere(rumpf: string, zeit = Math.floor(Date.now() / 1000)): string {
  const hmac = createHmac("sha256", SECRET).update(`${zeit}.${rumpf}`).digest("hex");
  return `t=${zeit},v1=${hmac}`;
}

function ereignis(typ: string, objekt: unknown, erzeugt = Math.floor(Date.now() / 1000)) {
  return JSON.stringify({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: "event",
    type: typ,
    created: erzeugt,
    data: { object: objekt },
  });
}

function anfrage(rumpf: string, signatur?: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: signatur ? { "stripe-signature": signatur } : {},
    body: rumpf,
  });
}

beforeEach(() => {
  db = fakeSupabase({
    profiles: [
      {
        id: "u1", stripe_customer_id: "cus_1", stripe_subscription_id: null,
        subscription_status: "trial", stripe_ereignis_am: null,
      },
    ],
  });
  abos = { sub_1: { id: "sub_1", status: "active" } };
});

describe("Signatur", () => {
  it("weist eine Anfrage ohne Signatur ab", async () => {
    const antwort = await POST(anfrage(ereignis("customer.subscription.updated", {})));
    expect(antwort.status).toBe(400);
    expect(db.tabellen.profiles[0].subscription_status).toBe("trial");
  });

  it("weist eine falsche Signatur ab", async () => {
    const rumpf = ereignis("customer.subscription.updated", {});
    const antwort = await POST(anfrage(rumpf, "t=1,v1=deadbeef"));
    expect(antwort.status).toBe(400);
  });

  it("weist eine Signatur über einen anderen Rumpf ab", async () => {
    // Genau das passiert, wenn jemand das geparste JSON statt des Rohtexts
    // signiert oder weiterreicht — der häufigste Fehler an dieser Stelle.
    const echterRumpf = ereignis("customer.subscription.updated", { id: "sub_1" });
    const fremdeSignatur = signiere(ereignis("customer.subscription.updated", { id: "sub_9" }));

    const antwort = await POST(anfrage(echterRumpf, fremdeSignatur));
    expect(antwort.status).toBe(400);
  });

  it("weist eine veraltete Signatur ab", async () => {
    // Schutz gegen das erneute Einspielen einer alten, echt signierten
    // Nachricht.
    const rumpf = ereignis("customer.subscription.updated", { id: "sub_1" });
    const alt = Math.floor(Date.now() / 1000) - 60 * 60;

    const antwort = await POST(anfrage(rumpf, signiere(rumpf, alt)));
    expect(antwort.status).toBe(400);
  });
});

describe("Abo-Status", () => {
  async function schicke(typ: string, objekt: unknown, erzeugt?: number) {
    const rumpf = ereignis(typ, objekt, erzeugt);
    return POST(anfrage(rumpf, signiere(rumpf)));
  }

  it("schaltet nach dem Checkout frei", async () => {
    const antwort = await schicke("checkout.session.completed", {
      customer: "cus_1", subscription: "sub_1", metadata: { supabase_user_id: "u1" },
    });

    expect(antwort.status).toBe(200);
    const p = db.tabellen.profiles[0];
    expect(p.subscription_status).toBe("aktiv");
    expect(p.stripe_subscription_id).toBe("sub_1");
  });

  it("findet das Konto auch ohne Metadaten über die Kunden-ID", async () => {
    await schicke("checkout.session.completed", {
      customer: "cus_1", subscription: "sub_1", metadata: null,
    });
    expect(db.tabellen.profiles[0].subscription_status).toBe("aktiv");
  });

  it("lässt eine geplatzte Lastschrift den Zugang nicht sperren", async () => {
    // past_due ist ein Bankproblem. Einem Betrieb mitten am Tag das Werkzeug
    // wegzunehmen, wäre die falsche Antwort darauf.
    await schicke("customer.subscription.updated", {
      id: "sub_1", customer: "cus_1", status: "past_due", metadata: null,
    });
    expect(db.tabellen.profiles[0].subscription_status).toBe("aktiv");
  });

  it("beendet den Zugang bei Kündigung", async () => {
    await schicke("customer.subscription.deleted", {
      id: "sub_1", customer: "cus_1", status: "canceled", metadata: null,
    });
    expect(db.tabellen.profiles[0].subscription_status).toBe("gekuendigt");
  });

  it("quittiert unbekannte Ereignisse, statt sie zu verwerfen", async () => {
    // Antwortet man mit einem Fehler, versucht Stripe es tagelang erneut.
    const antwort = await schicke("invoice.payment_succeeded", { id: "in_1" });
    expect(antwort.status).toBe(200);
  });

  it("wirft ein älteres Ereignis weg", async () => {
    const jetzt = Math.floor(Date.now() / 1000);

    await schicke(
      "customer.subscription.updated",
      { id: "sub_1", customer: "cus_1", status: "active", metadata: null },
      jetzt,
    );
    expect(db.tabellen.profiles[0].subscription_status).toBe("aktiv");

    // Zwei Minuten älter, erst jetzt zugestellt: darf nicht herabstufen.
    await schicke(
      "customer.subscription.updated",
      { id: "sub_1", customer: "cus_1", status: "unpaid", metadata: null },
      jetzt - 120,
    );
    expect(db.tabellen.profiles[0].subscription_status).toBe("aktiv");
  });

  it("rührt ein unbekanntes Konto nicht an", async () => {
    await schicke("customer.subscription.updated", {
      id: "sub_9", customer: "cus_unbekannt", status: "canceled", metadata: null,
    });
    expect(db.tabellen.profiles[0].subscription_status).toBe("trial");
  });
});
