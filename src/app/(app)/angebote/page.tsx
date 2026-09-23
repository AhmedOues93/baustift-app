import Link from "next/link";
import { redirect } from "next/navigation";

import { Plakette } from "@/components/ui/field";
import { IconMikrofon, IconSuche } from "@/components/ui/icons";
import { formatEuro } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  ANGEBOT_STATUS_LABEL,
  type Angebot,
  type AngebotStatus,
  type Kunde,
} from "@/types/database";

export const metadata = { title: "Angebote · Baustift" };

/** Ab wann gilt ein verschicktes Angebot als "liegt zu lange"? */
const NACHFASSEN_NACH_TAGEN = 7;

export default async function AngebotePage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: angebote }, { data: kunden }, { data: profil }] = await Promise.all([
    supabase.from("angebote").select("*").order("created_at", { ascending: false }),
    supabase.from("kunden").select("id, name"),
    supabase
      .from("profiles")
      .select("onboarding_am")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  // Wer noch nie eingerichtet hat, landet hier auf einer leeren Liste und
  // weiss nicht, dass Firmendaten und Preise fehlen. Also einmal hinführen.
  if (profil && !profil.onboarding_am) redirect("/willkommen");

  const kundenName = new Map(
    ((kunden ?? []) as Pick<Kunde, "id" | "name">[]).map((k) => [k.id, k.name]),
  );

  const alle = (angebote ?? []) as Angebot[];
  const suche = (searchParams.q ?? "").trim().toLowerCase();
  const liste = suche
    ? alle.filter((a) =>
        [a.nummer, a.titel, a.kunde_id ? kundenName.get(a.kunde_id) : ""]
          .join(" ")
          .toLowerCase()
          .includes(suche),
      )
    : alle;

  // --- Kennzahlen ------------------------------------------------------------
  // Bewusst nur drei: was ist draussen, was kam rein, wo muss ich hinterher.
  // Alles andere ist Dekoration auf einem Handydisplay.
  const offen = alle.filter((a) => a.status === "gesendet");
  const offenSumme = offen.reduce((s, a) => s + a.brutto, 0);

  const monatsStart = new Date();
  monatsStart.setDate(1);
  monatsStart.setHours(0, 0, 0, 0);
  const angenommen = alle.filter(
    (a) =>
      a.status === "angenommen" &&
      a.entschieden_am &&
      new Date(a.entschieden_am) >= monatsStart,
  );
  const angenommenSumme = angenommen.reduce((s, a) => s + a.brutto, 0);

  const faellig = alle.filter((a) => istNachfassFaellig(a));

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-[28px] leading-none">Angebote</h1>
      </header>

      {/* Die wichtigste Aktion des Produkts — gross, dunkel, immer oben. */}
      <Link
        href="/angebote/neu"
        className="flex items-center gap-4 rounded-tafel bg-tief p-5 text-text-invers transition-colors active:bg-text"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-akzent">
          <IconMikrofon className="h-6 w-6" />
        </span>
        <span>
          <span className="block font-titel text-lg font-bold tracking-tight">
            Neues Angebot
          </span>
          <span className="block text-sm text-text-invers/70">
            Einsprechen — fertig in einer Minute
          </span>
        </span>
      </Link>

      {alle.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Kennzahl
            titel="Offen"
            wert={formatEuro(offenSumme)}
            fuss={`${offen.length} ${offen.length === 1 ? "Angebot" : "Angebote"}`}
          />
          <Kennzahl
            titel="Angenommen"
            wert={formatEuro(angenommenSumme)}
            fuss="diesen Monat"
            ton="erfolg"
          />
          {faellig.length > 0 ? (
            // Über die volle Breite: bei zwei Spalten bricht der Fusstext auf
            // 390px um und die Karte steht schief neben den anderen beiden.
            <div className="col-span-2 lg:col-span-1">
              <Kennzahl
                titel="Nachfassen"
                wert={String(faellig.length)}
                fuss={`seit über ${NACHFASSEN_NACH_TAGEN} Tagen ohne Antwort`}
                ton="warnung"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Suche als echtes Formular: funktioniert auch ohne JavaScript und
          überlebt einen Reload auf der Baustelle. */}
      {alle.length > 5 ? (
        <form className="relative">
          <IconSuche className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-leise" />
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder="Kunde, Projekt, Nummer…"
            aria-label="Angebote durchsuchen"
            className="min-h-11 w-full rounded-feld border border-linie bg-flaeche py-2 pl-11 pr-3 text-base text-text transition-colors placeholder:text-text-leise/60 focus:border-text focus:outline-none"
          />
        </form>
      ) : null}

      {liste.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            {alle.length === 0 ? "Noch keine Angebote" : "Nichts gefunden"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            {alle.length === 0
              ? "Sprich deine erste Leistung ein — Baustift macht ein Angebot daraus."
              : "Andere Suche probieren?"}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {liste.map((a) => (
            <li key={a.id} className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
              <Link
                href={`/angebote/${a.id}`}
                className="flex min-h-14 items-center gap-3 p-4 transition-colors active:bg-papier"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {a.kunde_id ? kundenName.get(a.kunde_id) : a.titel || "Ohne Kunde"}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-text-leise">
                    {a.titel || "Ohne Titel"}
                  </span>
                  <span className="zahl mt-1 block text-xs text-text-leise">
                    {a.nummer} · {formatDatum(a.datum)}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="zahl whitespace-nowrap text-[15px] font-medium">
                    {formatEuro(a.brutto)}
                  </span>
                  <Plakette ton={statusTon(a)}>
                    {istNachfassFaellig(a)
                      ? "Nachfassen"
                      : ANGEBOT_STATUS_LABEL[a.status]}
                  </Plakette>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Kennzahl({
  titel,
  wert,
  fuss,
  ton = "neutral",
}: {
  titel: string;
  wert: string;
  fuss: string;
  ton?: "neutral" | "erfolg" | "warnung";
}) {
  const flaeche = {
    neutral: "bg-flaeche",
    erfolg: "bg-erfolg-flaeche",
    warnung: "bg-warnung-flaeche",
  }[ton];
  const schrift = {
    neutral: "text-text",
    erfolg: "text-erfolg",
    warnung: "text-warnung",
  }[ton];

  return (
    <div className={`h-full rounded-karte p-4 shadow-karte ${flaeche}`}>
      <p className={`text-sm ${ton === "neutral" ? "text-text-leise" : schrift}`}>
        {titel}
      </p>
      <p className={`zahl mt-1 text-xl font-semibold ${schrift}`}>{wert}</p>
      <p className={`mt-0.5 text-xs ${ton === "neutral" ? "text-text-leise" : schrift}`}>
        {fuss}
      </p>
    </div>
  );
}

/**
 * Ein Angebot ist "nachzufassen", wenn es raus ist und seit einer Woche
 * niemand reagiert hat. Das ist der Punkt, an dem im Handwerk Aufträge
 * liegenbleiben — deshalb steht es im Dashboard und nicht in einem Menü.
 */
function istNachfassFaellig(a: Angebot): boolean {
  if (a.status !== "gesendet" || !a.gesendet_am) return false;
  const tage = (Date.now() - new Date(a.gesendet_am).getTime()) / 86_400_000;
  return tage >= NACHFASSEN_NACH_TAGEN;
}

function statusTon(a: Angebot) {
  if (istNachfassFaellig(a)) return "warnung" as const;
  return statusTonRoh(a.status);
}

function statusTonRoh(status: AngebotStatus) {
  switch (status) {
    case "angenommen":
      return "erfolg" as const;
    case "abgelehnt":
    case "nachfassen":
      return "warnung" as const;
    case "gesendet":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
