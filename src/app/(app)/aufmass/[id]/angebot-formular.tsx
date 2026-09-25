"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { angebotAusAufmass } from "../actions";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { gruppenName, gruppiere } from "@/lib/aufmass/gruppen";
import { formatEuro } from "@/lib/format";
import {
  EINHEIT_LABEL,
  type AufmassPosition,
  type PreislisteEintrag,
} from "@/types/database";

/**
 * Vom Aufmass zum Angebot.
 *
 * Hier wird die eine Frage gestellt, die das Aufmass nicht beantworten kann:
 * WAS wird auf diesen Flächen gemacht? 42 m² Wand können Fliesen sein, Putz
 * oder Farbe — das weiss nur der Handwerker. Zu raten wäre die Sorte
 * Bequemlichkeit, die ein falsches Angebot erzeugt.
 *
 * Die Auswahl je Gruppe ist deshalb auf die passende Einheit gefiltert: zu
 * Quadratmetern werden nur Leistungen angeboten, die in Quadratmetern
 * abgerechnet werden. Das halbiert die Liste und schliesst den Fehler aus,
 * 42 m² mit einem Stundensatz zu multiplizieren.
 */
export function AngebotAusAufmass({
  aufmassId,
  angebotId,
  messungen,
  preisliste,
}: {
  aufmassId: string;
  angebotId: string | null;
  messungen: AufmassPosition[];
  preisliste: PreislisteEintrag[];
}) {
  const router = useRouter();
  const [zuordnung, setZuordnung] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, starten] = useTransition();

  const gruppen = gruppiere(messungen);

  // Schon erstellt: dann führt hier nur noch der Weg dorthin.
  if (angebotId) {
    return (
      <section className="rounded-karte bg-erfolg-flaeche p-4">
        <p className="font-medium text-erfolg">Angebot erstellt</p>
        <p className="mt-1 text-sm text-erfolg">
          Die Masse sind übernommen. Preise und Text änderst du im Angebot.
        </p>
        <Link href={`/angebote/${angebotId}`} className="mt-3 block">
          <Button variante="primaer" vollbreit>
            Zum Angebot
          </Button>
        </Link>
      </section>
    );
  }

  if (gruppen.length === 0) return null;

  function erstellen() {
    starten(async () => {
      const ergebnis = await angebotAusAufmass(aufmassId, zuordnung);
      if (ergebnis.fehler) {
        setFehler(ergebnis.fehler);
        return;
      }
      if (ergebnis.angebotId) router.push(`/angebote/${ergebnis.angebotId}`);
    });
  }

  return (
    <section className="flex flex-col gap-3 rounded-karte bg-flaeche p-4 shadow-karte">
      <div>
        <h2 className="font-titel text-lg font-bold tracking-tight text-text">
          Angebot daraus machen
        </h2>
        <p className="mt-1 text-sm text-text-leise">
          Welche Leistung gehört zu welcher Menge? Was du offen lässt, kommt
          ohne Preis ins Angebot und wird dort markiert.
        </p>
      </div>

      {gruppen.map((g) => {
        // Nur Leistungen mit passender Einheit: 42 m² mit einem Stundensatz
        // zu multiplizieren ist ein Fehler, den man nicht anbieten muss.
        const passend = preisliste.filter((p) => p.einheit === g.einheit);
        const gewaehlt = zuordnung[g.id]
          ? preisliste.find((p) => p.id === zuordnung[g.id])
          : undefined;

        return (
          <div key={g.id} className="flex flex-col gap-2 border-t border-linie pt-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate font-medium text-text">
                {gruppenName(g)}
              </span>
              <span className="zahl shrink-0 font-medium">
                {g.menge.toFixed(2).replace(".", ",")} {EINHEIT_LABEL[g.einheit]}
              </span>
            </div>

            <p className="zahl text-xs text-text-leise">{g.einzelheiten}</p>

            {passend.length === 0 ? (
              <p className="text-sm text-text-leise">
                Keine Leistung in {EINHEIT_LABEL[g.einheit]} in deiner
                Preisliste — kommt ohne Preis ins Angebot.
              </p>
            ) : (
              <select
                value={zuordnung[g.id] ?? ""}
                onChange={(e) =>
                  setZuordnung((alt) => ({ ...alt, [g.id]: e.target.value }))
                }
                aria-label={`Leistung für ${gruppenName(g)}`}
                className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
              >
                <option value="">Ohne Preis — im Angebot festlegen</option>
                {passend.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bezeichnung} · {formatEuro(p.einzelpreis)}
                  </option>
                ))}
              </select>
            )}

            {gewaehlt ? (
              <p className="zahl text-sm text-text-leise">
                {g.menge.toFixed(2).replace(".", ",")} ×{" "}
                {formatEuro(gewaehlt.einzelpreis)} ={" "}
                <span className="font-medium text-text">
                  {formatEuro(g.menge * gewaehlt.einzelpreis)}
                </span>
              </p>
            ) : null}
          </div>
        );
      })}

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}

      <Button variante="akzent" vollbreit disabled={pending} onClick={erstellen}>
        {pending ? "Einen Moment…" : "Angebot erstellen"}
      </Button>
    </section>
  );
}
