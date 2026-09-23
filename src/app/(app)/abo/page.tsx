import Link from "next/link";
import { redirect } from "next/navigation";

import { AboAktionen } from "./abo-aktionen";
import { Meldung } from "@/components/ui/field";
import { IconZurueck } from "@/components/ui/icons";
import { KONTINGENT, PREIS_MONATLICH_EUR, planName } from "@/lib/abo";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Abo · Baustift" };

const LEISTUNGEN = [
  "Angebote per Sprachnachricht erstellen",
  "Eigene Preisliste mit automatischer Zuordnung",
  "Professionelles PDF mit deinem Logo",
  "Kunden- und Angebotsverwaltung",
  "Nachfass-Erinnerung für offene Angebote",
];

export default async function AboPage({
  searchParams,
}: {
  searchParams: { erfolg?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profil }, { data: verbraucht }] = await Promise.all([
    supabase
      .from("profiles")
      .select("subscription_status, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.rpc("angebote_diesen_monat", { p_user_id: user.id }),
  ]);

  const status = profil?.subscription_status ?? "trial";
  const aktiv = status === "aktiv";

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/einstellungen"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Konto
      </Link>

      <h1 className="text-[28px] leading-none">Abo</h1>

      {searchParams.erfolg ? (
        <Meldung art="erfolg">
          Danke! Dein Abo ist aktiv. Es kann einen Moment dauern, bis alles
          umgestellt ist.
        </Meldung>
      ) : null}

      <section className="rounded-tafel bg-tief p-6 text-text-invers">
        <p className="text-sm text-text-invers/70">{planName(status)}</p>
        <p className="mt-2">
          <span className="zahl font-titel text-4xl font-extrabold tracking-tight">
            {PREIS_MONATLICH_EUR} €
          </span>
          <span className="ml-2 text-text-invers/70">pro Monat, zzgl. MwSt.</span>
        </p>
        <p className="mt-1 text-sm text-text-invers/70">
          Monatlich kündbar. Keine Einrichtungsgebühr.
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {LEISTUNGEN.map((l) => (
            <li key={l} className="flex items-start gap-2.5 text-sm">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-akzent" />
              {l}
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <AboAktionen aktiv={aktiv} hatKunde={Boolean(profil?.stripe_customer_id)} />
        </div>
      </section>

      <p className="text-sm text-text-leise">
        {aktiv
          ? `Enthalten sind ${KONTINGENT.aktiv} Angebote im Monat — diesen Monat hast du ${verbraucht ?? 0} erstellt. Brauchst du mehr, melde dich bei uns.`
          : `In der Testphase sind ${KONTINGENT.trial} Angebote enthalten. Du hast diesen Monat ${verbraucht ?? 0} erstellt.`}
      </p>

      <p className="text-xs text-text-leise">
        Mit dem Abschluss gelten unsere{" "}
        <Link href="/rechtliches/agb" className="underline underline-offset-2">
          AGB
        </Link>{" "}
        und der{" "}
        <Link href="/rechtliches/av-vertrag" className="underline underline-offset-2">
          Vertrag zur Auftragsverarbeitung
        </Link>
        .
      </p>
    </div>
  );
}
