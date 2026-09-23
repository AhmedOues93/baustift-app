"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { preisAendern, preisAnlegen, preisLoeschen, type PreisState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung, Select, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { formatPreisEingabe } from "@/lib/format";
import { EINHEIT_LABEL, type Einheit, type PreislisteEintrag } from "@/types/database";

/**
 * Formular zum Anlegen und Bearbeiten — als Bottom Sheet.
 *
 * Mobile-first-Entscheidung: auf dem Handy schiebt sich das Formular von unten
 * herein (Daumenreichweite, vertraut aus nativen Apps) und darf bis 92 % der
 * Höhe einnehmen. Ab `sm` wird daraus ein klassischer zentrierter Dialog.
 * Es ist dasselbe Markup — nur andere Klassen ab dem Breakpoint.
 */
export function PreisFormular({
  eintrag,
  onSchliessen,
}: {
  /** Vorhandener Eintrag = Bearbeiten, undefined = Neu. */
  eintrag?: PreislisteEintrag;
  onSchliessen: () => void;
}) {
  const bearbeiten = Boolean(eintrag);
  const [state, action] = useFormState<PreisState, FormData>(
    bearbeiten ? preisAendern : preisAnlegen,
    {},
  );

  // Nach erfolgreichem Speichern das Sheet schliessen.
  useEffect(() => {
    if (state.erfolg) onSchliessen();
  }, [state.erfolg, onSchliessen]);

  return (
    <Sheet
      titel={bearbeiten ? "Preis bearbeiten" : "Neuer Preis"}
      onSchliessen={onSchliessen}
      fuss={
        eintrag ? (
          // Löschen liegt bewusst hier unten und als eigenes <form> (Formulare
          // dürfen nicht verschachtelt werden): weit weg von "Speichern" und
          // nur erreichbar, wenn man den Eintrag ohnehin geöffnet hat.
          <form
            action={preisLoeschen}
            onSubmit={(e) => {
              if (!confirm(`„${eintrag.bezeichnung}" wirklich löschen?`)) {
                e.preventDefault();
              }
            }}
          >
            <input type="hidden" name="id" value={eintrag.id} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-feld text-sm font-medium text-warnung transition-colors active:bg-warnung-flaeche"
            >
              Diesen Preis löschen
            </button>
          </form>
        ) : null
      }
    >
        <form action={action} className="mt-4 flex flex-col gap-4">
          {eintrag ? <input type="hidden" name="id" value={eintrag.id} /> : null}

          <Input
            label="Bezeichnung"
            name="bezeichnung"
            required
            defaultValue={eintrag?.bezeichnung}
            placeholder="Fliesen verlegen 30x60"
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Preis netto"
              name="einzelpreis"
              required
              zahl
              suffix="€"
              // inputMode="decimal" öffnet auf dem Handy die Zifferntastatur
              // mit Komma. type="number" wäre hier falsch: das akzeptiert je
              // nach Locale kein Komma und blockt "89,50".
              inputMode="decimal"
              defaultValue={eintrag ? formatPreisEingabe(eintrag.einzelpreis) : ""}
              placeholder="89,50"
            />
            <Select
              label="Einheit"
              name="einheit"
              defaultValue={eintrag?.einheit ?? "stk"}
            >
              {(Object.keys(EINHEIT_LABEL) as Einheit[]).map((e) => (
                <option key={e} value={e}>
                  {EINHEIT_LABEL[e]}
                </option>
              ))}
            </Select>
          </div>

          <Input
            label="Kategorie"
            name="kategorie"
            defaultValue={eintrag?.kategorie ?? ""}
            placeholder="Fliesenarbeiten"
            hinweis="Zum Filtern in der Liste."
          />

          <Textarea
            label="Beschreibung"
            name="beschreibung"
            defaultValue={eintrag?.beschreibung ?? ""}
            placeholder="Inkl. Kleber, Fugenmasse und Zuschnitt."
          />

          <Input
            label="Stichworte"
            name="stichworte"
            defaultValue={eintrag?.stichworte.join(", ") ?? ""}
            placeholder="bad fliesen, verfliesen, wandfliesen"
            // Diese Stichworte sind das stärkste Signal beim Preis-Matching
            // (siehe src/lib/ai/matching.ts) — deshalb der erklärende Hinweis.
            hinweis="Wörter, die du beim Diktieren benutzt. Hilft der KI, den richtigen Preis zu finden."
          />

          {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

          <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variante="sekundaer" onClick={onSchliessen}>
              Abbrechen
            </Button>
            <SpeichernButton bearbeiten={bearbeiten} />
          </div>
        </form>
    </Sheet>
  );
}

function SpeichernButton({ bearbeiten }: { bearbeiten: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Speichern…" : bearbeiten ? "Speichern" : "Anlegen"}
    </Button>
  );
}
