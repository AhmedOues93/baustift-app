import { NextResponse } from "next/server";

import { publicEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/client";
import { protokolliereFehler } from "@/lib/protokoll";
import { createClient } from "@/lib/supabase/server";

/**
 * Stripe-Kundenportal: Zahlungsdaten ändern, Rechnungen herunterladen,
 * kündigen. Das alles selbst zu bauen wäre Arbeit an einem gelösten Problem —
 * und rechtlich muss die Kündigung ohnehin einfach erreichbar sein.
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
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil?.stripe_customer_id) {
    return NextResponse.json({ fehler: "Kein Abo vorhanden." }, { status: 400 });
  }

  try {
    const sitzung = await stripe().billingPortal.sessions.create({
      customer: profil.stripe_customer_id,
      return_url: `${publicEnv.siteUrl}/einstellungen`,
    });

    return NextResponse.json({ url: sitzung.url });
  } catch (fehler) {
    // Ohne diesen Zweig wirft die Route durch, und wer sein Abo kündigen
    // will, sieht eine leere Seite — der denkbar schlechteste Moment dafür.
    protokolliereFehler({ vorgang: "stripe.portal", userId: user.id }, fehler);
    return NextResponse.json(
      { fehler: "Das Kundenportal ist gerade nicht erreichbar. Bitte später nochmal." },
      { status: 502 },
    );
  }
}
