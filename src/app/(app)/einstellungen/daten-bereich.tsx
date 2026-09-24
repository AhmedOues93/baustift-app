"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { kontoLoeschen } from "./konto-actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";

/**
 * Daten mitnehmen und Konto löschen.
 *
 * Beides steht bewusst sichtbar im Konto und nicht im Kleingedruckten: ein
 * Produkt, das die eigenen Daten festhält, verkauft sich einmal. Und beides
 * ist ohnehin Pflicht (Art. 17 und 20 DSGVO) — dann lieber als ordentliche
 * Funktion statt als E-Mail an den Support.
 */
export function DatenBereich({ firmaName }: { firmaName: string }) {
  const [loeschenOffen, setLoeschenOffen] = useState(false);

  return (
    <section className="rounded-karte bg-flaeche p-4 shadow-karte sm:p-5">
      <h2 className="text-lg">Deine Daten</h2>
      <p className="mt-1 text-sm text-text-leise">
        Alles, was hier liegt, gehört dir — du kommst jederzeit heran.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <Herunterladen href="/api/export/kunden" titel="Kunden" hinweis="CSV für Excel" />
        <Herunterladen href="/api/export/preisliste" titel="Preisliste" hinweis="CSV, lässt sich auch wieder importieren" />
        <Herunterladen href="/api/export/angebote" titel="Angebote" hinweis="CSV für Excel" />
        <Herunterladen href="/api/export/rechnungen" titel="Rechnungen" hinweis="CSV für Excel oder den Steuerberater" />
        <Herunterladen
          href="/api/konto/export"
          titel="Alles zusammen"
          hinweis="Vollständige Auskunft als JSON (Art. 20 DSGVO)"
        />
      </div>

      <div className="mt-5 border-t border-linie pt-4">
        <button
          type="button"
          onClick={() => setLoeschenOffen(true)}
          className="min-h-11 rounded-feld text-sm font-medium text-warnung transition-colors active:bg-warnung-flaeche"
        >
          Konto und alle Daten löschen
        </button>
      </div>

      {loeschenOffen ? (
        <LoeschenSheet
          firmaName={firmaName}
          onSchliessen={() => setLoeschenOffen(false)}
        />
      ) : null}
    </section>
  );
}

function Herunterladen({
  href,
  titel,
  hinweis,
}: {
  href: string;
  titel: string;
  hinweis: string;
}) {
  return (
    <a
      href={href}
      // download statt Navigation: sonst öffnet der Browser die Datei und der
      // Nutzer steht vor einer Wand aus Text.
      download
      className="flex min-h-11 items-center justify-between gap-3 rounded-feld bg-papier px-3 py-2 transition-colors active:bg-linie"
    >
      <span>
        <span className="block text-sm font-medium">{titel}</span>
        <span className="block text-xs text-text-leise">{hinweis}</span>
      </span>
      <span className="shrink-0 text-sm font-medium text-akzent">Laden</span>
    </a>
  );
}

function LoeschenSheet({
  firmaName,
  onSchliessen,
}: {
  firmaName: string;
  onSchliessen: () => void;
}) {
  const [state, action] = useFormState(kontoLoeschen, {});

  return (
    <Sheet titel="Konto löschen" onSchliessen={onSchliessen}>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <div className="rounded-feld bg-warnung-flaeche p-3 text-sm text-warnung">
          <p className="font-medium">Das lässt sich nicht rückgängig machen.</p>
          <p className="mt-1">
            Angebote, Rechnungen, Kunden und deine Preisliste werden
            vollständig gelöscht. Lade dir vorher den Export herunter, wenn du
            etwas behalten willst.
          </p>
        </div>

        <Input
          label={`Tippe „${firmaName}“ ein, um zu bestätigen`}
          name="bestaetigung"
          autoComplete="off"
          placeholder={firmaName}
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="sekundaer" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <LoeschenButton />
        </div>
      </form>
    </Sheet>
  );
}

function LoeschenButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variante="gefahr" disabled={pending}>
      {pending ? "Wird gelöscht…" : "Endgültig löschen"}
    </Button>
  );
}
