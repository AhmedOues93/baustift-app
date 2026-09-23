"use client";

import { useMemo, useState } from "react";

import { KundenFormular } from "./kunden-formular";
import { Button } from "@/components/ui/button";
import { IconPlus, IconSuche } from "@/components/ui/icons";
import { normalisiere } from "@/lib/ai/matching";
import type { Kunde } from "@/types/database";

export function KundenAnsicht({ kunden }: { kunden: Kunde[] }) {
  const [suche, setSuche] = useState("");
  const [sheet, setSheet] = useState<"neu" | Kunde | null>(null);

  const gefiltert = useMemo(() => {
    const q = normalisiere(suche);
    if (!q) return kunden;
    return kunden.filter((k) => {
      const heuhaufen = normalisiere(
        [k.name, k.ort, k.strasse, k.ansprechpartner, k.email]
          .filter(Boolean)
          .join(" "),
      );
      return q.split(" ").every((wort) => heuhaufen.includes(wort));
    });
  }, [kunden, suche]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] leading-none">Kunden</h1>
          <p className="mt-1.5 text-sm text-text-leise">
            <span className="zahl">{kunden.length}</span>{" "}
            {kunden.length === 1 ? "Kunde" : "Kunden"}
          </p>
        </div>
        <Button className="hidden lg:inline-flex" onClick={() => setSheet("neu")}>
          <IconPlus className="h-5 w-5" />
          Neuer Kunde
        </Button>
      </header>

      <div className="relative">
        <IconSuche className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-leise" />
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Name, Ort…"
          aria-label="Kunden durchsuchen"
          className="min-h-11 w-full rounded-feld border border-linie bg-flaeche py-2 pl-11 pr-3 text-base text-text transition-colors placeholder:text-text-leise/60 focus:border-text focus:outline-none"
        />
      </div>

      {gefiltert.length === 0 ? (
        <div className="rounded-karte border border-dashed border-linie p-8 text-center">
          <p className="font-titel text-lg font-bold tracking-tight text-text">
            {kunden.length === 0 ? "Noch keine Kunden" : "Nichts gefunden"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
            {kunden.length === 0
              ? "Du kannst Kunden auch direkt beim Erstellen eines Angebots anlegen."
              : "Andere Suche probieren?"}
          </p>
          {kunden.length === 0 ? (
            <Button className="mt-4" onClick={() => setSheet("neu")}>
              <IconPlus className="h-5 w-5" />
              Ersten Kunden anlegen
            </Button>
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-2 pb-20 lg:pb-0">
          {gefiltert.map((k) => (
            <li key={k.id} className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
              <button
                type="button"
                onClick={() => setSheet(k)}
                className="flex min-h-14 w-full items-center gap-3 p-4 text-left transition-colors active:bg-papier"
              >
                <span className="flex-1">
                  <span className="block font-medium text-text">{k.name}</span>
                  <span className="mt-0.5 block text-sm text-text-leise">
                    {[k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")]
                      .filter(Boolean)
                      .join(", ") || "Keine Anschrift hinterlegt"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setSheet("neu")}
        aria-label="Neuen Kunden anlegen"
        className="fixed bottom-[calc(theme(spacing.navleiste)+1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-akzent text-text-invers shadow-schwebend transition-colors active:bg-akzent-hover lg:hidden"
      >
        <IconPlus className="h-7 w-7" />
      </button>

      {sheet ? (
        <KundenFormular
          kunde={sheet === "neu" ? undefined : sheet}
          onSchliessen={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}
