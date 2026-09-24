import Link from "next/link";
import { redirect } from "next/navigation";

import { DatenBereich } from "./daten-bereich";
import { FirmendatenFormular } from "./firmendaten-formular";
import { abmelden } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Plakette } from "@/components/ui/field";
import { createClient } from "@/lib/supabase/server";
import { KONTINGENT, istPilot, planName } from "@/lib/abo";
import type { Profile } from "@/types/database";

export const metadata = { title: "Konto · Baustift" };

export default async function EinstellungenPage() {
  const supabase = await createClient();
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

  // Signierte URL fürs Logo: der Bucket ist privat, ein direkter Link würde 403
  // liefern. Eine Stunde reicht für die Anzeige der Seite.
  let logoUrl: string | null = null;
  if (profil.logo_url) {
    const { data } = await supabase.storage
      .from("logos")
      .createSignedUrl(profil.logo_url, 60 * 60);
    logoUrl = data?.signedUrl ?? null;
  }

  const { data: verbraucht } = await supabase.rpc("angebote_diesen_monat", {
    p_user_id: user.id,
  });

  const grenze = KONTINGENT[profil.subscription_status] ?? KONTINGENT.trial;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[28px] leading-none">Konto</h1>
        <p className="mt-1.5 break-all text-sm text-text-leise">{user.email}</p>
      </header>

      {/* Abo-Karte: was habe ich, was habe ich verbraucht, wie ändere ich es. */}
      <section className="rounded-karte bg-flaeche p-4 shadow-karte sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg">{planName(profil.subscription_status)}</h2>
            <p className="mt-1 text-sm text-text-leise">
              <span className="zahl">{verbraucht ?? 0}</span> von{" "}
              <span className="zahl">{grenze}</span> Angeboten diesen Monat
            </p>
          </div>
          <Plakette
            ton={
              profil.subscription_status === "aktiv"
                ? "erfolg"
                : istPilot(profil.subscription_status)
                  ? "info"
                  : "warnung"
            }
          >
            {profil.subscription_status === "aktiv"
              ? "Aktiv"
              : istPilot(profil.subscription_status)
                ? "Test"
                : "Probe"}
          </Plakette>
        </div>

        {istPilot(profil.subscription_status) ? (
          <Link href="/pilot" className="mt-4 block">
            <Button variante="sekundaer" vollbreit>
              Zahlen aus dem Test ansehen
            </Button>
          </Link>
        ) : null}

        <Link href="/abo" className="mt-4 block">
          <Button variante="sekundaer" vollbreit>
            {profil.subscription_status === "aktiv"
              ? "Abo verwalten"
              : "Abo abschliessen"}
          </Button>
        </Link>
      </section>

      <FirmendatenFormular profil={profil as Profile} logoUrl={logoUrl} />

      <DatenBereich firmaName={profil.firma_name || user.email || "mein Konto"} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-leise">
          <Link href="/rechtliches/impressum" className="underline underline-offset-2">
            Impressum
          </Link>
          <Link href="/rechtliches/datenschutz" className="underline underline-offset-2">
            Datenschutz
          </Link>
          <Link href="/rechtliches/agb" className="underline underline-offset-2">
            AGB
          </Link>
          <Link href="/rechtliches/av-vertrag" className="underline underline-offset-2">
            Auftragsverarbeitung
          </Link>
        </div>

        <form action={abmelden}>
          <Button type="submit" variante="sekundaer" vollbreit>
            Abmelden
          </Button>
        </form>
      </section>
    </div>
  );
}
