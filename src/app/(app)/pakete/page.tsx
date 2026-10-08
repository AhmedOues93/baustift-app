import Link from "next/link";

import { PaketListe } from "./paket-liste";
import { createClient } from "@/lib/supabase/server";
import type { Leistungspaket } from "@/types/database";

export const metadata = { title: "Leistungspakete · Baustift" };

/**
 * Übersicht der Pakete.
 *
 * Die Anzahl der Zeilen steht gleich mit dabei: ein Paket mit null Zeilen
 * sieht sonst genauso aus wie eines mit zwölf, und man merkt erst im Angebot,
 * dass nichts kommt.
 */
export default async function PaketePage() {
  const supabase = await createClient();

  // RLS liefert nur die eigenen.
  const [{ data: pakete }, { data: zeilen }] = await Promise.all([
    supabase.from("leistungspakete").select("*").order("name"),
    supabase.from("paket_positionen").select("paket_id"),
  ]);

  const anzahl = new Map<string, number>();
  for (const z of zeilen ?? []) {
    anzahl.set(z.paket_id, (anzahl.get(z.paket_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titel text-2xl font-bold tracking-tight text-text">
          Leistungspakete
        </h1>
        <p className="mt-1 text-sm text-text-leise">
          Zusammenstellungen, die du immer wieder brauchst — ein Bad, ein
          Gäste-WC, eine Wartung. Ins Angebot kommen sie mit einem Antippen.
          Die Preise holt das Paket aus deiner{" "}
          <Link href="/preisliste" className="underline underline-offset-2">
            Preisliste
          </Link>
          , nicht aus sich selbst: eine Preiserhöhung wirkt damit sofort.
        </p>
      </div>

      <PaketListe
        pakete={(pakete ?? []) as Leistungspaket[]}
        zeilenJePaket={Object.fromEntries(anzahl)}
      />
    </div>
  );
}
