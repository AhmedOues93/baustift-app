"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { angebotSpeichern, statusSetzen, type PositionEingabe } from "./actions";
import { Button } from "@/components/ui/button";
import { Plakette } from "@/components/ui/field";
import { IconPdf, IconPlus, IconSenden } from "@/components/ui/icons";
import { formatEuro, formatPreisEingabe, parsePreis } from "@/lib/format";
import {
  ANGEBOT_STATUS_LABEL,
  EINHEIT_LABEL,
  type Angebot,
  type AngebotStatus,
  type Einheit,
  type Kunde,
  type Position,
} from "@/types/database";

type Zeile = PositionEingabe & {
  /** Nur im Browser: stabiler React-Key, auch bevor die Zeile eine id hat. */
  key: string;
};

const SPEICHER_VERZOEGERUNG_MS = 900;

/**
 * Prüf- und Bearbeitungsbildschirm.
 *
 * Das ist der Moment der Wahrheit: die KI hat etwas vorgeschlagen, jetzt
 * entscheidet der Handwerker. Drei Dinge waren dafür ausschlaggebend:
 *
 *  1. AUTOMATISCH SPEICHERN. Auf der Baustelle klingelt das Telefon mitten im
 *     Tippen. Ein "Speichern"-Knopf, den man dann nicht mehr drückt, kostet
 *     die ganze Arbeit. Gespeichert wird knapp eine Sekunde nach der letzten
 *     Eingabe, der Zustand steht sichtbar im Kopf.
 *  2. "ZU PRÜFEN" IST NICHT ROT. Es ist kein Fehler, sondern eine offene
 *     Frage — die Zeile wird markiert und oben gezählt, aber nichts blinkt.
 *  3. SUMMEN SOFORT. Gerechnet wird lokal beim Tippen; verbindlich ist dann
 *     das Ergebnis aus der Datenbank, das beim Speichern zurückkommt.
 */
export function AngebotEditor({
  angebot,
  positionen,
  kunden,
}: {
  angebot: Angebot;
  positionen: Position[];
  kunden: Kunde[];
}) {
  const router = useRouter();

  const [titel, setTitel] = useState(angebot.titel);
  const [kundeId, setKundeId] = useState(angebot.kunde_id ?? "");
  const [notiz, setNotiz] = useState(angebot.notiz ?? "");
  const [zeilen, setZeilen] = useState<Zeile[]>(() =>
    positionen.map((p) => ({
      key: p.id,
      id: p.id,
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
      preisliste_id: p.preisliste_id,
      zu_pruefen: p.zu_pruefen,
    })),
  );

  const [zustand, setZustand] = useState<"rein" | "offen" | "speichert" | "fehler">(
    "rein",
  );
  const [statusPending, statusStarten] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Beim ersten Rendern nicht speichern — sonst schreibt jedes Öffnen.
  const ersterLauf = useRef(true);

  const netto = zeilen.reduce(
    (summe, z) => summe + runde(z.menge * z.einzelpreis),
    0,
  );
  const mwst = runde((netto * angebot.mwst_satz) / 100);
  const brutto = runde(netto + mwst);
  const offeneFragen = zeilen.filter((z) => z.zu_pruefen).length;

  const speichern = useCallback(async () => {
    setZustand("speichert");
    const ergebnis = await angebotSpeichern({
      angebotId: angebot.id,
      titel,
      kundeId: kundeId || null,
      notiz,
      positionen: zeilen.map(({ key: _key, ...rest }) => rest),
    });

    if (ergebnis.fehler) {
      setZustand("fehler");
      return;
    }

    // Neue Zeilen bekommen jetzt ihre ID — sonst würde der nächste Speicherlauf
    // sie ein zweites Mal anlegen.
    if (ergebnis.positionIds) {
      setZeilen((alt) =>
        alt.map((z, i) => ({ ...z, id: ergebnis.positionIds![i] ?? z.id })),
      );
    }
    setZustand("rein");
  }, [angebot.id, titel, kundeId, notiz, zeilen]);

  // Entprelltes Speichern nach jeder Änderung.
  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    setZustand("offen");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void speichern(), SPEICHER_VERZOEGERUNG_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [titel, kundeId, notiz, zeilen, speichern]);

  // Beim Verlassen der Seite noch offene Änderungen nicht verlieren.
  useEffect(() => {
    function warnen(e: BeforeUnloadEvent) {
      if (zustand === "offen" || zustand === "speichert") e.preventDefault();
    }
    window.addEventListener("beforeunload", warnen);
    return () => window.removeEventListener("beforeunload", warnen);
  }, [zustand]);

  function aendere(key: string, teil: Partial<Zeile>) {
    setZeilen((alt) =>
      alt.map((z) =>
        z.key === key
          ? {
              ...z,
              ...teil,
              // Sobald der Mensch Hand anlegt, ist die Zeile geprüft.
              zu_pruefen: teil.zu_pruefen ?? false,
            }
          : z,
      ),
    );
  }

  function hinzufuegen() {
    setZeilen((alt) => [
      ...alt,
      {
        key: `neu-${Date.now()}`,
        bezeichnung: "",
        beschreibung: null,
        menge: 1,
        einheit: "stk",
        einzelpreis: 0,
        preisliste_id: null,
        zu_pruefen: false,
      },
    ]);
  }

  function entfernen(key: string) {
    setZeilen((alt) => alt.filter((z) => z.key !== key));
  }

  function statusAendern(status: AngebotStatus) {
    statusStarten(async () => {
      await speichern();
      await statusSetzen(angebot.id, status);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Kopf ---------------------------------------------------------------- */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="zahl text-sm text-text-leise">{angebot.nummer}</span>
          <Plakette ton={statusTon(angebot.status)}>
            {ANGEBOT_STATUS_LABEL[angebot.status]}
          </Plakette>
          <SpeicherAnzeige zustand={zustand} />
        </div>

        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          aria-label="Titel des Angebots"
          placeholder="Titel, z. B. Badsanierung Lindenstr. 12"
          // min-h-11 auch hier: der Titel sieht aus wie eine Überschrift, ist
          // aber ein Eingabefeld und muss getroffen werden können.
          className="min-h-11 w-full bg-transparent py-1 font-titel text-[26px] font-bold leading-tight tracking-tight text-text placeholder:text-text-leise/50 focus:outline-none"
        />

        <select
          value={kundeId}
          onChange={(e) => setKundeId(e.target.value)}
          aria-label="Kunde"
          className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
        >
          <option value="">Kein Kunde zugeordnet</option>
          {kunden.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.ort ? ` · ${k.ort}` : ""}
            </option>
          ))}
        </select>
      </header>

      {/* Hinweis der KI ------------------------------------------------------ */}
      {angebot.ki_hinweis ? (
        <div className="rounded-karte bg-info-flaeche p-4 text-sm text-info">
          <p className="font-medium">Anmerkung aus der Aufnahme</p>
          <p className="mt-1">{angebot.ki_hinweis}</p>
        </div>
      ) : null}

      {offeneFragen > 0 ? (
        <div className="rounded-karte bg-warnung-flaeche p-4 text-sm text-warnung">
          <span className="zahl font-medium">{offeneFragen}</span>{" "}
          {offeneFragen === 1 ? "Position braucht" : "Positionen brauchen"} noch
          deinen Preis. Sie sind unten markiert.
        </div>
      ) : null}

      {/* Positionen ---------------------------------------------------------- */}
      <section className="flex flex-col gap-2">
        {zeilen.map((z, i) => (
          <PositionsKarte
            key={z.key}
            nummer={i + 1}
            zeile={z}
            onAendern={(teil) => aendere(z.key, teil)}
            onEntfernen={() => entfernen(z.key)}
          />
        ))}

        <button
          type="button"
          onClick={hinzufuegen}
          className="flex min-h-14 items-center justify-center gap-2 rounded-karte border border-dashed border-linie text-sm font-medium text-akzent transition-colors active:bg-akzent-flaeche"
        >
          <IconPlus className="h-5 w-5" />
          Position hinzufügen
        </button>
      </section>

      {/* Summen -------------------------------------------------------------- */}
      <section className="rounded-karte bg-flaeche p-4 shadow-karte">
        <Summenzeile bezeichnung="Netto" betrag={netto} />
        {angebot.mwst_satz > 0 ? (
          <Summenzeile
            bezeichnung={`MwSt. ${formatPreisEingabe(angebot.mwst_satz).replace(",00", "")} %`}
            betrag={mwst}
          />
        ) : (
          <p className="mt-2 text-sm text-text-leise">
            Kleinunternehmer nach §19 UStG — keine Umsatzsteuer.
          </p>
        )}
        <div className="mt-3 flex items-baseline justify-between border-t border-linie pt-3">
          <span className="font-titel text-lg font-bold tracking-tight">Gesamt</span>
          <span className="zahl text-xl font-semibold">{formatEuro(brutto)}</span>
        </div>
      </section>

      {/* Schlusstext --------------------------------------------------------- */}
      <section className="flex flex-col gap-1.5">
        <label htmlFor="notiz" className="text-sm font-medium text-text-leise">
          Hinweis für den Kunden
        </label>
        <textarea
          id="notiz"
          value={notiz}
          onChange={(e) => setNotiz(e.target.value)}
          rows={3}
          placeholder="Angebot gültig 30 Tage. Ausführung ca. 5 Arbeitstage nach Materiallieferung."
          className="w-full rounded-feld border border-linie bg-flaeche p-3 text-base text-text placeholder:text-text-leise/60 focus:border-text focus:outline-none"
        />
      </section>

      {/* Aktionen ------------------------------------------------------------ */}
      <section className="flex flex-col gap-2 pb-24 lg:flex-row lg:pb-0">
        <a
          href={`/api/angebote/${angebot.id}/pdf`}
          target="_blank"
          rel="noopener"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-gross border border-linie bg-flaeche px-5 font-medium text-text transition-colors active:bg-papier"
        >
          <IconPdf className="h-5 w-5" />
          PDF öffnen
        </a>

        {angebot.status === "entwurf" ? (
          <Button
            variante="akzent"
            disabled={statusPending}
            onClick={() => statusAendern("gesendet")}
          >
            <IconSenden className="h-5 w-5" />
            Als gesendet markieren
          </Button>
        ) : (
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Button
              variante="primaer"
              className="flex-1"
              disabled={statusPending || angebot.status === "angenommen"}
              onClick={() => statusAendern("angenommen")}
            >
              Angenommen
            </Button>
            <Button
              variante="sekundaer"
              className="flex-1"
              disabled={statusPending || angebot.status === "abgelehnt"}
              onClick={() => statusAendern("abgelehnt")}
            >
              Abgelehnt
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

function PositionsKarte({
  nummer,
  zeile,
  onAendern,
  onEntfernen,
}: {
  nummer: number;
  zeile: Zeile;
  onAendern: (teil: Partial<Zeile>) => void;
  onEntfernen: () => void;
}) {
  // Preis und Menge werden als Text gehalten, damit "1," oder "8," beim Tippen
  // nicht sofort zu einer Zahl zusammenfällt und den Cursor verschiebt.
  const [preisText, setPreisText] = useState(formatPreisEingabe(zeile.einzelpreis));
  const [mengeText, setMengeText] = useState(formatMenge(zeile.menge));

  return (
    <article
      className={[
        "rounded-karte p-4 shadow-karte",
        zeile.zu_pruefen ? "bg-warnung-flaeche" : "bg-flaeche",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="zahl mt-2.5 w-5 shrink-0 text-sm text-text-leise">
          {nummer}
        </span>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <input
            value={zeile.bezeichnung}
            onChange={(e) => onAendern({ bezeichnung: e.target.value })}
            aria-label={`Leistung Position ${nummer}`}
            placeholder="Leistung"
            className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text placeholder:text-text-leise/60 focus:border-text focus:outline-none"
          />

          <div className="grid grid-cols-[4.5rem_1fr_1fr] gap-2">
            <input
              value={mengeText}
              onChange={(e) => {
                setMengeText(e.target.value);
                const wert = parsePreis(e.target.value);
                if (wert !== null) onAendern({ menge: wert });
              }}
              onBlur={() => setMengeText(formatMenge(zeile.menge))}
              inputMode="decimal"
              aria-label={`Menge Position ${nummer}`}
              className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche px-2 text-center text-base text-text focus:border-text focus:outline-none"
            />

            <select
              value={zeile.einheit}
              onChange={(e) => onAendern({ einheit: e.target.value as Einheit })}
              aria-label={`Einheit Position ${nummer}`}
              className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-2 text-base text-text focus:border-text focus:outline-none"
            >
              {(Object.keys(EINHEIT_LABEL) as Einheit[]).map((e) => (
                <option key={e} value={e}>
                  {EINHEIT_LABEL[e]}
                </option>
              ))}
            </select>

            <div className="relative">
              <input
                value={preisText}
                onChange={(e) => {
                  setPreisText(e.target.value);
                  const wert = parsePreis(e.target.value);
                  if (wert !== null) onAendern({ einzelpreis: wert });
                }}
                onBlur={() => setPreisText(formatPreisEingabe(zeile.einzelpreis))}
                inputMode="decimal"
                aria-label={`Einzelpreis Position ${nummer}`}
                className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche pl-2 pr-6 text-right text-base text-text focus:border-text focus:outline-none"
              />
              <span className="zahl pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-sm text-text-leise">
                €
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onEntfernen}
              className="min-h-11 -ml-1 px-1 text-sm font-medium text-text-leise transition-colors active:text-warnung"
            >
              Entfernen
            </button>
            <span className="zahl text-[15px] font-medium">
              {formatEuro(runde(zeile.menge * zeile.einzelpreis))}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function Summenzeile({ bezeichnung, betrag }: { bezeichnung: string; betrag: number }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className="text-text-leise">{bezeichnung}</span>
      <span className="zahl">{formatEuro(betrag)}</span>
    </div>
  );
}

function SpeicherAnzeige({
  zustand,
}: {
  zustand: "rein" | "offen" | "speichert" | "fehler";
}) {
  if (zustand === "rein") {
    return <span className="text-sm text-text-leise">Gespeichert</span>;
  }
  if (zustand === "fehler") {
    return <span className="text-sm font-medium text-warnung">Nicht gespeichert</span>;
  }
  return <span className="text-sm text-text-leise">Speichert…</span>;
}

function statusTon(status: AngebotStatus) {
  switch (status) {
    case "angenommen":
      return "erfolg" as const;
    case "nachfassen":
    case "abgelehnt":
      return "warnung" as const;
    case "gesendet":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

function runde(n: number): number {
  return Math.round(n * 100) / 100;
}

/** 8 → "8", 2.5 → "2,5" — Mengen ohne unnötige Nullen. */
function formatMenge(n: number): string {
  return String(n).replace(".", ",");
}
