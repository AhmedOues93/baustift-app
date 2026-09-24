import { redirect } from "next/navigation";

import { BottomNav, Sidebar } from "@/components/navigation";
import { PilotFeedback } from "@/components/pilot-feedback";
import { istPilot } from "@/lib/abo";
import { createClient } from "@/lib/supabase/server";

/**
 * Layout aller eingeloggten Seiten.
 *
 * Mobile-first-Aufbau:
 *   - Standard (390px): Inhalt über die volle Breite, 16px Rand,
 *     unten Platz für die Tab-Leiste (`pb-24`).
 *   - ab `lg`: Sidebar links (256px), Inhalt rückt nach (`lg:pl-64`),
 *     Tab-Leiste verschwindet, Inhalt wird auf lesbare Breite begrenzt.
 *
 * Die Session prüft zusätzlich die Middleware. Der Check hier ist die zweite
 * Absicherung — und liefert uns den Nutzer für die Seiten darunter.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Firmenname für den Fuss der Sidebar.
  const { data: profil } = await supabase
    .from("profiles")
    .select("firma_name, subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-papier">
      <Sidebar firma={profil?.firma_name || undefined} />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-5 lg:max-w-5xl lg:px-10 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>
      <BottomNav />
      {/* Nur im Testbetrieb: Rückmeldungen dort einsammeln, wo sie entstehen. */}
      {istPilot(profil?.subscription_status ?? "") ? <PilotFeedback /> : null}
    </div>
  );
}
