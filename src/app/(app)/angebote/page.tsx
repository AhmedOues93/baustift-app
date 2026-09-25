import Link from "next/link";
import { redirect } from "next/navigation";

import { Plakette } from "@/components/ui/field";
import { MehrAnzeigen, anzahlAusParameter } from "@/components/ui/mehr";
import { Filterleiste } from "@/components/ui/filterleiste";
import { NACHFASSEN_NACH_TAGEN, istNachfassFaellig } from "@/lib/angebot";
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

/**
 * Obergrenze für einen Seitenaufruf. Die Kennzahlen oben rechnen über diese
 * Menge — bis dahin stimmen sie auf die Zeile genau. Wer mehr als 500
 * Angebote hat, sucht ohnehin, statt zu scrollen.
 */
const OBERGRENZE = 500;

/** Die Filter über der Liste. */
const FILTER = {
  alle: "Alle",
  entwurf: "Entwurf",
  offen: "Verschickt",
  nachfassen: "Nachfassen",
  angenommen: "Angenommen",
} as const;
type Filter = keyof typeof FILTER;

export default async function AngebotePage({
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

  const [{ data: angebote }, { data: kunden }, { data: profil }] = await Promise.all([
    supabase
      .from("angebote")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(OBERGRENZE),
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
  const suche = (q ?? "").trim().toLowerCase();
  const filter: Filter = f && f in FILTER ? (f as Filter) : "alle";

  const liste = alle
    .filter((a) => {
      if (filter === "entwurf") return a.status === "entwurf";
      if (filter === "offen") return a.status === "gesendet";
      if (filter === "nachfassen") return istNachfassFaellig(a);
      if (filter === "angenommen") return a.status === "angenommen";
      return true;
    })
    .filter((a) =>
      suche
        ? [a.nummer, a.titel, a.kunde_id ? kundenName.get(a.kunde_id) : ""]
            .join(" ")
            .toLowerCase()
            .includes(suche)
        : true,
    );

  // Angezeigt wird erst ein Teil; der Rest kommt über "Weitere anzeigen".
  const anzahl = anzahlAusParameter(n);
  const sichtbar = liste.slice(0, anzahl);

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

      {/* Solange noch kein Angebot existiert, ist die Hauptaktion bewusst
          quadratisch und mittig. Sobald Arbeit vorhanden ist, wird sie kompakt
          und macht der Liste Platz. */}
      <Link
        href="/angebote/neu"
        className={[
          "relative mx-auto overflow-hidden bg-tief text-text-invers transition-all duration-500 active:bg-text",
          alle.length === 0
            ? "flex aspect-square w-full max-w-[22rem] flex-col items-center justify-center rounded-[2rem] p-8 text-center shadow-schwebend"
            : "flex w-full items-center gap-4 rounded-tafel p-5",
        ].join(" ")}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.08]">
          <span className="absolute -left-2 top-7 rotate-[-18deg] text-6xl">🔨</span>
          <span className="absolute right-5 top-5 rotate-12 text-5xl">🔧</span>
          <span className="absolute bottom-6 left-6 rotate-12 text-5xl">📐</span>
          <span className="absolute -bottom-2 right-7 rotate-[-12deg] text-6xl">🪛</span>
        </span>
        <span
          className={[
            "relative z-10 flex shrink-0 items-center justify-center rounded-full bg-akzent",
            alle.length === 0 ? "mb-5 h-20 w-20" : "h-12 w-12",
          ].join(" ")}
        >
          <IconMikrofon className={alle.length === 0 ? "h-9 w-9" : "h-6 w-6"} />
        </span>
        <span className="relative z-10">
          <span className={["block font-titel font-bold tracking-tight", alle.length === 0 ? "text-2xl" : "text-lg"].join(" ")}>
            Neues Angebot
          </span>
          <span className={["block text-text-invers/70", alle.length === 0 ? "mt-2 text-base" : "text-sm"].join(" ")}>
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
            <Link
              href="/angebote?f=nachfassen"
              scroll={false}
              className="col-span-2 lg:col-span-1"
            >
              <Kennzahl
                titel="Nachfassen"
                wert={String(faellig.length)}
                fuss={`seit über ${NACHFASSEN_NACH_TAGEN} Tagen ohne Antwort`}
                ton="warnung"
              />
            </Link>
          ) : null}
        </section>
      ) : null}

      {/* Suche als echtes Formular: funktioniert auch ohne JavaScript und
          überlebt einen Reload auf der Baustelle. */}
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
              aria-label="Angebote durchsuchen"
              className="min-h-11 w-full rounded-feld border border-linie bg-flaeche py-2 pl-11 pr-3 text-base text-text transition-colors placeholder:text-text-leise/60 focus:border-text focus:outline-none"
            />
          </form>

          <Filterleiste>
            {(Object.keys(FILTER) as Filter[]).map((wert) => {
              const aktiv = wert === filter;
              const parameter = new URLSearchParams();
              if (q) parameter.set("q", q);
              if (wert !== "alle") parameter.set("f", wert);
              const ziel = parameter.toString() ? `?${parameter.toString()}` : "/angebote";
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
                  {wert === "nachfassen" && faellig.length > 0 ? (
                    <span className="zahl ml-1.5">{faellig.length}</span>
                  ) : null}
                </Link>
              );
            })}
          </Filterleiste>
        </div>
      ) : null}

      {liste.length === 0 ? (
        alle.length === 0 ? null : (
          <div className="rounded-karte border border-dashed border-linie p-8 text-center">
            <p className="font-titel text-lg font-bold tracking-tight text-text">
              Nichts gefunden
            </p>
            <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
              {suche ? "Andere Suche probieren?" : "In diesem Filter liegt nichts."}
            </p>
          </div>
        )
      ) : (
        <ul className="flex flex-col gap-2 pb-4">
          {sichtbar.map((a) => (
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

      <MehrAnzeigen
        gezeigt={sichtbar.length}
        gesamt={liste.length}
        parameter={{ q, f: filter === "alle" ? undefined : filter }}
      />
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
