"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { auftragSpeichern } from "../actions";
import type { Auftrag, AuftragStatus, Kunde } from "@/types/database";
export function AuftragEditor({auftrag,kunde}:{auftrag:Auftrag;kunde:Kunde|null}) {
 const router=useRouter(); const [pending,start]=useTransition(); const [status,setStatus]=useState<AuftragStatus>(auftrag.status); const [von,setVon]=useState(auftrag.termin_von?.slice(0,16)??""); const [bis,setBis]=useState(auftrag.termin_bis?.slice(0,16)??""); const [adresse,setAdresse]=useState(auftrag.adresse??""); const [notiz,setNotiz]=useState(auftrag.notiz??""); const [msg,setMsg]=useState<string|null>(null);
 function speichern(){start(async()=>{const r=await auftragSpeichern({id:auftrag.id,status,terminVon:von?new Date(von).toISOString():null,terminBis:bis?new Date(bis).toISOString():null,adresse,notiz});setMsg(r.fehler??"Auftrag gespeichert.");router.refresh();});}
 return <><header><p className="text-sm text-text-leise">{kunde?.name??"Kein Kunde"}</p><h1 className="font-titel text-[28px] font-bold">{auftrag.titel}</h1></header>
 <section className="flex flex-col gap-4 rounded-karte bg-flaeche p-4 shadow-karte">
 <label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-text-leise">Status</span><select value={status} onChange={e=>setStatus(e.target.value as AuftragStatus)} className="min-h-11 rounded-feld border border-linie bg-flaeche px-3"><option value="geplant">Geplant</option><option value="in_arbeit">In Arbeit</option><option value="fertig">Fertig</option><option value="abgerechnet">Abgerechnet</option></select></label>
 <div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5"><span className="text-sm text-text-leise">Termin von</span><input type="datetime-local" value={von} onChange={e=>setVon(e.target.value)} className="min-h-11 rounded-feld border border-linie px-2"/></label><label className="flex flex-col gap-1.5"><span className="text-sm text-text-leise">bis</span><input type="datetime-local" value={bis} onChange={e=>setBis(e.target.value)} className="min-h-11 rounded-feld border border-linie px-2"/></label></div>
 <label className="flex flex-col gap-1.5"><span className="text-sm text-text-leise">Baustellenadresse</span><input value={adresse} onChange={e=>setAdresse(e.target.value)} className="min-h-11 rounded-feld border border-linie px-3"/></label>
 <label className="flex flex-col gap-1.5"><span className="text-sm text-text-leise">Notiz</span><textarea value={notiz} onChange={e=>setNotiz(e.target.value)} rows={4} className="rounded-feld border border-linie p-3"/></label>
 <Button variante="primaer" disabled={pending} onClick={speichern}>{pending?"Speichert…":"Auftrag speichern"}</Button>{msg?<Meldung art={msg.includes("konnte")?"fehler":"erfolg"}>{msg}</Meldung>:null}
 </section></>;
}