import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { IconZurueck } from "@/components/ui/icons";
import { istPilot } from "@/lib/abo";
import { formatZehntelcent } from "@/lib/ai/kosten";
import { createClient } from "@/lib/supabase/server";
import type { Feedback, PilotAuswertung } from "@/types/database";
import { FEEDBACK_ART_LABEL } from "@/types/database";

export const metadata = { title: "Testbetrieb · Baustift" };

/**
 * Auswertung des Piloten.
 *
 * Die Seite beantwortet die vier Fragen, für die der ganze Pilot da ist:
 *
 *   1. Wird wirklich gesprochen — oder tippen am Ende doch alle?
 *   2. Trifft das Preis-Matching? (Anteil "zu prüfen")
 *   3. Was kostet uns ein Angebot wirklich?
 *   4. Kommt aus den Angeboten auch Arbeit? (gesendet, angenommen)
 *
 * Bewusst pro Konto und nicht als Betreiber-Übersicht: die Zahlen laufen
 * durch dieselbe RLS wie alles andere. Für den Blick über alle Testkonten
 * hinweg gibt es den SQL-Editor — ein Admin-Bereich wäre eine eigene
 * Angriffsfläche für eine Frage, die man dreimal im Monat stellt.
 */
export default async function PilotPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profil } = await supabase
    .from("profiles")
    .select("subscription_status")
    .eq("id", user.id)
    .maybeSingle();

  // Ausserhalb des Testbetriebs gibt es diese Seite nicht.
  if (!istPilot(profil?.subscription_status ?? "")) notFound();

  const [{ data: zahlenRoh }, { data: meldungen }] = await Promise.all([
    supabase.rpc("pilot_auswertung", { p_user_id: user.id }),
    supabase
      .from("feedback")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const z = (Array.isArray(zahlenRoh) ? zahlenRoh[0] : zahlenRoh) as
    | PilotAuswertung
    | undefined;

  const gesamt = z?.angebote_gesamt ?? 0;
  // Nur neu erfasste Angebote zählen für die Sprachquote. Eine Kopie ist keine
  // Gelegenheit zu diktieren — sie im Nenner mitzuzählen würde die eine Zahl
  // verwässern, um die es im Piloten geht: wird wirklich gesprochen?
  const erfasst = (z?.per_sprache ?? 0) + (z?.per_text ?? 0);
  const sprachAnteil =
    erfasst > 0 ? Math.round(((z?.per_sprache ?? 0) / erfasst) * 100) : 0;
  const positionen = z?.positionen_gesamt ?? 0;
  const pruefAnteil =
    positionen > 0 ? Math.round(((z?.positionen_zu_pruefen ?? 0) / positionen) * 100) : 0;
  const proAngebot = gesamt > 0 ? Math.round((z?.kosten_zehntelcent ?? 0) / gesamt) : 0;

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/einstellungen"
        className="-ml-2 inline-flex min-h-11 items-center gap-1 self-start rounded-full px-2 text-sm font-medium text-text-leise transition-colors active:bg-flaeche"
      >
        <IconZurueck className="h-4 w-4" />
        Konto
      </Link>

      <header>
        <h1 className="text-[28px] leading-none">Testbetrieb</h1>
        <p className="mt-1.5 text-sm text-text-leise">
          Deine Zahlen aus dem laufenden Test.
        </p>
      </header>

      {gesamt === 0 ? (
        <p className="rounded-karte border border-dashed border-linie p-8 text-center text-text-leise">
          Noch keine Angebote. Sobald du das erste erstellst, stehen hier die
          Zahlen.
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-2">
            <Kachel
              titel="Per Sprache"
              wert={`${sprachAnteil} %`}
              fuss={`${z?.per_sprache ?? 0} von ${erfasst} neu erfassten`}
              ton={sprachAnteil >= 60 ? "erfolg" : "neutral"}
            />
            <Kachel
              titel="Ohne Preis"
              wert={`${pruefAnteil} %`}
              fuss={`${z?.positionen_zu_pruefen ?? 0} von ${positionen} Positionen`}
              // Viel "zu prüfen" heisst: Preisliste zu dünn oder Matching zu
              // streng. Ab einem Drittel wird es unangenehm in der Benutzung.
              ton={pruefAnteil > 33 ? "warnung" : "erfolg"}
            />
            <Kachel
              titel="Kosten je Angebot"
              wert={formatZehntelcent(proAngebot)}
              fuss={`${formatZehntelcent(z?.kosten_zehntelcent ?? 0)} gesamt`}
            />
            <Kachel
              titel="Aufnahme"
              wert={`${z?.sekunden_schnitt ?? 0} s`}
              fuss="im Schnitt"
            />
            <Kachel
              titel="Verschickt"
              wert={String(z?.angebote_gesendet ?? 0)}
              fuss={`von ${gesamt}`}
            />
            <Kachel
              titel="Angenommen"
              wert={String(z?.angebote_angenommen ?? 0)}
              fuss={`von ${z?.angebote_gesendet ?? 0} verschickten`}
              ton="erfolg"
            />
          </section>

          <p className="text-sm text-text-leise">
            Wenn „ohne Preis“ hoch ist, fehlen meist Einträge in der{" "}
            <Link href="/preisliste" className="text-akzent underline underline-offset-2">
              Preisliste
            </Link>{" "}
            — oder die Stichworte passen noch nicht zu deiner Sprache.
          </p>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-lg">Deine Rückmeldungen</h2>
        {(meldungen ?? []).length === 0 ? (
          <p className="text-sm text-text-leise">
            Noch nichts gemeldet. Der Knopf unten links ist genau dafür da.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {((meldungen ?? []) as Feedback[]).map((m) => (
              <li key={m.id} className="rounded-karte bg-flaeche p-4 shadow-karte">
                <p className="text-xs text-text-leise">
                  {FEEDBACK_ART_LABEL[m.art]}
                  {m.seite ? ` · ${m.seite}` : ""}
                </p>
                <p className="mt-1 text-sm">{m.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Kachel({
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
