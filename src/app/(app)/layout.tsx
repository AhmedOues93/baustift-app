import { redirect } from "next/navigation";

import { BottomNav, Sidebar } from "@/components/navigation";
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
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 lg:max-w-4xl lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
