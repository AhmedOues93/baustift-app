import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AngebotEditor } from "./angebot-editor";
import { IconZurueck } from "@/components/ui/icons";
import { createClient } from "@/lib/supabase/server";
import type { Angebot, Kunde, Position } from "@/types/database";

export const metadata = { title: "Angebot · Baustift" };

export default async function AngebotPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: angebot }, { data: positionen }, { data: kunden }] =
    await Promise.all([
      supabase.from("angebote").select("*").eq("id", params.id).maybeSingle(),
      supabase
        .from("positionen")
        .select("*")
        .eq("angebot_id", params.id)
        .order("pos_nr"),
      supabase.from("kunden").select("*").order("name"),
    ]);

  // RLS liefert für fremde Angebote schlicht nichts — 404 ist hier die
  // richtige Antwort und verrät nicht, ob die ID existiert.
  if (!angebot) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/angebote"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Angebote
      </Link>

      <AngebotEditor
        angebot={angebot as Angebot}
        positionen={(positionen ?? []) as Position[]}
        kunden={(kunden ?? []) as Kunde[]}
      />
    </div>
  );
}
