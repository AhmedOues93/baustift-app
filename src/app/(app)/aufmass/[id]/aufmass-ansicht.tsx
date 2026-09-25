"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { MessungsZeile } from "./messungs-zeile";
import {
  aufmassAbschliessen,
  aufmassKopfSpeichern,
  aufmassOeffnen,
  messungAnlegen,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { IconMikrofon, IconPlus, IconStopp } from "@/components/ui/icons";
import { endung, useAufnahme } from "@/components/use-aufnahme";
import { gruppenName, gruppiere } from "@/lib/aufmass/gruppen";
import { EINHEIT_LABEL, type Aufmass, type AufmassPosition, type Kunde } from "@/types/database";

/**
 * =============================================================================
 * Der Aufmass-Bildschirm
 * =============================================================================
 * Eine Session, viele kurze Aufnahmen. Der Handwerker tippt auf das Mikrofon,
 * sagt "Wand 1: 5 Meter mal 2,50 Meter", tippt wieder — und das Mass steht in
 * der Liste, bevor er den Zollstock zusammengeklappt hat.
 *
 * DREI DINGE WAREN DAFÜR AUSSCHLAGGEBEND:
 *
 *  1. NICHTS LÄUFT IN DER PAUSE. Zwischen zwei Massen liegen manchmal fünf
 *     Minuten — Zollstock anlegen, Leiter versetzen, Telefonat. Eine
 *     durchlaufende Aufnahme würde das Telefon warmlaufen lassen und beim
 *     Sperren des Bildschirms abbrechen. Hier läuft in der Pause gar nichts;
 *     die Session ist eine Zeile in der Datenbank.
 *  2. JEDES MASS SOFORT SICHTBAR. Wer "zwei Komma null fünf" sagt und
 *     "2,50" liest, korrigiert es in dem Moment, in dem er noch weiss, was
 *     er gemessen hat. Am Ende weiss das niemand mehr.
 *  3. DER KNOPF BLEIBT, WO ER IST. Er klebt unten über der Tab-Leiste und
 *     wandert nicht mit der Liste weg. Nach dem zwanzigsten Mass wäre das
 *     sonst eine Scrollstrecke pro Messung.
 */

export function AufmassAnsicht({
  aufmass,
  messungen: anfang,
  kunden,
}: {
  aufmass: Aufmass;
  messungen: AufmassPosition[];
  kunden: Kunde[];
}) {
  const router = useRouter();

  const [messungen, setMessungen] = useState(anfang);
  const [titel, setTitel] = useState(aufmass.titel);
  const [kundeId, setKundeId] = useState(aufmass.kunde_id ?? "");
  // Welche Zeile gerade bearbeitet wird. Immer höchstens eine: auf 390px
  // sind zwei offene Formulare untereinander nicht zu bedienen.
  const [offeneZeile, setOffeneZeile] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<
    { art: "fehler" | "erfolg"; text: string } | null
  >(null);
  const [pending, starten] = useTransition();

  const gesperrt = aufmass.status === "abgeschlossen";

  const aufnahme = useAufnahme({
    async onFertig(audio) {
      const formData = new FormData();
      formData.set("audio", audio, `messung.${endung(audio.type)}`);

      try {
        const antwort = await fetch(`/api/aufmass/${aufmass.id}/messung`, {
          method: "POST",
          body: formData,
        });
        const ergebnis = await antwort.json();

        if (!antwort.ok) {
          setMeldung({ art: "fehler", text: ergebnis.fehler ?? "Das hat nicht geklappt." });
          return;
        }

        setMeldung(null);
        setMessungen((alt) => [...alt, ergebnis.messung]);
      } catch {
        setMeldung({
          art: "fehler",
          text: "Keine Verbindung. Das Mass ist nicht angekommen — nochmal.",
        });
      }
    },
  });

  function kopfSpeichern() {
    starten(async () => {
      await aufmassKopfSpeichern({
        aufmassId: aufmass.id,
        titel,
        kundeId: kundeId || null,
        notiz: aufmass.notiz,
      });
    });
  }

  function zeileHinzufuegen() {
    starten(async () => {
      const ergebnis = await messungAnlegen(aufmass.id);
      if (ergebnis.messung) setMessungen((alt) => [...alt, ergebnis.messung!]);
      else setMeldung({ art: "fehler", text: ergebnis.fehler ?? "Ging nicht." });
    });
  }

  function abschliessen() {
    starten(async () => {
      const ergebnis = await aufmassAbschliessen(aufmass.id);
      if (ergebnis.fehler) setMeldung({ art: "fehler", text: ergebnis.fehler });
      else router.refresh();
    });
  }

  function wiederOeffnen() {
    starten(async () => {
      await aufmassOeffnen(aufmass.id);
      router.refresh();
    });
  }

  const gruppen = gruppiere(messungen);
  const offeneFragen = messungen.filter((m) => m.zu_pruefen).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Kopf ---------------------------------------------------------------- */}
      <header className="flex flex-col gap-3">
        <input
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          onBlur={kopfSpeichern}
          disabled={gesperrt}
          aria-label="Titel des Aufmasses"
          placeholder="Aufmass, z. B. Bad Lindenstr. 12"
          className="min-h-11 w-full bg-transparent py-1 font-titel text-[26px] font-bold leading-tight tracking-tight text-text placeholder:text-text-leise/50 focus:outline-none disabled:opacity-70"
        />

        <select
          value={kundeId}
          onChange={(e) => {
            setKundeId(e.target.value);
            starten(async () => {
              await aufmassKopfSpeichern({
                aufmassId: aufmass.id,
                titel,
                kundeId: e.target.value || null,
                notiz: aufmass.notiz,
              });
            });
          }}
          disabled={gesperrt}
          aria-label="Kunde"
          className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none disabled:opacity-70"
        >
          <option value="">Ohne Kunde (später zuordnen)</option>
          {kunden.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name}
              {k.ort ? ` · ${k.ort}` : ""}
            </option>
          ))}
        </select>
      </header>

      {/* Summen — der Grund, warum überhaupt gemessen wird ------------------- */}
      {gruppen.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-karte bg-flaeche p-4 shadow-karte">
          <h2 className="font-titel text-base font-bold tracking-tight text-text">
            Zusammengerechnet
          </h2>
          {gruppen.map((g) => (
            <div key={g.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-leise">
                {/* Name statt nur Raum: sonst stehen "Bad" und "Bad"
                    untereinander und man sieht nicht, welche Zeile die
                    Fläche ist und welche die laufenden Meter. */}
                {gruppenName(g)}
                <span className="text-text-leise/60">
                  {" "}
                  · <span className="zahl">{g.anzahlMessungen}</span>{" "}
                  {g.anzahlMessungen === 1 ? "Messung" : "Messungen"}
                </span>
              </span>
              <span className="zahl shrink-0 font-medium">
                {g.menge.toFixed(2).replace(".", ",")} {EINHEIT_LABEL[g.einheit]}
              </span>
            </div>
          ))}
        </section>
      ) : null}

      {offeneFragen > 0 ? (
        <p className="rounded-feld bg-warnung-flaeche px-3 py-2.5 text-sm text-warnung">
          <span className="zahl">{offeneFragen}</span>{" "}
          {offeneFragen === 1 ? "Messung ist" : "Messungen sind"} zu prüfen — antippen
          und nachbessern.
        </p>
      ) : null}

      {meldung ? <Meldung art={meldung.art}>{meldung.text}</Meldung> : null}
      {aufnahme.fehler ? <Meldung art="fehler">{aufnahme.fehler}</Meldung> : null}

      {/* Die Messungen ------------------------------------------------------- */}
      {messungen.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            Noch nichts gemessen
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            Tipp auf das Mikrofon und sprich ein Mass: „Bad Wand 1: 5 Meter mal
            2,50 Meter“. Danach misst du weiter — die Aufnahme läuft nicht mit.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {messungen.map((m) => (
            <MessungsZeile
              key={m.id}
              messung={m}
              gesperrt={gesperrt}
              offen={offeneZeile === m.id}
              setOffen={(auf) => setOffeneZeile(auf ? m.id : null)}
              onEntfernt={(id) => {
                setMessungen((alt) => alt.filter((x) => x.id !== id));
                setOffeneZeile(null);
              }}
            />
          ))}
        </ul>
      )}

      {!gesperrt ? (
        <button
          type="button"
          onClick={zeileHinzufuegen}
          disabled={pending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-karte border border-dashed border-linie px-4 font-medium text-akzent transition-colors active:bg-flaeche disabled:opacity-50"
        >
          <IconPlus className="h-5 w-5" />
          Mass eintippen
        </button>
      ) : null}

      {/* Aufnahme und Abschluss ---------------------------------------------
          Klebt über der Tab-Leiste: nach zwanzig Messungen wäre ein Knopf am
          Listenende eine Scrollstrecke pro Mass. */}
      {/* Während eine Zeile bearbeitet wird, verschwindet die Leiste: sonst
          liegt sie über den Eingabefeldern, und aufnehmen will in diesem
          Moment ohnehin niemand. */}
      <div
        className={[
          "sticky bottom-[calc(theme(spacing.navleiste)+env(safe-area-inset-bottom))] z-30 -mx-4 flex-col gap-2 border-t border-linie bg-papier/95 px-4 py-3 backdrop-blur",
          "lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:backdrop-blur-none",
          offeneZeile ? "hidden lg:flex" : "flex",
        ].join(" ")}
      >
        {gesperrt ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variante="sekundaer"
              className="flex-1"
              disabled={pending}
              onClick={wiederOeffnen}
            >
              Wieder öffnen
            </Button>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={aufnahme.umschalten}
              disabled={aufnahme.arbeitet}
              className={[
                "flex min-h-14 w-full items-center justify-center gap-3 rounded-gross text-lg font-medium transition-colors",
                aufnahme.laeuft
                  ? "bg-warnung text-text-invers"
                  : "bg-akzent text-text-invers active:bg-akzent-hover",
                "disabled:opacity-60",
              ].join(" ")}
            >
              {aufnahme.laeuft ? (
                <>
                  <IconStopp className="h-6 w-6" />
                  Mass fertig
                </>
              ) : aufnahme.arbeitet ? (
                "Einen Moment…"
              ) : (
                <>
                  <IconMikrofon className="h-6 w-6" />
                  Mass einsprechen
                </>
              )}
            </button>

            {messungen.length > 0 ? (
              <Button
                variante="sekundaer"
                vollbreit
                disabled={pending}
                onClick={abschliessen}
              >
                Aufmass abschliessen
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
