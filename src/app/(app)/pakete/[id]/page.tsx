import Link from "next/link";
import { notFound } from "next/navigation";

import { PaketDetail } from "./paket-detail";
import { IconZurueck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { Leistungspaket, PaketPosition, PreislisteEintrag } from "@/types/database";

export const metadata = { title: "Paket · Baustift" };

export default async function PaketSeite({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // RLS: ein fremdes Paket kommt hier gar nicht erst an.
  const { data: paket } = await supabase
    .from("leistungspakete")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!paket) notFound();

  const [{ data: zeilen }, { data: preise }] = await Promise.all([
    supabase.from("paket_positionen").select("*").eq("paket_id", id).order("pos_nr"),
    supabase
      .from("preisliste")
      .select("*")
      .eq("aktiv", true)
      .order("bezeichnung"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/pakete"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Pakete
      </Link>

      <PaketDetail
        paket={paket as Leistungspaket}
        zeilen={(zeilen ?? []) as PaketPosition[]}
        preisliste={(preise ?? []) as PreislisteEintrag[]}
      />
    </div>
  );
}
