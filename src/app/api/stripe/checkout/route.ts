import { NextResponse } from "next/server";

import { publicEnv, serverEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

/**
 * Startet den Bezahlvorgang und schickt den Nutzer zu Stripe.
 *
 * Der Kunde wird beim ersten Mal bei Stripe angelegt und die ID im Profil
 * gemerkt — sonst entstehen bei jedem Versuch neue Kundendatensätze und die
 * Zuordnung im Webhook wird zum Raten.
 */
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ fehler: "Nicht angemeldet." }, { status: 401 });

  const { data: profil } = await supabase
    .from("profiles")
    .select("stripe_customer_id, firma_name")
    .eq("id", user.id)
    .maybeSingle();

  const s = stripe();

  let kundenId = profil?.stripe_customer_id ?? null;
  if (!kundenId) {
    const kunde = await s.customers.create({
      email: user.email ?? undefined,
      name: profil?.firma_name || undefined,
      // Die User-ID mitschicken: der Webhook kommt später von Stripe und muss
      // ohne Session wissen, welches Profil gemeint ist.
      metadata: { supabase_user_id: user.id },
    });
    kundenId = kunde.id;
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: kundenId })
      .eq("id", user.id);
  }

  const sitzung = await s.checkout.sessions.create({
    mode: "subscription",
    customer: kundenId,
    line_items: [{ price: serverEnv().stripePriceId, quantity: 1 }],
    // Stripe Tax rechnet die Umsatzsteuer nach Sitz des Kunden aus — bei
    // einem Verkauf innerhalb der EU ist das Pflicht und von Hand fehleranfällig.
    automatic_tax: { enabled: true },
    customer_update: { address: "auto", name: "auto" },
    // Damit der Handwerker seine USt-IdNr. hinterlegen kann (Reverse Charge).
    tax_id_collection: { enabled: true },
    allow_promotion_codes: true,
    success_url: `${publicEnv.siteUrl}/abo?erfolg=1`,
    cancel_url: `${publicEnv.siteUrl}/abo`,
    subscription_data: { metadata: { supabase_user_id: user.id } },
  });

  return NextResponse.json({ url: sitzung.url });
}
