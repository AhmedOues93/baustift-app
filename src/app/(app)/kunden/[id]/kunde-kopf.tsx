"use client";

import { useState } from "react";

import { KundenFormular } from "../kunden-formular";
import type { Kunde } from "@/types/database";

/**
 * Kopf der Kundenakte: Anschrift, Kontakt, Bearbeiten.
 *
 * Telefonnummer und E-Mail sind echte Links. Im Handwerk wird angerufen —
 * die Nummer abzuschreiben, um sie in die Telefon-App zu tippen, ist genau
 * die Sorte Umweg, wegen der man eine App wieder von Hand umgeht.
 */
export function KundeKopf({ kunde }: { kunde: Kunde }) {
  const [bearbeiten, setBearbeiten] = useState(false);

  const anschrift = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[28px] leading-tight">{kunde.name}</h1>
            {kunde.ansprechpartner ? (
              <p className="mt-1 text-sm text-text-leise">{kunde.ansprechpartner}</p>
            ) : null}
            <p className="mt-1.5 text-sm text-text-leise">
              {anschrift || "Keine Anschrift hinterlegt"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBearbeiten(true)}
            className="inline-flex min-h-11 shrink-0 items-center rounded-gross border border-linie bg-flaeche px-4 text-sm font-medium text-text transition-colors active:bg-papier"
          >
            Bearbeiten
          </button>
        </div>

        {kunde.telefon || kunde.email ? (
          <div className="flex flex-wrap gap-2">
            {kunde.telefon ? (
              <a
                href={`tel:${kunde.telefon.replace(/\s/g, "")}`}
                className="zahl inline-flex min-h-11 items-center rounded-gross bg-tief px-4 text-sm font-medium text-text-invers transition-colors active:bg-text"
              >
                {kunde.telefon}
              </a>
            ) : null}
            {kunde.email ? (
              <>
                <a
                  href={`mailto:${kunde.email}`}
                  className="inline-flex min-h-11 items-center rounded-gross border border-linie bg-flaeche px-4 text-sm font-medium text-text transition-colors active:bg-papier"
                >
                  {kunde.email}
                </a>
                <a
                  href={`mailto:${kunde.email}?subject=${encodeURIComponent(`Nachricht an ${kunde.name}`)}`}
                  className="inline-flex min-h-11 items-center rounded-gross bg-akzent px-4 text-sm font-medium text-white transition-colors active:opacity-80"
                >
                  E-Mail schreiben
                </a>
              </>
            ) : null}
          </div>
        ) : null}

        {kunde.notizen ? (
          <p className="rounded-feld bg-flaeche p-3 text-sm text-text-leise">
            {kunde.notizen}
          </p>
        ) : null}
      </header>

      {bearbeiten ? (
        <KundenFormular kunde={kunde} onSchliessen={() => setBearbeiten(false)} />
      ) : null}
    </>
  );
}
