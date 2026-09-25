import Link from "next/link";
import { redirect } from "next/navigation";

import { Plakette } from "@/components/ui/field";
import { IconSuche } from "@/components/ui/icons";
import { Filterleiste } from "@/components/ui/filterleiste";
import { MehrAnzeigen, anzahlAusParameter } from "@/components/ui/mehr";
import { formatEuro } from "@/lib/format";
import { rechnungUeberfaellig } from "@/lib/rechnung";
import { createClient } from "@/lib/supabase/server";
import {
  RECHNUNG_STATUS_LABEL,
  type Kunde,
  type Rechnung,
  type RechnungStatus,
} from "@/types/database";

export const metadata = { title: "Rechnungen · Baustift" };

/** Siehe Angebotsliste: die Kennzahlen rechnen über diese Menge. */
const OBERGRENZE = 500;

/** Die Filter über der Liste. "offen" schliesst überfällige mit ein. */
const FILTER = {
  alle: "Alle",
  offen: "Offen",
  ueberfaellig: "Überfällig",
  bezahlt: "Bezahlt",
} as const;
type Filter = keyof typeof FILTER;

export default async function RechnungenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; f?: string; n?: string }>;
}) {
  const { q, f, n } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: rechnungen }, { data: kunden }] = await Promise.all([
    supabase
      .from("rechnungen")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(OBERGRENZE),
    supabase.from("kunden").select("id, name"),
  ]);

  const kundenName = new Map(
    ((kunden ?? []) as Pick<Kunde, "id" | "name">[]).map((k) => [k.id, k.name]),
  );
  const alle = (rechnungen ?? []) as Rechnung[];

  // Zwei Zahlen reichen: was ist offen, und was davon ist zu spät.
  const offen = alle.filter((r) => r.status === "gestellt");
  const offenSumme = offen.reduce((s, r) => s + r.brutto, 0);
  const ueberfaellig = offen.filter((r) => rechnungUeberfaellig(r));
  const ueberfaelligSumme = ueberfaellig.reduce((s, r) => s + r.brutto, 0);

  // --- Suchen und filtern ----------------------------------------------------
  // Beides über Suchparameter und ein normales Formular: funktioniert ohne
  // JavaScript und überlebt den Reload, wenn unterwegs das Netz wegbricht.
  const filter: Filter = f && f in FILTER ? (f as Filter) : "alle";
  const suche = (q ?? "").trim().toLowerCase();

  const liste = alle
    .filter((r) => {
      if (filter === "offen") return r.status === "gestellt";
      if (filter === "ueberfaellig") return rechnungUeberfaellig(r);
      if (filter === "bezahlt") return r.status === "bezahlt";
      return true;
    })
    .filter((r) => {
      if (!suche) return true;
      // Gesucht wird nach dem, was auf dem Zettel steht: Nummer, Projekt,
      // Kunde. Ein Handwerker sucht "Becker", nicht "RE-2026-0007".
      const heuhaufen = [
        r.nummer,
        r.titel,
        r.kunde_id ? kundenName.get(r.kunde_id) : "",
      ]
        .join(" ")
        .toLowerCase();
      return suche.split(/\s+/).every((wort) => heuhaufen.includes(wort));
    });

  const anzahl = anzahlAusParameter(n);
  const sichtbar = liste.slice(0, anzahl);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-[28px] leading-none">Rechnungen</h1>
        <p className="mt-1.5 text-sm text-text-leise">
          Entstehen aus angenommenen Angeboten.
        </p>
      </header>

      {alle.length > 0 ? (
        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-karte bg-flaeche p-4 shadow-karte">
            <p className="text-sm text-text-leise">Offen</p>
            <p className="zahl mt-1 text-xl font-semibold">{formatEuro(offenSumme)}</p>
            <p className="mt-0.5 text-xs text-text-leise">
              <span className="zahl">{offen.length}</span>{" "}
              {offen.length === 1 ? "Rechnung" : "Rechnungen"}
            </p>
          </div>
          {/* Die Überfällig-Kachel ist ein Link: wer sie anschaut, will als
              nächstes genau diese Rechnungen sehen. */}
          <Link
            href={ueberfaellig.length > 0 ? "/rechnungen?f=ueberfaellig" : "/rechnungen"}
            scroll={false}
            className={`block rounded-karte p-4 shadow-karte transition-colors ${
              ueberfaellig.length > 0
                ? "bg-warnung-flaeche active:bg-warnung-flaeche/70"
                : "bg-flaeche active:bg-papier"
            }`}
          >
            <p
              className={`text-sm ${ueberfaellig.length > 0 ? "text-warnung" : "text-text-leise"}`}
            >
              Überfällig
            </p>
            <p
              className={`zahl mt-1 text-xl font-semibold ${
                ueberfaellig.length > 0 ? "text-warnung" : "text-text"
              }`}
            >
              {formatEuro(ueberfaelligSumme)}
            </p>
            <p
              className={`mt-0.5 text-xs ${ueberfaellig.length > 0 ? "text-warnung" : "text-text-leise"}`}
            >
              {ueberfaellig.length > 0 ? "Zahlungsziel überschritten" : "alles im Plan"}
            </p>
          </Link>
        </section>
      ) : null}

      {/* Suche und Filter -----------------------------------------------------
          Erst ab ein paar Rechnungen: vorher ist die Liste kürzer als das
          Suchfeld hoch. */}
      {alle.length > 5 ? (
        <div className="flex flex-col gap-3">
          <form className="relative">
            {/* Filter mitschicken, sonst springt die Suche auf "Alle" zurück. */}
            {filter !== "alle" ? <input type="hidden" name="f" value={filter} /> : null}
            <IconSuche className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-leise" />
            <input
              type="search"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Kunde, Projekt, Nummer…"
              aria-label="Rechnungen durchsuchen"
              className="min-h-11 w-full rounded-feld border border-linie bg-flaeche py-2 pl-11 pr-3 text-base text-text transition-colors placeholder:text-text-leise/60 focus:border-text focus:outline-none"
            />
          </form>

          <Filterleiste>
            {(Object.keys(FILTER) as Filter[]).map((wert) => {
              const aktiv = wert === filter;
              const parameter = new URLSearchParams();
              if (q) parameter.set("q", q);
              if (wert !== "alle") parameter.set("f", wert);
              const ziel = parameter.toString() ? `?${parameter.toString()}` : "/rechnungen";
              return (
                <Link
                  key={wert}
                  href={ziel}
                  scroll={false}
                  aria-current={aktiv ? "true" : undefined}
                  className={[
                    "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    aktiv
                      ? "border-tief bg-tief text-text-invers"
                      : "border-linie bg-flaeche text-text-leise active:bg-papier",
                  ].join(" ")}
                >
                  {FILTER[wert]}
                  {wert === "ueberfaellig" && ueberfaellig.length > 0 ? (
                    <span className="zahl ml-1.5">{ueberfaellig.length}</span>
                  ) : null}
                </Link>
              );
            })}
          </Filterleiste>
        </div>
      ) : null}

      {alle.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            Noch keine Rechnungen
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            Sobald ein Angebot angenommen ist, machst du daraus mit einem Tipp
            eine Rechnung.
          </p>
          <Link
            href="/angebote"
            className="mt-4 inline-block text-sm font-medium text-akzent underline underline-offset-2"
          >
            Zu den Angeboten
          </Link>
        </div>
      ) : liste.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            Nichts gefunden
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            {suche ? "Andere Suche probieren?" : "In diesem Filter liegt nichts."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {sichtbar.map((r) => (
            <li key={r.id} className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
              <Link
                href={`/rechnungen/${r.id}`}
                className="flex min-h-14 items-center gap-3 p-4 transition-colors active:bg-papier"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-text">
                    {r.kunde_id ? kundenName.get(r.kunde_id) : r.titel || "Ohne Kunde"}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-text-leise">
                    {r.titel || "Ohne Titel"}
                  </span>
                  <span className="zahl mt-1 block text-xs text-text-leise">
                    {r.nummer} · {formatDatum(r.datum)}
                    {r.status === "gestellt" && r.faellig_am
                      ? ` · fällig ${formatDatum(r.faellig_am)}`
                      : ""}
                    {/* Wer schon erinnert wurde, soll nicht zweimal aus
                        Versehen die gleiche Mail bekommen. */}
                    {r.mahnungen > 0 && r.gemahnt_am
                      ? ` · erinnert ${formatDatum(r.gemahnt_am.slice(0, 10))}`
                      : ""}
                  </span>
                </span>

                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="zahl whitespace-nowrap text-[15px] font-medium">
                    {formatEuro(r.brutto)}
                  </span>
                  <Plakette ton={ton(r)}>
                    {rechnungUeberfaellig(r)
                      ? "Überfällig"
                      : RECHNUNG_STATUS_LABEL[r.status]}
                  </Plakette>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <MehrAnzeigen
        gezeigt={sichtbar.length}
        gesamt={liste.length}
        parameter={{ q, f: filter === "alle" ? undefined : filter }}
      />
    </div>
  );
}

function ton(r: Rechnung) {
  if (rechnungUeberfaellig(r)) return "warnung" as const;
  const nach: Record<RechnungStatus, "neutral" | "erfolg" | "warnung" | "info"> = {
    entwurf: "neutral",
    gestellt: "info",
    bezahlt: "erfolg",
    storniert: "warnung",
  };
  return nach[r.status];
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
