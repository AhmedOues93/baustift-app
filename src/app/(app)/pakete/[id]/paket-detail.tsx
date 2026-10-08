"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  paketZeileAnlegen,
  paketZeileLoeschen,
  type PaketState,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { IconPlus } from "@/components/ui/icons";
import { formatEuro } from "@/lib/format";
import { EINHEIT_LABEL } from "@/types/database";
import type { Einheit, Leistungspaket, PaketPosition, PreislisteEintrag } from "@/types/database";

/**
 * Ein Paket bearbeiten.
 *
 * Der Normalfall ist: Leistung aus der Preisliste wählen, Menge eintragen,
 * fertig. Eine freie Zeile ohne Katalogeintrag ist möglich, aber der zweite
 * Weg — sie bekommt im Angebot eine Prüfmarkierung, weil ihr Preis hier
 * eingefroren ist und bei der nächsten Preiserhöhung nicht mitwandert.
 */
export function PaketDetail({
  paket,
  zeilen,
  preisliste,
}: {
  paket: Leistungspaket;
  zeilen: PaketPosition[];
  preisliste: PreislisteEintrag[];
}) {
  const [state, action] = useActionState<PaketState, FormData>(paketZeileAnlegen, {});
  const [ausKatalog, setAusKatalog] = useState(true);
  const [gewaehlt, setGewaehlt] = useState("");

  const eintrag = preisliste.find((p) => p.id === gewaehlt);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titel text-2xl font-bold tracking-tight text-text">
          {paket.name}
        </h1>
        {paket.beschreibung ? (
          <p className="mt-1 text-sm text-text-leise">{paket.beschreibung}</p>
        ) : null}
      </div>

      {/* Zeilen */}
      {zeilen.length === 0 ? (
        <p className="rounded-karte bg-papier p-4 text-sm text-text-leise">
          Noch keine Zeile. Was gehört immer dazu?
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {zeilen.map((z) => (
            <li
              key={z.id}
              className="flex items-start justify-between gap-3 rounded-karte bg-flaeche p-3 shadow-karte"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-text">{z.bezeichnung}</p>
                <p className="zahl mt-0.5 text-sm text-text-leise">
                  {String(z.menge).replace(".", ",")} {EINHEIT_LABEL[z.einheit]}
                  {z.preisliste_id ? (
                    <span className="text-erfolg"> · Preis aus der Preisliste</span>
                  ) : (
                    <span className="text-warnung">
                      {" "}
                      · fester Preis {formatEuro(z.einzelpreis)}
                    </span>
                  )}
                </p>
              </div>

              <form action={paketZeileLoeschen}>
                <input type="hidden" name="id" value={z.id} />
                <input type="hidden" name="paket_id" value={paket.id} />
                <button
                  type="submit"
                  className="min-h-11 shrink-0 px-2 text-sm font-medium text-text-leise underline underline-offset-2"
                >
                  Entfernen
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      {/* Neue Zeile */}
      <form action={action} className="flex flex-col gap-3 rounded-karte bg-flaeche p-4 shadow-karte">
        <input type="hidden" name="paket_id" value={paket.id} />

        <div className="flex gap-4 text-sm">
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              checked={ausKatalog}
              onChange={() => setAusKatalog(true)}
            />
            Aus der Preisliste
          </label>
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="radio"
              checked={!ausKatalog}
              onChange={() => setAusKatalog(false)}
            />
            Freie Zeile
          </label>
        </div>

        {ausKatalog ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-leise">Leistung</span>
              <select
                name="preisliste_id"
                value={gewaehlt}
                onChange={(e) => setGewaehlt(e.target.value)}
                required
                className="min-h-11 rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
              >
                <option value="">Bitte wählen</option>
                {preisliste.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.bezeichnung} — {formatEuro(p.einzelpreis)}/{EINHEIT_LABEL[p.einheit]}
                  </option>
                ))}
              </select>
            </label>
            {/* Bezeichnung und Einheit kommen aus dem gewählten Eintrag. */}
            <input type="hidden" name="bezeichnung" value={eintrag?.bezeichnung ?? ""} />
            <input type="hidden" name="einheit" value={eintrag?.einheit ?? "stk"} />
          </>
        ) : (
          <>
            <Input label="Leistung" name="bezeichnung" required placeholder="Entsorgung Bauschutt" />
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-leise">Einheit</span>
                <select
                  name="einheit"
                  defaultValue="pauschal"
                  className="min-h-11 rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
                >
                  {(Object.keys(EINHEIT_LABEL) as Einheit[]).map((e) => (
                    <option key={e} value={e}>
                      {EINHEIT_LABEL[e]}
                    </option>
                  ))}
                </select>
              </label>
              <Input label="Preis" name="einzelpreis" inputMode="decimal" placeholder="180,00" />
            </div>
            <p className="text-sm text-warnung">
              Eine freie Zeile hat einen festen Preis. Er wandert bei einer
              Preiserhöhung nicht mit — deshalb wird sie im Angebot zum Prüfen
              markiert.
            </p>
          </>
        )}

        <Input
          label="Menge"
          name="menge"
          inputMode="decimal"
          defaultValue="1"
          hinweis="Lässt sich im Angebot jederzeit ändern."
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
        {state.erfolg ? <Meldung art="erfolg">{state.erfolg}</Meldung> : null}

        <ZeileKnopf />
      </form>
    </div>
  );
}

function ZeileKnopf() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" vollbreit disabled={pending}>
      <IconPlus className="h-5 w-5" />
      {pending ? "Wird hinzugefügt…" : "Zeile hinzufügen"}
    </Button>
  );
}
