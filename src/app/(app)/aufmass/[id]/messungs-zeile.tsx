"use client";

import { useState, useTransition } from "react";

import { messungLoeschen, messungSpeichern } from "../actions";
import { IconKreuz } from "@/components/ui/icons";
import { masseText, wertText } from "@/lib/aufmass/gruppen";
import {
  type AufmassPosition,
  type Einheit,
  type MessungArt,
} from "@/types/database";

/**
 * Eine Messung in der Liste — zugeklappt eine Zeile, aufgeklappt bearbeitbar.
 *
 * Zugeklappt, weil die Liste beim Messen lang wird und er nur eines wissen
 * will: stimmt der Wert. Aufgeklappt erst, wenn er etwas ändern will — und
 * das ist der eigentliche Zweck des Bildschirms, denn die Stimme versteht
 * "2,05" manchmal als "2,50".
 */

const ART_LABEL: Record<MessungArt, string> = {
  flaeche: "Fläche",
  laenge: "Länge",
  volumen: "Volumen",
  stueck: "Stück",
};

/** Welche Masse die Art braucht. */
const FELDER: Record<MessungArt, ("laenge" | "breite" | "hoehe")[]> = {
  flaeche: ["laenge", "breite"],
  volumen: ["laenge", "breite", "hoehe"],
  laenge: ["laenge"],
  stueck: [],
};

const FELD_LABEL = { laenge: "Länge", breite: "Breite", hoehe: "Höhe" } as const;

export function MessungsZeile({
  messung,
  gesperrt,
  offen,
  setOffen,
  onEntfernt,
}: {
  messung: AufmassPosition;
  gesperrt: boolean;
  /**
   * Offen/zu wird von aussen gesteuert, damit immer nur eine Zeile offen ist
   * und die klebende Aufnahmeleiste sich so lange wegnehmen kann. Sonst liegt
   * sie über den Eingabefeldern — ausgerechnet über "Übernehmen".
   */
  offen: boolean;
  setOffen: (offen: boolean) => void;
  onEntfernt: (id: string) => void;
}) {
  const [pending, starten] = useTransition();

  const [raum, setRaum] = useState(messung.raum ?? "");
  const [bezeichnung, setBezeichnung] = useState(messung.bezeichnung);
  const [art, setArt] = useState<MessungArt>(messung.art);
  const [laenge, setLaenge] = useState(text(messung.laenge));
  const [breite, setBreite] = useState(text(messung.breite));
  const [hoehe, setHoehe] = useState(text(messung.hoehe));
  const [anzahl, setAnzahl] = useState(text(messung.anzahl));
  const [abzug, setAbzug] = useState(messung.abzug);

  // Wert und Einheit kommen nach dem Speichern aus der Datenbank zurück:
  // gerechnet wird dort, damit Liste und Angebot nie auseinanderlaufen.
  const [wert, setWert] = useState<number | null>(messung.wert);
  const [einheit, setEinheit] = useState<Einheit>(messung.einheit);
  const [zuPruefen, setZuPruefen] = useState(messung.zu_pruefen);
  const [fehler, setFehler] = useState<string | null>(null);

  function speichern() {
    starten(async () => {
      const ergebnis = await messungSpeichern({
        messungId: messung.id,
        raum: raum || null,
        bezeichnung,
        art,
        laenge: zahl(laenge),
        breite: zahl(breite),
        hoehe: zahl(hoehe),
        anzahl: zahl(anzahl) ?? 1,
        abzug,
      });
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler);
        return;
      }
      setFehler(null);
      setWert(ergebnis.wert ?? null);
      if (ergebnis.einheit) setEinheit(ergebnis.einheit);
      setZuPruefen(false);
      setOffen(false);
    });
  }

  function entfernen() {
    starten(async () => {
      const ergebnis = await messungLoeschen(messung.id);
      if (ergebnis.fehler) setFehler(ergebnis.fehler);
      else onEntfernt(messung.id);
    });
  }

  const vorschau = masseText({
    ...messung,
    art,
    laenge: zahl(laenge),
    breite: zahl(breite),
    hoehe: zahl(hoehe),
    anzahl: zahl(anzahl) ?? 1,
  });

  return (
    <li
      className={[
        "overflow-hidden rounded-karte shadow-karte",
        zuPruefen ? "bg-warnung-flaeche" : "bg-flaeche",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setOffen(!offen)}
        aria-expanded={offen}
        className="flex min-h-14 w-full items-center gap-3 p-4 text-left transition-colors active:bg-papier"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-text">
            {abzug ? "− " : ""}
            {bezeichnung || "Ohne Bezeichnung"}
            {raum ? <span className="text-text-leise"> · {raum}</span> : null}
          </span>
          <span className="zahl mt-0.5 block truncate text-sm text-text-leise">
            {vorschau || "kein Mass"}
          </span>
        </span>
        <span
          className={[
            "zahl shrink-0 whitespace-nowrap text-[15px] font-medium",
            zuPruefen ? "text-warnung" : "text-text",
          ].join(" ")}
        >
          {wertText({ wert, einheit })}
        </span>
      </button>

      {offen ? (
        <div className="flex flex-col gap-3 border-t border-linie p-4">
          {messung.gesprochen ? (
            // Der Wortlaut bleibt stehen: wer "2,50" gesagt hat und 250
            // sieht, soll nachvollziehen können, woran es lag.
            <p className="rounded-feld bg-papier p-2.5 text-sm italic text-text-leise">
              „{messung.gesprochen}“
            </p>
          ) : null}

          <div className="flex gap-2">
            <Feld label="Raum" wert={raum} setzen={setRaum} platzhalter="Bad" />
            <Feld
              label="Bezeichnung"
              wert={bezeichnung}
              setzen={setBezeichnung}
              platzhalter="Wand 1"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-leise">Art</span>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(ART_LABEL) as MessungArt[]).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => setArt(a)}
                  aria-pressed={a === art}
                  className={[
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors",
                    a === art
                      ? "border-tief bg-tief text-text-invers"
                      : "border-linie bg-flaeche text-text-leise active:bg-papier",
                  ].join(" ")}
                >
                  {ART_LABEL[a]}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            {FELDER[art].map((feld) => (
              <Feld
                key={feld}
                label={`${FELD_LABEL[feld]} (m)`}
                wert={feld === "laenge" ? laenge : feld === "breite" ? breite : hoehe}
                setzen={
                  feld === "laenge" ? setLaenge : feld === "breite" ? setBreite : setHoehe
                }
                zahlTastatur
                platzhalter="2,50"
              />
            ))}
            <Feld
              label={art === "stueck" ? "Stück" : "Anzahl"}
              wert={anzahl}
              setzen={setAnzahl}
              zahlTastatur
              platzhalter="1"
            />
          </div>

          <label className="flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={abzug}
              onChange={(e) => setAbzug(e.target.checked)}
              className="h-5 w-5 rounded border-linie accent-akzent"
            />
            <span className="text-base text-text">
              Abzug (Fenster, Tür) — wird abgezogen
            </span>
          </label>

          {fehler ? (
            <p className="rounded-feld bg-warnung-flaeche p-2.5 text-sm text-warnung">
              {fehler}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={speichern}
              disabled={pending || gesperrt}
              className="min-h-11 flex-1 rounded-gross bg-tief px-4 font-medium text-text-invers transition-colors active:bg-text disabled:opacity-50"
            >
              {pending ? "Einen Moment…" : "Übernehmen"}
            </button>
            <button
              type="button"
              onClick={entfernen}
              disabled={pending || gesperrt}
              aria-label="Messung löschen"
              className="inline-flex min-h-11 items-center justify-center rounded-gross border border-linie px-4 text-text-leise transition-colors active:bg-papier disabled:opacity-50"
            >
              <IconKreuz className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------------- */

function Feld({
  label,
  wert,
  setzen,
  platzhalter,
  zahlTastatur = false,
}: {
  label: string;
  wert: string;
  setzen: (w: string) => void;
  platzhalter?: string;
  zahlTastatur?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="text-sm font-medium text-text-leise">{label}</span>
      <input
        value={wert}
        onChange={(e) => setzen(e.target.value)}
        placeholder={platzhalter}
        // Auf dem Handy die Zifferntastatur, aber als Text: `type="number"`
        // verschluckt in manchen Browsern das Komma, und deutsche Masse
        // werden mit Komma gesprochen und geschrieben.
        inputMode={zahlTastatur ? "decimal" : undefined}
        className={[
          "min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text",
          "placeholder:text-text-leise/60 focus:border-text focus:outline-none",
          zahlTastatur ? "zahl" : "",
        ].join(" ")}
      />
    </label>
  );
}

/** "2,50" → 2.5; leeres Feld → null. */
function zahl(roh: string): number | null {
  const sauber = roh.trim().replace(",", ".");
  if (!sauber) return null;
  const wert = Number(sauber);
  return Number.isFinite(wert) ? wert : null;
}

/** Umgekehrt, fürs Formular: 2.5 → "2,5". */
function text(wert: number | null): string {
  if (wert === null || wert === undefined) return "";
  return String(wert).replace(".", ",");
}
