import { redirect } from "next/navigation";

import { Einrichtung } from "./einrichtung";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export const metadata = { title: "Einrichtung · Baustift" };

export default async function WillkommenPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profil) redirect("/login");
  // Wer schon eingerichtet ist, soll hier nicht wieder landen.
  if (profil.onboarding_am) redirect("/angebote");

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[28px] leading-tight">Willkommen bei Baustift</h1>
        <p className="mt-2 text-text-leise">
          Drei kurze Schritte, dann kannst du dein erstes Angebot einsprechen.
        </p>
      </header>

      <Einrichtung profil={profil as Profile} />
    </div>
  );
}
