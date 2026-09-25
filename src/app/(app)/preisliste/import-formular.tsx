"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { preislisteImportieren, type PreisState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

/**
 * CSV-Import.
 *
 * Der Hinweistext nennt die erwarteten Spalten im Klartext — Handwerker
 * exportieren aus Excel und sollen nicht raten müssen, was die App erwartet.
 */
export function ImportFormular({ onSchliessen }: { onSchliessen: () => void }) {
  const [state, action] = useActionState<PreisState, FormData>(
    preislisteImportieren,
    {},
  );

  return (
    <Sheet titel="Preise importieren" onSchliessen={onSchliessen}>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="rounded-feld bg-papier p-3 text-sm text-text-leise">
          <p className="font-medium text-text">So muss die Datei aussehen</p>
          <p className="mt-1">
            Erste Zeile sind die Spaltennamen. Gebraucht werden
            <strong> Bezeichnung</strong> und <strong>Preis</strong>; optional
            Kategorie, Einheit, Beschreibung und Stichworte.
          </p>
          <pre className="zahl mt-2 overflow-x-auto text-xs">
            Bezeichnung;Kategorie;Einheit;Preis{"\n"}
            Fliesen verlegen 30x60;Fliesen;qm;52,00
          </pre>
          <p className="mt-2">
            Semikolon oder Komma als Trenner, beides geht. Einheiten wie „qm“,
            „Std.“ oder „psch“ werden erkannt.
          </p>
        </div>

        <Input
          label="CSV-Datei"
          name="datei"
          type="file"
          accept=".csv,text/csv"
          required
          className="file:mr-3 file:rounded-full file:border-0 file:bg-papier file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text"
          hinweis="Vorhandene Preise bleiben erhalten — es wird ergänzt, nicht ersetzt."
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
        {state.erfolg ? <Meldung art="erfolg">{state.erfolg}</Meldung> : null}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="sekundaer" onClick={onSchliessen}>
            {state.erfolg ? "Fertig" : "Abbrechen"}
          </Button>
          <ImportButton />
        </div>
      </form>
    </Sheet>
  );
}

function ImportButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Importiert…" : "Importieren"}
    </Button>
  );
}
