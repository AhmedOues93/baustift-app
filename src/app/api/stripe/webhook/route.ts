import type Stripe from "stripe";

import { serverEnv } from "@/lib/env";
import { protokolliereFehler } from "@/lib/protokoll";
import { aboStatusAus, stripe } from "@/lib/stripe/client";
import { ereignisZeit, istVeraltet } from "@/lib/stripe/reihenfolge";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Stripe-Webhook: die einzige Stelle, an der sich der Abo-Status ändert.
 *
 * Warum nicht einfach nach dem Checkout im Erfolgs-Redirect freischalten?
 * Weil der Nutzer diesen Redirect nie sehen muss (Tab geschlossen, Netz weg)
 * — und weil er sich fälschen liesse. Die Wahrheit kommt von Stripe, signiert.
 *
 * Geschrieben wird mit dem Service-Role-Key: hier gibt es keine Session, und
 * die Zuordnung läuft über die Stripe-Kunden-ID.
 */
export const runtime = "nodejs";

const RELEVANT = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export async function POST(request: Request) {
  const signatur = request.headers.get("stripe-signature");
  if (!signatur) return new Response("Keine Signatur.", { status: 400 });

  // Rohtext, nicht das geparste JSON: die Signatur wird über die exakten Bytes
  // gebildet. Ein Durchlauf durch JSON.parse und zurück verändert sie.
  const roh = await request.text();

  let ereignis: Stripe.Event;
  try {
    ereignis = stripe().webhooks.constructEvent(
      roh,
      signatur,
      serverEnv().stripeWebhookSecret,
    );
  } catch {
    // Ungültige Signatur: kann ein Angriff sein oder ein falsches Secret.
    return new Response("Signatur ungültig.", { status: 400 });
  }

  if (!RELEVANT.has(ereignis.type)) {
    // Stripe schickt viele Ereignisse. Unbekannte mit 200 quittieren, sonst
    // versucht Stripe sie tagelang erneut.
    return new Response("ok", { status: 200 });
  }

  const admin = createAdminClient();

  try {
    /**
     * Stripe garantiert die Zustellung, nicht die Reihenfolge. Ein
     * Wiederholungsversuch eines alten Ereignisses kann nach einem neueren
     * ankommen — und würde dann jemanden herabstufen, dessen Zahlung längst
     * durch ist. Deshalb erst prüfen, wie alt das zuletzt Verarbeitete war.
     */
    const aktualisiere = async (
      userId: string,
      werte: { stripe_subscription_id: string; subscription_status: string },
    ) => {
      const { data: profil } = await admin
        .from("profiles")
        .select("stripe_ereignis_am")
        .eq("id", userId)
        .maybeSingle();

      if (istVeraltet(profil?.stripe_ereignis_am, ereignis.created)) return;

      await admin
        .from("profiles")
        .update({ ...werte, stripe_ereignis_am: ereignisZeit(ereignis.created) })
        .eq("id", userId);
    };

    if (ereignis.type === "checkout.session.completed") {
      const sitzung = ereignis.data.object;
      const userId = await findeUserId(admin, sitzung.customer, sitzung.metadata);
      if (userId && sitzung.subscription) {
        const abo = await stripe().subscriptions.retrieve(
          String(sitzung.subscription),
        );
        await aktualisiere(userId, {
          stripe_subscription_id: abo.id,
          subscription_status: aboStatusAus(abo.status),
        });
      }
    } else {
      const abo = ereignis.data.object as Stripe.Subscription;
      const userId = await findeUserId(admin, abo.customer, abo.metadata);
      if (userId) {
        await aktualisiere(userId, {
          stripe_subscription_id: abo.id,
          subscription_status:
            ereignis.type === "customer.subscription.deleted"
              ? "gekuendigt"
              : aboStatusAus(abo.status),
        });
      }
    }
  } catch (fehler) {
    protokolliereFehler(
      { vorgang: "stripe.webhook", details: { typ: ereignis.type } },
      fehler,
    );
    // 500 → Stripe versucht es erneut. Genau das wollen wir bei einem
    // vorübergehenden Datenbankfehler.
    return new Response("Fehler", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

/**
 * Welches Profil gehört zu diesem Stripe-Ereignis?
 *
 * Zwei Wege, in dieser Reihenfolge: die Metadaten (die wir beim Checkout
 * selbst gesetzt haben) und ersatzweise die Kunden-ID im Profil. Der zweite
 * Weg trägt auch dann, wenn ein Abo später im Stripe-Dashboard von Hand
 * angelegt wurde.
 */
async function findeUserId(
  admin: ReturnType<typeof createAdminClient>,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null,
  metadata: Stripe.Metadata | null,
): Promise<string | null> {
  const ausMetadaten = metadata?.supabase_user_id;
  if (ausMetadaten) return ausMetadaten;

  const kundenId = typeof customer === "string" ? customer : customer?.id;
  if (!kundenId) return null;

  const { data } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", kundenId)
    .maybeSingle();

  return data?.id ?? null;
}
