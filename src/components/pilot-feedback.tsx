"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

import { feedbackSenden } from "@/app/(app)/feedback-actions";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { FEEDBACK_ART_LABEL, type FeedbackArt } from "@/types/database";

/**
 * Rückmeldeknopf — nur im Testbetrieb sichtbar.
 *
 * Zwei Überlegungen dahinter:
 *
 *  1. Rückmeldungen kommen dort, wo der Ärger entsteht, oder gar nicht. Wer
 *     erst abends eine Nachricht schreiben soll, schreibt sie nicht — und
 *     wenn doch, fehlt die Stelle, an der es passiert ist. Deshalb geht die
 *     aktuelle Seite automatisch mit.
 *  2. Der Knopf verschwindet, sobald aus dem Testkonto ein zahlendes wird.
 *     Ein zahlender Kunde soll nicht das Gefühl haben, Versuchskaninchen zu
 *     sein.
 */
export function PilotFeedback() {
  const pfad = usePathname();
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className={[
          "fixed z-30 flex min-h-11 items-center gap-2 rounded-full px-4",
          "bg-tief text-sm font-medium text-text-invers shadow-schwebend",
          "transition-colors active:bg-text",
          // Unten LINKS: rechts sitzt auf mehreren Seiten der Plus-Knopf.
          "bottom-[calc(theme(spacing.navleiste)+1rem+env(safe-area-inset-bottom))] left-4",
          "lg:bottom-4",
        ].join(" ")}
      >
        <span className="h-2 w-2 rounded-full bg-akzent" />
        Feedback
      </button>

      {offen ? (
        <FeedbackSheet seite={pfad} onSchliessen={() => setOffen(false)} />
      ) : null}
    </>
  );
}

function FeedbackSheet({
  seite,
  onSchliessen,
}: {
  seite: string;
  onSchliessen: () => void;
}) {
  const [art, setArt] = useState<FeedbackArt>("problem");
  const [text, setText] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  async function senden() {
    setLaedt(true);
    setFehler(null);
    const ergebnis = await feedbackSenden({ art, text, seite });
    if (ergebnis.fehler) {
      setFehler(ergebnis.fehler);
      setLaedt(false);
      return;
    }
    setFertig(true);
    setLaedt(false);
  }

  if (fertig) {
    return (
      <Sheet titel="Danke" onSchliessen={onSchliessen}>
        <div className="mt-4 flex flex-col gap-4">
          <Meldung art="erfolg">
            Angekommen. Genau solche Hinweise machen das Produkt besser.
          </Meldung>
          <Button vollbreit onClick={onSchliessen}>
            Weiter arbeiten
          </Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet titel="Was ist dir aufgefallen?" onSchliessen={onSchliessen}>
      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(FEEDBACK_ART_LABEL) as FeedbackArt[]).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setArt(a)}
              aria-pressed={art === a}
              className={[
                "min-h-11 rounded-full px-4 text-sm font-medium transition-colors",
                art === a
                  ? "bg-tief text-text-invers"
                  : "border border-linie bg-flaeche text-text-leise",
              ].join(" ")}
            >
              {FEEDBACK_ART_LABEL[a]}
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Ruhig in deinen Worten — je konkreter, desto besser."
          aria-label="Deine Rückmeldung"
          className="w-full rounded-feld border border-linie bg-flaeche p-3 text-base text-text placeholder:text-text-leise/60 focus:border-text focus:outline-none"
        />

        <p className="text-xs text-text-leise">
          Mitgeschickt wird die Seite, auf der du gerade bist ({seite}) — damit
          wir es nachstellen können.
        </p>

        {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="sekundaer" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <Button onClick={senden} disabled={laedt || text.trim().length < 5}>
            {laedt ? "Wird gesendet…" : "Senden"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
