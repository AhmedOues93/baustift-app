import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { KundeKopf } from "./kunde-kopf";
import { Plakette } from "@/components/ui/field";
import { IconMikrofon, IconZurueck } from "@/components/ui/icons";
import { istNachfassFaellig } from "@/lib/angebot";
import { formatEuro } from "@/lib/format";
import { rechnungUeberfaellig } from "@/lib/rechnung";
import { createClient } from "@/lib/supabase/server";
import {
  ANGEBOT_STATUS_LABEL,
  RECHNUNG_STATUS_LABEL,
  type Angebot,
  type Kunde,
  type Rechnung,
} from "@/types/database";

export const metadata = { title: "Kunde · Baustift" };

/**
 * Kundenakte.
 *
 * Bisher führte ein Tipp auf einen Kunden direkt ins Bearbeiten-Formular —
 * man konnte die Anschrift ändern, aber nicht sehen, was mit dem Kunden
 * läuft. Genau das ist aber die Frage, die am Telefon gestellt wird: "Was
 * haben wir denn bei Ihnen offen?"
 *
 * Deshalb stehen hier Angebote und Rechnungen dieses Kunden auf einer Seite,
 * und die Telefonnummer ist ein Link: im Handwerk wird angerufen, nicht
 * geschrieben.
 */
export default async function KundePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: kunde }, { data: angebote }, { data: rechnungen }] =
    await Promise.all([
      supabase.from("kunden").select("*").eq("id", id).maybeSingle(),
      supabase
        .from("angebote")
        .select("*")
        .eq("kunde_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("rechnungen")
        .select("*")
        .eq("kunde_id", id)
        .order("created_at", { ascending: false }),
    ]);

  // RLS liefert fremde Kunden gar nicht erst — 404 verrät nicht, ob es die
  // ID gibt.
  if (!kunde) notFound();

  const alleAngebote = (angebote ?? []) as Angebot[];
  const alleRechnungen = (rechnungen ?? []) as Rechnung[];

  const offeneAngebote = alleAngebote.filter((a) => a.status === "gesendet");
  const offeneRechnungen = alleRechnungen.filter((r) => r.status === "gestellt");
  const umsatz = alleRechnungen
    .filter((r) => r.status === "bezahlt")
    .reduce((s, r) => s + r.brutto, 0);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/kunden"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Kunden
      </Link>

      <KundeKopf kunde={kunde as Kunde} />

      {/* Neues Angebot: aus der Akte heraus ist der Kunde schon klar. */}
      <Link
        href={`/angebote/neu?kunde=${kunde.id}`}
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
            für {kunde.name}
          </span>
        </span>
      </Link>

      {alleAngebote.length > 0 || alleRechnungen.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          <Zahl
            titel="Offene Angebote"
            wert={formatEuro(offeneAngebote.reduce((s, a) => s + a.brutto, 0))}
            fuss={`${offeneAngebote.length} ${offeneAngebote.length === 1 ? "Angebot" : "Angebote"}`}
          />
          <Zahl
            titel="Offene Rechnungen"
            wert={formatEuro(offeneRechnungen.reduce((s, r) => s + r.brutto, 0))}
            fuss={`${offeneRechnungen.length} ${offeneRechnungen.length === 1 ? "Rechnung" : "Rechnungen"}`}
            ton={offeneRechnungen.some((r) => rechnungUeberfaellig(r)) ? "warnung" : "neutral"}
          />
          <div className="col-span-2 lg:col-span-1">
            <Zahl titel="Bezahlt" wert={formatEuro(umsatz)} fuss="insgesamt" ton="erfolg" />
          </div>
        </section>
      ) : null}

      <Bereich titel="Angebote" anzahl={alleAngebote.length}>
        {alleAngebote.map((a) => (
          <Eintrag
            key={a.id}
            href={`/angebote/${a.id}`}
            titel={a.titel || "Ohne Titel"}
            zeile={`${a.nummer} · ${formatDatum(a.datum)}`}
            betrag={a.brutto}
            marke={
              istNachfassFaellig(a) ? "Nachfassen" : ANGEBOT_STATUS_LABEL[a.status]
            }
            ton={
              istNachfassFaellig(a)
                ? "warnung"
                : a.status === "angenommen"
                  ? "erfolg"
                  : a.status === "gesendet"
                    ? "info"
                    : "neutral"
            }
          />
        ))}
      </Bereich>

      <Bereich titel="Rechnungen" anzahl={alleRechnungen.length}>
        {alleRechnungen.map((r) => (
          <Eintrag
            key={r.id}
            href={`/rechnungen/${r.id}`}
            titel={r.titel || "Ohne Titel"}
            zeile={`${r.nummer} · ${formatDatum(r.datum)}`}
            betrag={r.brutto}
            marke={
              rechnungUeberfaellig(r) ? "Überfällig" : RECHNUNG_STATUS_LABEL[r.status]
            }
            ton={
              rechnungUeberfaellig(r)
                ? "warnung"
                : r.status === "bezahlt"
                  ? "erfolg"
                  : r.status === "gestellt"
                    ? "info"
                    : "neutral"
            }
          />
        ))}
      </Bereich>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function Bereich({
  titel,
  anzahl,
  children,
}: {
  titel: string;
  anzahl: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-titel text-lg font-bold tracking-tight text-text">
        {titel} {anzahl > 0 ? <span className="zahl text-text-leise">{anzahl}</span> : null}
      </h2>
      {anzahl === 0 ? (
        <p className="rounded-karte border border-dashed border-linie p-5 text-center text-sm text-text-leise">
          Noch nichts.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

function Eintrag({
  href,
  titel,
  zeile,
  betrag,
  marke,
  ton,
}: {
  href: string;
  titel: string;
  zeile: string;
  betrag: number;
  marke: string;
  ton: "neutral" | "erfolg" | "warnung" | "info";
}) {
  return (
    <li className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
      <Link
        href={href}
        className="flex min-h-14 items-center gap-3 p-4 transition-colors active:bg-papier"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text">{titel}</span>
          <span className="zahl mt-1 block text-xs text-text-leise">{zeile}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="zahl whitespace-nowrap text-[15px] font-medium">
            {formatEuro(betrag)}
          </span>
          <Plakette ton={ton}>{marke}</Plakette>
        </span>
      </Link>
    </li>
  );
}

function Zahl({
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
  const flaeche =
    ton === "erfolg"
      ? "bg-erfolg-flaeche"
      : ton === "warnung"
        ? "bg-warnung-flaeche"
        : "bg-flaeche";
  const schrift =
    ton === "erfolg" ? "text-erfolg" : ton === "warnung" ? "text-warnung" : "text-text";

  return (
    <div className={`rounded-karte p-4 shadow-karte ${flaeche}`}>
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

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
