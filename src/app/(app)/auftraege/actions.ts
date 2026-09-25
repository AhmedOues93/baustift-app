"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AuftragStatus } from "@/types/database";

export async function auftragAusAngebot(angebotId: string): Promise<{ fehler?: string; id?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };

  const { data: angebot } = await supabase.from("angebote").select("id,kunde_id,titel,status").eq("id", angebotId).eq("user_id", user.id).maybeSingle();
  if (!angebot) return { fehler: "Angebot nicht gefunden." };
  if (angebot.status !== "angenommen") return { fehler: "Nur angenommene Angebote können als Auftrag übernommen werden." };

  const { data: vorhanden } = await supabase.from("auftraege").select("id").eq("user_id", user.id).eq("angebot_id", angebotId).maybeSingle();
  if (vorhanden) return { id: vorhanden.id };

  let adresse: string | null = null;
  if (angebot.kunde_id) {
    const { data: kunde } = await supabase.from("kunden").select("strasse,plz,ort").eq("id", angebot.kunde_id).eq("user_id", user.id).maybeSingle();
    adresse = [kunde?.strasse, [kunde?.plz, kunde?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
  }

  const { data, error } = await supabase.from("auftraege").insert({
    user_id: user.id, kunde_id: angebot.kunde_id, angebot_id: angebot.id,
    titel: angebot.titel || "Auftrag", status: "geplant", termin_von: null, termin_bis: null,
    adresse, notiz: null, fertig_am: null,
  }).select("id").single();
  if (error || !data) return { fehler: "Auftrag konnte nicht erstellt werden." };
  revalidatePath("/auftraege");
  return { id: data.id };
}

export async function auftragSpeichern(args: { id: string; status: AuftragStatus; terminVon: string | null; terminBis: string | null; adresse: string | null; notiz: string | null }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { fehler: "Bitte neu anmelden." };
  const { error } = await supabase.from("auftraege").update({
    status: args.status, termin_von: args.terminVon || null, termin_bis: args.terminBis || null,
    adresse: args.adresse?.trim() || null, notiz: args.notiz?.trim() || null,
    fertig_am: args.status === "fertig" ? new Date().toISOString() : null,
  }).eq("id", args.id).eq("user_id", user.id);
  if (error) return { fehler: "Auftrag konnte nicht gespeichert werden." };
  revalidatePath("/auftraege"); revalidatePath(`/auftraege/${args.id}`);
  return {};
}
