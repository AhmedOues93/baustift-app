import Link from "next/link";
import { redirect } from "next/navigation";

import { Aufnahme } from "./aufnahme";
import { Button } from "@/components/ui/button";
import { IconZurueck } from "@/components/ui/icons";
import { darfAngebotErstellen } from "@/lib/abo";
import { createClient } from "@/lib/supabase/server";
import type { Kunde } from "@/types/database";

export const metadata = { title: "Neues Angebot · Baustift" };

export default async function NeuesAngebotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: kunden }, { data: profil }, { data: verbraucht }, { count: preise }] =
    await Promise.all([
      supabase.from("kunden").select("*").order("name"),
      supabase
        .from("profiles")
        .select("subscription_status")
        .eq("id", user.id)
        .maybeSingle(),
      supabase.rpc("angebote_diesen_monat", { p_user_id: user.id }),
      supabase
        .from("preisliste")
        .select("id", { count: "exact", head: true })
        .eq("aktiv", true),
    ]);

  const erlaubnis = darfAngebotErstellen(
    profil?.subscription_status ?? "trial",
    verbraucht ?? 0,
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center gap-2">
        <Link
          href="/angebote"
          aria-label="Zurück zu den Angeboten"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-flaeche"
        >
          <IconZurueck className="h-5 w-5" />
        </Link>
        <h1 className="text-[28px] leading-none">Neues Angebot</h1>
      </header>

      {!erlaubnis.erlaubt ? (
        <div className="rounded-karte bg-warnung-flaeche p-5">
          <p className="font-titel text-lg font-bold tracking-tight text-warnung">
            Kontingent erreicht
          </p>
          <p className="mt-1.5 text-sm text-warnung">{erlaubnis.grund}</p>
          <Link href="/abo" className="mt-4 block">
            <Button variante="akzent" vollbreit>
              Abo abschliessen
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Ohne Preisliste findet die KI nichts zum Zuordnen — dann ist jede
              Position "zu prüfen" und das Ergebnis wirkt kaputt. Lieber vorher
              einmal hinweisen als hinterher enttäuschen. */}
          {(preise ?? 0) === 0 ? (
            <div className="rounded-karte bg-info-flaeche p-4">
              <p className="text-sm font-medium text-info">
                Deine Preisliste ist noch leer.
              </p>
              <p className="mt-1 text-sm text-info">
                Das Angebot entsteht trotzdem — aber ohne Preise. Mit gepflegter
                Preisliste rechnet Baustift die Positionen direkt aus.
              </p>
              <Link
                href="/preisliste"
                className="mt-2 inline-block text-sm font-medium text-info underline underline-offset-2"
              >
                Preise anlegen
              </Link>
            </div>
          ) : null}

          <Aufnahme kunden={(kunden ?? []) as Kunde[]} />
        </>
      )}
    </div>
  );
}
