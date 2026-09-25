import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { rechnungEntwurfLoeschen } from "../actions";
import { RechnungEditor } from "./rechnung-editor";
import { ZahlungenBereich } from "./zahlungen-bereich";
import { IconZurueck } from "@/components/ui/icons";
import { emailVerfuegbar } from "@/lib/email/senden";
import { createClient } from "@/lib/supabase/server";
import type {
  Kunde,
  Rechnung,
  RechnungPosition,
  RechnungZahlung,
} from "@/types/database";

export const metadata = { title: "Rechnung · Baustift" };

export default async function RechnungPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rechnung }, { data: positionen }, { data: kunden }, { data: zahlungen }] =
    await Promise.all([
      supabase.from("rechnungen").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("rechnung_positionen")
        .select("*")
        .eq("rechnung_id", id)
        .order("pos_nr"),
      supabase.from("kunden").select("*").order("name"),
      supabase
        .from("rechnung_zahlungen")
        .select("*")
        .eq("rechnung_id", id)
        .order("bezahlt_am"),
    ]);

  if (!rechnung) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/rechnungen"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Rechnungen
      </Link>

      <RechnungEditor
        rechnung={rechnung as Rechnung}
        positionen={(positionen ?? []) as RechnungPosition[]}
        kunden={(kunden ?? []) as Kunde[]}
        versandMoeglich={emailVerfuegbar()}
      />

      {/* Zahlungen erst nach dem Stellen: an einem Entwurf ist nichts offen. */}
      {rechnung.festgeschrieben_am ? (
        <ZahlungenBereich
          rechnungId={rechnung.id}
          brutto={rechnung.brutto}
          zahlungen={(zahlungen ?? []) as RechnungZahlung[]}
          gesperrt={rechnung.status === "storniert"}
        />
      ) : null}

      {/* Löschen gibt es nur für Entwürfe. Ein gestellter Beleg wird
          storniert, nicht entfernt — das ist der ganze Sinn der Trennung. */}
      {!rechnung.festgeschrieben_am ? (
        <form
          action={rechnungEntwurfLoeschen}
          className="border-t border-linie pt-4"
        >
          <input type="hidden" name="id" value={rechnung.id} />
          <button
            type="submit"
            className="min-h-11 w-full rounded-feld text-sm font-medium text-warnung transition-colors active:bg-warnung-flaeche"
          >
            Entwurf löschen
          </button>
        </form>
      ) : null}
    </div>
  );
}
