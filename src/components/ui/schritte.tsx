"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";

export interface Schritt {
  titel: string;
  hinweis?: string;
  inhalt: React.ReactNode;
  /**
   * Prüft die Felder dieses Schritts, bevor es weitergeht.
   * Rückgabe: Fehlertext oder null.
   */
  pruefen?: (formular: FormData) => string | null;
}

/**
 * Formulare in Schritten statt in einer langen Rolle.
 *
 * WARUM: ein Formular mit fünfzehn Feldern ist auf 390px fast drei
 * Bildschirme lang. Man scrollt, verliert den Überblick, weiss nicht, wie
 * weit man ist, und sieht den Speichern-Knopf nie. In Schritten passt jeder
 * Abschnitt auf einen Bildschirm, der Fortschritt ist sichtbar, und die
 * nächste Aktion steht immer in Daumenreichweite.
 *
 * WIE ES TECHNISCH GEHT: es bleibt EIN <form>. Die nicht aktiven Schritte
 * werden nur ausgeblendet, nicht ausgehängt — dadurch stehen beim Absenden
 * alle Felder in den FormData, und nichts geht beim Blättern verloren.
 *
 * Deshalb steht an den Feldern auch kein `required`: ein Pflichtfeld in
 * einem ausgeblendeten Schritt bricht das Absenden mit einer Fehlermeldung
 * ab, die der Browser nicht einmal anzeigen kann ("not focusable"). Geprüft
 * wird stattdessen pro Schritt über `pruefen`.
 */
export function Schritte({
  schritte,
  abschluss,
  abbrechen,
}: {
  schritte: Schritt[];
  /** Der Absende-Knopf des letzten Schritts. */
  abschluss: React.ReactNode;
  /** Optional: Abbrechen-Knopf, z. B. im Bottom Sheet. */
  abbrechen?: React.ReactNode;
}) {
  const [aktiv, setAktiv] = useState(0);
  const [fehler, setFehler] = useState<string | null>(null);
  const huelle = useRef<HTMLDivElement>(null);

  const letzter = aktiv === schritte.length - 1;

  function weiter() {
    const formular = huelle.current?.closest("form");
    const pruefen = schritte[aktiv].pruefen;

    if (formular && pruefen) {
      const meldung = pruefen(new FormData(formular));
      if (meldung) {
        setFehler(meldung);
        return;
      }
    }

    setFehler(null);
    setAktiv((s) => Math.min(s + 1, schritte.length - 1));
    // Nach oben, sonst startet der neue Schritt mitten im Bild.
    huelle.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  function zurueck() {
    setFehler(null);
    setAktiv((s) => Math.max(s - 1, 0));
    huelle.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }

  return (
    <div ref={huelle} className="flex flex-col gap-4">
      {/* Fortschritt: Balken plus Text. Der Balken allein sagt nicht, wie
          viele Schritte noch kommen — und genau das will man wissen. */}
      <div className="flex flex-col gap-2">
        <div className="flex gap-1.5" aria-hidden="true">
          {schritte.map((s, i) => (
            <span
              key={s.titel}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= aktiv ? "bg-akzent" : "bg-linie"
              }`}
            />
          ))}
        </div>
        <p className="text-sm text-text-leise">
          Schritt <span className="zahl">{aktiv + 1}</span> von{" "}
          <span className="zahl">{schritte.length}</span>
        </p>
      </div>

      <div>
        <h2 className="text-lg">{schritte[aktiv].titel}</h2>
        {schritte[aktiv].hinweis ? (
          <p className="mt-1 text-sm text-text-leise">{schritte[aktiv].hinweis}</p>
        ) : null}
      </div>

      {schritte.map((s, i) => (
        // Ausblenden statt Aushängen: die Werte bleiben im Formular stehen und
        // gehen beim Blättern nicht verloren.
        //
        // Bewusst über die Klasse und NICHT über das hidden-Attribut: Tailwind
        // setzt zwar `[hidden]{display:none}` in der Basis, aber die Utility
        // `.flex` steht später im Stylesheet und gewinnt bei gleicher
        // Spezifität. Mit hidden-Attribut wären alle Schritte sichtbar —
        // genau der Fehler, den diese Komponente beheben soll.
        <div
          key={s.titel}
          className={i === aktiv ? "flex flex-col gap-4" : "hidden"}
          aria-hidden={i !== aktiv}
        >
          {s.inhalt}
        </div>
      ))}

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}

      <div className="mt-1 flex gap-2">
        {aktiv > 0 ? (
          <Button type="button" variante="sekundaer" onClick={zurueck}>
            Zurück
          </Button>
        ) : (
          abbrechen
        )}

        {letzter ? (
          <div className="flex-1 [&>button]:w-full">{abschluss}</div>
        ) : (
          <Button type="button" className="flex-1" onClick={weiter}>
            Weiter
          </Button>
        )}
      </div>
    </div>
  );
}
