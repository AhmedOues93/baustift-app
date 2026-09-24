import { KundenAnsicht } from "./kunden-ansicht";
import { createClient } from "@/lib/supabase/server";
import type { Kunde } from "@/types/database";

export const metadata = { title: "Kunden · Baustift" };

export default async function KundenPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kunden")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    return (
      <p className="rounded-karte bg-warnung-flaeche p-4 text-warnung">
        Die Kunden konnten nicht geladen werden. Bitte Seite neu laden.
      </p>
    );
  }

  return <KundenAnsicht kunden={(data ?? []) as Kunde[]} />;
}
