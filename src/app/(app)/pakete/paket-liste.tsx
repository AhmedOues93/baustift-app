"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { paketAnlegen, paketLoeschen, type PaketState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung, Textarea } from "@/components/ui/field";
import { IconPlus } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/sheet";
import type { Leistungspaket } from "@/types/database";

export function PaketListe({
  pakete,
  zeilenJePaket,
}: {
  pakete: Leistungspaket[];
  zeilenJePaket: Record<string, number>;
}) {
  const [neuOffen, setNeuOffen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <Button variante="akzent" vollbreit onClick={() => setNeuOffen(true)}>
        <IconPlus className="h-5 w-5" />
        Neues Paket
      </Button>

      {pakete.length === 0 ? (
        <p className="rounded-karte bg-papier p-4 text-sm text-text-leise">
          Noch kein Paket. Lege eines für die Arbeit an, die du am häufigsten
          machst — beim nächsten Mal ist das Angebot in zehn Sekunden fertig.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {pakete.map((p) => {
            const zeilen = zeilenJePaket[p.id] ?? 0;
            return (
              <li key={p.id} className="rounded-karte bg-flaeche p-3 shadow-karte">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/pakete/${p.id}`} className="min-h-11 flex-1">
                    <span className="font-medium text-text">{p.name}</span>
                    {p.beschreibung ? (
                      <span className="mt-0.5 block text-sm text-text-leise">
                        {p.beschreibung}
                      </span>
                    ) : null}
                    <span
                      className={`zahl mt-0.5 block text-sm ${
                        zeilen === 0 ? "text-warnung" : "text-text-leise"
                      }`}
                    >
                      {zeilen === 0
                        ? "noch keine Zeile — im Angebot käme nichts an"
                        : `${zeilen} ${zeilen === 1 ? "Zeile" : "Zeilen"}`}
                    </span>
                  </Link>

                  <form action={paketLoeschen}>
                    <input type="hidden" name="id" value={p.id} />
                    <LoeschKnopf name={p.name} />
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {neuOffen ? <NeuesPaket onSchliessen={() => setNeuOffen(false)} /> : null}
    </div>
  );
}

function LoeschKnopf({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(e) => {
        // Bestehende Angebote ändern sich nicht — dort stehen eigene
        // Positionen. Das steht in der Rückfrage, sonst traut sich niemand.
        if (
          !confirm(
            `„${name}“ löschen?\n\nBereits erstellte Angebote bleiben unverändert.`,
          )
        ) {
          e.preventDefault();
        }
      }}
      className="min-h-11 shrink-0 px-2 text-sm font-medium text-text-leise underline underline-offset-2"
    >
      Löschen
    </button>
  );
}

function NeuesPaket({ onSchliessen }: { onSchliessen: () => void }) {
  const [state, action] = useActionState<PaketState, FormData>(paketAnlegen, {});

  return (
    <Sheet titel="Neues Paket" onSchliessen={onSchliessen}>
      <form action={action} className="mt-4 flex flex-col gap-4">
        <Input
          label="Name"
          name="name"
          required
          placeholder="Bad komplett bis 10 m²"
          hinweis="So, wie du selbst danach suchen würdest."
        />
        <Textarea
          label="Wofür (freiwillig)"
          name="beschreibung"
          placeholder="Standardumfang ohne Elektro."
          className="min-h-20"
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
        {state.erfolg ? <Meldung art="erfolg">{state.erfolg}</Meldung> : null}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="sekundaer" onClick={onSchliessen}>
            {state.erfolg ? "Fertig" : "Abbrechen"}
          </Button>
          <AnlegenKnopf />
        </div>
      </form>
    </Sheet>
  );
}

function AnlegenKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird angelegt…" : "Anlegen"}
    </Button>
  );
}
