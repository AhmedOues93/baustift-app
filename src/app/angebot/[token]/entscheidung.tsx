"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { angebotEntscheiden, type FreigabeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Meldung, Textarea } from "@/components/ui/field";

/**
 * Zusagen oder absagen.
 *
 * Zwei Entscheidungen, bewusst unterschiedlich schwer gemacht:
 *
 *  - Zusagen ist ein Antippen. Das ist der Weg, den der Betrieb braucht, und
 *    jede zusätzliche Hürde kostet ihn Aufträge.
 *  - Absagen fragt nach einem Grund. Nicht um zu bremsen, sondern weil "zu
 *    teuer" und "schon vergeben" für den Handwerker zwei verschiedene Dinge
 *    sind — und er sonst nie erfährt, welches davon es war.
 *
 * Nach der Entscheidung verschwinden die Knöpfe. Sie lässt sich nicht
 * zurücknehmen; das steht auch so da, bevor jemand drückt.
 */
export function Entscheidung({
  token,
  entschiedenAls,
  anmerkung,
  abgelaufen,
  telefon,
  email,
  firma,
}: {
  token: string;
  entschiedenAls: string | null;
  anmerkung: string | null;
  abgelaufen: boolean;
  telefon: string | null;
  email: string | null;
  firma: string | null;
}) {
  const [state, action] = useActionState<FreigabeState, FormData>(
    angebotEntscheiden,
    {},
  );
  const [absageOffen, setAbsageOffen] = useState(false);

  // Schon entschieden — vom Kunden selbst oder vom Betrieb nachgetragen.
  if (entschiedenAls === "angenommen" || entschiedenAls === "abgelehnt") {
    return (
      <section className="mt-6 rounded-karte border border-linie bg-flaeche p-5 text-center">
        <p className="font-medium text-text">
          {entschiedenAls === "angenommen"
            ? "Dieses Angebot wurde angenommen."
            : "Dieses Angebot wurde abgelehnt."}
        </p>
        {anmerkung ? (
          <p className="mt-2 text-sm text-text-leise">„{anmerkung}“</p>
        ) : null}
        <p className="mt-2 text-sm text-text-leise">
          Fragen dazu? {firma ? `${firma} erreichst du unter ` : "Erreichbar unter "}
          {[telefon, email].filter(Boolean).join(" oder ") || "den oben genannten Kontaktdaten"}.
        </p>
      </section>
    );
  }

  if (state.erfolg) {
    return (
      <section className="mt-6 rounded-karte border border-linie bg-flaeche p-5 text-center">
        <p className="font-medium text-text">{state.erfolg}</p>
      </section>
    );
  }

  if (abgelaufen) {
    return (
      <section className="mt-6 rounded-karte border border-linie bg-flaeche p-5 text-center">
        <p className="font-medium text-text">Dieses Angebot ist nicht mehr gültig.</p>
        <p className="mt-2 text-sm text-text-leise">
          Melde dich beim Betrieb — meistens lässt sich die Frist verlängern.
          {telefon ? ` Tel. ${telefon}` : ""}
        </p>
      </section>
    );
  }

  return (
    <section className="mt-6 flex flex-col gap-3">
      {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />

        {absageOffen ? (
          <>
            <input type="hidden" name="entscheidung" value="abgelehnt" />
            <Textarea
              label="Woran liegt es?"
              name="anmerkung"
              placeholder="Zum Beispiel: zu teuer, anderer Termin, schon vergeben."
              className="min-h-24"
              hinweis="Freiwillig — hilft dem Betrieb aber, das nächste Angebot besser zu machen."
            />
            <AbsendeKnopf text="Absage abschicken" />
            <button
              type="button"
              onClick={() => setAbsageOffen(false)}
              className="min-h-11 text-sm font-medium text-text-leise underline underline-offset-2"
            >
              Zurück
            </button>
          </>
        ) : (
          <>
            <input type="hidden" name="entscheidung" value="angenommen" />
            <AbsendeKnopf text="Angebot annehmen" />
            <p className="text-center text-xs text-text-leise">
              Mit dem Annehmen beauftragst du die oben aufgeführten Leistungen.
              Die Entscheidung lässt sich hier nicht zurücknehmen.
            </p>
          </>
        )}
      </form>

      {absageOffen ? null : (
        <button
          type="button"
          onClick={() => setAbsageOffen(true)}
          className="min-h-11 text-sm font-medium text-text-leise underline underline-offset-2"
        >
          Angebot ablehnen
        </button>
      )}
    </section>
  );
}

function AbsendeKnopf({ text }: { text: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" vollbreit disabled={pending}>
      {pending ? "Wird gesendet…" : text}
    </Button>
  );
}
