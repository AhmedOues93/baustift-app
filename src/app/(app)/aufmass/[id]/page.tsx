import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AufmassAnsicht } from "./aufmass-ansicht";
import { AngebotAusAufmass } from "./angebot-formular";
import { IconZurueck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type {
  Aufmass,
  AufmassPosition,
  Kunde,
  PreislisteEintrag,
} from "@/types/database";

export const metadata = { title: "Aufmass · Baustift" };

export default async function AufmassPage({
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

  const [{ data: aufmass }, { data: messungen }, { data: kunden }, { data: preise }] =
    await Promise.all([
      supabase.from("aufmass").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("aufmass_positionen")
        .select("*")
        .eq("aufmass_id", id)
        .order("pos_nr"),
      supabase.from("kunden").select("*").order("name"),
      supabase.from("preisliste").select("*").eq("aktiv", true).order("bezeichnung"),
    ]);

  // RLS liefert fremde Aufmasse gar nicht erst.
  if (!aufmass) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/aufmass"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Aufmasse
      </Link>

      <AufmassAnsicht
        aufmass={aufmass as Aufmass}
        messungen={(messungen ?? []) as AufmassPosition[]}
        kunden={(kunden ?? []) as Kunde[]}
      />

      {/* Der Schritt, für den gemessen wurde. Erst nach dem Abschliessen —
          vorher ändern sich die Zahlen noch. */}
      {aufmass.status === "abgeschlossen" ? (
        <AngebotAusAufmass
          aufmassId={aufmass.id}
          angebotId={aufmass.angebot_id}
          messungen={(messungen ?? []) as AufmassPosition[]}
          preisliste={(preise ?? []) as PreislisteEintrag[]}
        />
      ) : null}
    </div>
  );
}
