import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Auftrag, Kunde } from "@/types/database";

export const metadata = { title: "Aufträge · Baustift" };

const label = { geplant: "Geplant", in_arbeit: "In Arbeit", fertig: "Fertig", abgerechnet: "Abgerechnet" } as const;

export default async function AuftraegePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: auftraege }, { data: kunden }] = await Promise.all([
    supabase.from("auftraege").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("kunden").select("*").eq("user_id", user.id),
  ]);
  const km = new Map(((kunden ?? []) as Kunde[]).map(k => [k.id, k]));
  return <div className="flex flex-col gap-4">
    <header><p className="text-sm font-medium text-akzent">Baustellen</p><h1 className="font-titel text-[30px] font-bold tracking-tight">Aufträge</h1><p className="mt-1 text-text-leise">Angenommene Angebote werden hier geplant und ausgeführt.</p></header>
    {(auftraege ?? []).length === 0 ? <div className="rounded-karte bg-flaeche p-6 text-center shadow-karte"><p className="font-medium">Noch keine Aufträge</p><p className="mt-1 text-sm text-text-leise">Öffne ein angenommenes Angebot und erstelle daraus einen Auftrag.</p></div> :
      <div className="flex flex-col gap-2">{((auftraege ?? []) as Auftrag[]).map(a => { const k=a.kunde_id?km.get(a.kunde_id):null; return <Link key={a.id} href={`/auftraege/${a.id}`} className="rounded-karte bg-flaeche p-4 shadow-karte">
        <div className="flex items-start justify-between gap-3"><div><h2 className="font-medium">{a.titel}</h2><p className="mt-1 text-sm text-text-leise">{k?.name ?? "Kein Kunde"}{a.adresse ? ` · ${a.adresse}` : ""}</p></div><span className="rounded-full bg-papier px-2.5 py-1 text-xs font-medium">{label[a.status]}</span></div>
        {a.termin_von ? <p className="zahl mt-3 text-sm text-text-leise">{new Date(a.termin_von).toLocaleString("de-DE",{dateStyle:"medium",timeStyle:"short"})}</p>:null}
      </Link>})}</div>}
  </div>;
}
