import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Entscheidung } from "./entscheidung";
import { formatEuro } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { EINHEIT_LABEL } from "@/types/database";
import type { AngebotFreigabe, FreigabePosition } from "@/types/database";

/**
 * =============================================================================
 * Das Angebot beim Kunden
 * =============================================================================
 * Die einzige Seite der Anwendung, die jemandem ohne Konto gehört. Der Kunde
 * bekommt einen Link, sieht was angeboten wurde, und sagt zu oder ab.
 *
 * Warum überhaupt: bisher endete der Weg beim Versand. Ob der Kunde das PDF
 * geöffnet hat, wusste niemand; die Zusage kam per Anruf und wurde — wenn
 * überhaupt — von Hand nachgetragen. Beides steht jetzt im System.
 *
 * Gestaltet wie ein Dokument, nicht wie eine App: keine Navigation, keine
 * Anmeldung, nichts zum Verlaufen. Zwei Knöpfe, und die Antwort ist raus.
 */

/** Nicht in den Index — es ist ein privates Dokument mit Preisen. */
export const metadata: Metadata = {
  title: "Ihr Angebot",
  robots: { index: false, follow: false },
};

export default async function AngebotFreigabeSeite({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: zeilen } = await supabase.rpc("angebot_per_token", {
    p_token: token,
  });
  const angebot = (zeilen as AngebotFreigabe[] | null)?.[0];

  // Falscher Schlüssel, noch ein Entwurf, gelöscht: alles dasselbe Ergebnis.
  // Wer Links durchprobiert, soll aus der Antwort nichts ableiten können.
  if (!angebot) notFound();

  const { data: positionen } = await supabase.rpc("angebot_positionen_per_token", {
    p_token: token,
  });

  // Vermerken, dass der Kunde hereingeschaut hat — nur beim ersten Mal, und
  // ein Fehler dabei darf die Seite nicht kosten.
  await supabase.rpc("angebot_geoeffnet", { p_token: token }).then(
    () => undefined,
    () => undefined,
  );

  const entschieden = Boolean(angebot.entschieden_am);
  const abgelaufen =
    !entschieden &&
    Boolean(angebot.gueltig_bis) &&
    new Date(angebot.gueltig_bis!) < new Date(new Date().toDateString());

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Briefkopf des Betriebs */}
      <header className="flex flex-col gap-1">
        <p className="font-titel text-lg font-bold tracking-tight text-text">
          {angebot.firma_name}
        </p>
        <p className="text-sm text-text-leise">
          {[angebot.firma_strasse, [angebot.firma_plz, angebot.firma_ort].filter(Boolean).join(" ")]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div className="mt-6 rounded-karte border border-linie bg-flaeche p-5 sm:p-7">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="font-titel text-2xl font-bold tracking-tight text-text">
            {angebot.titel}
          </h1>
          <span className="zahl text-sm text-text-leise">{angebot.nummer}</span>
        </div>

        <p className="mt-1 text-sm text-text-leise">
          {angebot.kunde_name ? `Für ${angebot.kunde_name} · ` : ""}
          vom <span className="zahl">{formatDatum(angebot.datum)}</span>
          {angebot.gueltig_bis ? (
            <>
              {" · gültig bis "}
              <span className="zahl">{formatDatum(angebot.gueltig_bis)}</span>
            </>
          ) : null}
        </p>

        {/* Positionen */}
        <ul className="mt-6 flex flex-col divide-y divide-linie border-y border-linie">
          {(positionen as FreigabePosition[] | null)?.map((p) => (
            <li key={p.pos_nr} className="flex flex-col gap-1 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium text-text">{p.bezeichnung}</span>
                <span className="zahl shrink-0 font-medium text-text">
                  {formatEuro(p.gesamtpreis)}
                </span>
              </div>
              {p.beschreibung ? (
                <p className="text-sm text-text-leise">{p.beschreibung}</p>
              ) : null}
              <p className="zahl text-sm text-text-leise">
                {formatMenge(p.menge)} {EINHEIT_LABEL[p.einheit]} × {formatEuro(p.einzelpreis)}
              </p>
            </li>
          ))}
        </ul>

        {/* Summen */}
        <dl className="mt-4 flex flex-col gap-1.5 text-sm">
          <Zeile bezeichnung="Netto" betrag={angebot.netto} />
          {angebot.mwst_satz > 0 ? (
            <Zeile
              bezeichnung={`MwSt. ${String(angebot.mwst_satz).replace(".00", "").replace(".", ",")} %`}
              betrag={angebot.mwst_betrag}
            />
          ) : null}
          <div className="mt-1 flex items-baseline justify-between border-t border-linie pt-2">
            <dt className="font-medium text-text">Gesamt</dt>
            <dd className="zahl text-xl font-semibold text-text">
              {formatEuro(angebot.brutto)}
            </dd>
          </div>
          {angebot.firma_kleinunternehmer ? (
            <p className="text-xs text-text-leise">
              Gemäss §19 UStG wird keine Umsatzsteuer berechnet.
            </p>
          ) : null}
        </dl>

        {angebot.notiz ? (
          <p className="mt-5 rounded-feld bg-papier p-3 text-sm text-text-leise">
            {angebot.notiz}
          </p>
        ) : null}

        <a
          href={`/angebot/${token}/pdf`}
          className="mt-5 inline-flex min-h-11 items-center text-sm font-medium text-akzent underline underline-offset-2"
        >
          Angebot als PDF öffnen
        </a>
      </div>

      {/* Entscheidung */}
      <Entscheidung
        token={token}
        entschiedenAls={entschieden ? angebot.status : null}
        anmerkung={angebot.kunden_anmerkung}
        abgelaufen={abgelaufen}
        telefon={angebot.firma_telefon}
        email={angebot.firma_email}
        firma={angebot.firma_name}
      />

      <footer className="mt-10 text-center text-xs text-text-leise">
        {angebot.firma_name}
        {angebot.firma_telefon ? ` · ${angebot.firma_telefon}` : ""}
        {angebot.firma_email ? ` · ${angebot.firma_email}` : ""}
      </footer>
    </main>
  );
}

function Zeile({ bezeichnung, betrag }: { bezeichnung: string; betrag: number }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-text-leise">{bezeichnung}</dt>
      <dd className="zahl text-text">{formatEuro(betrag)}</dd>
    </div>
  );
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}

function formatMenge(n: number): string {
  return String(n).replace(/\.?0+$/, "").replace(".", ",") || "0";
}
