import { PreislisteAnsicht } from "./preisliste-ansicht";
import { createClient } from "@/lib/supabase/server";
import type { PreislisteEintrag } from "@/types/database";

export const metadata = { title: "Preisliste · Baustift" };

export default async function PreislistePage() {
  const supabase = createClient();

  // Kein `.eq("user_id", …)` nötig: RLS liefert ohnehin nur die eigenen Zeilen.
  // Wir sortieren nach Kategorie, damit die Liste ohne Filter schon geordnet ist.
  const { data, error } = await supabase
    .from("preisliste")
    .select("*")
    .order("kategorie", { ascending: true, nullsFirst: false })
    .order("bezeichnung", { ascending: true });

  if (error) {
    return (
      <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        Die Preisliste konnte nicht geladen werden. Bitte Seite neu laden.
      </p>
    );
  }

  return <PreislisteAnsicht eintraege={(data ?? []) as PreislisteEintrag[]} />;
}
