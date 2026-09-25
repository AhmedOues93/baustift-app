import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuftragEditor } from "./auftrag-editor";
import type { Auftrag, AuftragDokumentation, Kunde } from "@/types/database";
export default async function AuftragPage({params}:{params:Promise<{id:string}>}) {
 const {id}=await params; const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) redirect("/login");
 const [{data:a},{data:kunden},{data:doku}]=await Promise.all([supabase.from("auftraege").select("*").eq("id",id).eq("user_id",user.id).maybeSingle(),supabase.from("kunden").select("*").eq("user_id",user.id),supabase.from("auftrag_dokumentation").select("*").eq("auftrag_id",id).order("created_at",{ascending:false})]);
 if(!a) notFound(); const k=((kunden??[]) as Kunde[]).find(k=>k.id===a.kunde_id);
 return <div className="flex flex-col gap-4"><Link href="/auftraege" className="text-sm font-medium text-text-leise">← Aufträge</Link><AuftragEditor auftrag={a as Auftrag} kunde={k??null} dokumentation={(doku??[]) as AuftragDokumentation[]}/></div>;
}