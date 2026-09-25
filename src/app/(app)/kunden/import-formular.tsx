"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { kundenImportieren, type KundeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

/** CSV-Import für Kunden — Aufbau wie bei der Preisliste. */
export function KundenImportFormular({ onSchliessen }: { onSchliessen: () => void }) {
  const [state, action] = useActionState<KundeState, FormData>(kundenImportieren, {});

  return (
    <Sheet titel="Kunden importieren" onSchliessen={onSchliessen}>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="rounded-feld bg-papier p-3 text-sm text-text-leise">
          <p className="font-medium text-text">So muss die Datei aussehen</p>
          <p className="mt-1">
            Erste Zeile sind die Spaltennamen. Gebraucht wird nur der
            <strong> Name</strong>; optional Strasse, PLZ, Ort, E-Mail, Telefon
            und Notizen.
          </p>
          <pre className="zahl mt-2 overflow-x-auto text-xs">
            Name;Strasse;PLZ;Ort;Telefon{"\n"}
            Familie Becker;Lindenstr. 12;50667;Köln;0221 998877
          </pre>
          <p className="mt-2">
            „Firma“, „Adresse“ oder „Stadt“ werden genauso erkannt.
          </p>
        </div>

        <Input
          label="CSV-Datei"
          name="datei"
          type="file"
          accept=".csv,text/csv"
          required
          className="file:mr-3 file:rounded-full file:border-0 file:bg-papier file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text"
          hinweis="Vorhandene Kunden bleiben erhalten; Namen, die es schon gibt, werden übersprungen."
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
