"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { preisAendern, preisAnlegen, type PreisState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung, Select, Textarea } from "@/components/ui/field";
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

  const ersteFeldRef = useRef<HTMLInputElement>(null);

  // Nach erfolgreichem Speichern das Sheet schliessen.
  useEffect(() => {
    if (state.erfolg) onSchliessen();
  }, [state.erfolg, onSchliessen]);

  // Escape schliesst — auf dem Desktop erwartet man das.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", onKey);
    // Hintergrund nicht mitscrollen lassen, solange das Sheet offen ist.
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onSchliessen]);

  useEffect(() => {
    ersteFeldRef.current?.focus();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Schliessen"
        onClick={onSchliessen}
        className="absolute inset-0 bg-slate-900/40"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={bearbeiten ? "Preis bearbeiten" : "Preis anlegen"}
        className={[
          "relative flex max-h-[92vh] w-full flex-col overflow-y-auto bg-white",
          "rounded-t-2xl px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4",
          "sm:max-w-lg sm:rounded-2xl sm:p-6",
        ].join(" ")}
      >
        {/* Griff-Balken: das übliche Signal "nach unten wischen zum Schliessen". */}
        <div className="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />

        <h2 className="text-xl font-bold tracking-tight">
          {bearbeiten ? "Preis bearbeiten" : "Neuer Preis"}
        </h2>

        <form action={action} className="mt-4 flex flex-col gap-4">
          {eintrag ? <input type="hidden" name="id" value={eintrag.id} /> : null}

          <Input
            ref={ersteFeldRef}
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
      </div>
    </div>
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
