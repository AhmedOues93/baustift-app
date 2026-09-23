"use client";

import { useMemo, useState } from "react";

import { PreisFormular } from "./preis-formular";
import { Button } from "@/components/ui/button";
import { IconPlus, IconSuche } from "@/components/ui/icons";
import { normalisiere } from "@/lib/ai/matching";
import { formatEuro } from "@/lib/format";
import { EINHEIT_LABEL, type PreislisteEintrag } from "@/types/database";

/**
 * Preislisten-Ansicht: Suche, Kategoriefilter, Liste, Anlegen/Bearbeiten.
 *
 * Warum wird im Browser gefiltert und nicht per SQL?
 * Eine Handwerker-Preisliste hat typischerweise 30–300 Einträge. Die sind in
 * einem Rutsch geladen, und lokales Filtern reagiert ohne Netzwerk — auf der
 * Baustelle mit schlechtem Empfang ist das der entscheidende Unterschied.
 * Für sehr grosse Listen gibt es die serverseitige Suche
 * (`suche_preisliste`, siehe 0003_preisliste_suche.sql).
 */
export function PreislisteAnsicht({
  eintraege,
}: {
  eintraege: PreislisteEintrag[];
}) {
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState<string | null>(null);
  // null = Sheet zu, "neu" = Anlegen, Eintrag = Bearbeiten
  const [sheet, setSheet] = useState<"neu" | PreislisteEintrag | null>(null);

  const kategorien = useMemo(() => {
    const set = new Set<string>();
    for (const e of eintraege) if (e.kategorie) set.add(e.kategorie);
    return [...set].sort((a, b) => a.localeCompare(b, "de"));
  }, [eintraege]);

  const gefiltert = useMemo(() => {
    // `normalisiere` kommt aus dem Matching-Modul: löst Umlaute auf, damit
    // "Grosse" auch "Größe" findet. Einmal geschrieben, zweimal genutzt.
    const q = normalisiere(suche);
    return eintraege.filter((e) => {
      if (kategorie && e.kategorie !== kategorie) return false;
      if (!q) return true;
      const heuhaufen = normalisiere(
        [e.bezeichnung, e.kategorie, e.beschreibung, ...e.stichworte]
          .filter(Boolean)
          .join(" "),
      );
      // Jedes Suchwort muss vorkommen ("fliesen bad" findet auch "Bad fliesen").
      return q.split(" ").every((wort) => heuhaufen.includes(wort));
    });
  }, [eintraege, suche, kategorie]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Preisliste</h1>
          <p className="text-sm text-slate-600">
            {eintraege.length} {eintraege.length === 1 ? "Eintrag" : "Einträge"}
          </p>
        </div>
        {/* Auf dem Desktop oben rechts; mobil übernimmt der FAB unten. */}
        <Button className="hidden lg:inline-flex" onClick={() => setSheet("neu")}>
          <IconPlus className="h-5 w-5" />
          Neuer Preis
        </Button>
      </header>

      <div className="relative">
        <IconSuche className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen…"
          aria-label="Preisliste durchsuchen"
          className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-base placeholder:text-slate-400 focus:border-brand-600 focus:outline focus:outline-2 focus:outline-brand-600/30"
        />
      </div>

      {kategorien.length > 0 ? (
        // Horizontal scrollbare Chips: auf 390px passen keine 8 Kategorien
        // nebeneinander, Umbruch würde den halben Screen fressen.
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          <Chip aktiv={kategorie === null} onClick={() => setKategorie(null)}>
            Alle
          </Chip>
          {kategorien.map((k) => (
            <Chip
              key={k}
              aktiv={kategorie === k}
              onClick={() => setKategorie(kategorie === k ? null : k)}
            >
              {k}
            </Chip>
          ))}
        </div>
      ) : null}

      {gefiltert.length === 0 ? (
        <LeerZustand
          hatEintraege={eintraege.length > 0}
          onNeu={() => setSheet("neu")}
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {gefiltert.map((e) => (
            <PreisKarte key={e.id} eintrag={e} onBearbeiten={() => setSheet(e)} />
          ))}
        </ul>
      )}

      {/* Floating Action Button: sitzt über der Tab-Leiste, immer erreichbar. */}
      <button
        type="button"
        onClick={() => setSheet("neu")}
        aria-label="Neuen Preis anlegen"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg active:bg-brand-900 lg:hidden"
      >
        <IconPlus className="h-7 w-7" />
      </button>

      {sheet ? (
        <PreisFormular
          eintrag={sheet === "neu" ? undefined : sheet}
          onSchliessen={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}

function Chip({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktiv}
      className={[
        "min-h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors",
        aktiv
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-slate-300 bg-white text-slate-700 active:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PreisKarte({
  eintrag,
  onBearbeiten,
}: {
  eintrag: PreislisteEintrag;
  onBearbeiten: () => void;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white">
      {/* Die ganze Karte ist tippbar — auf dem Handy zielt niemand auf ein
          kleines Stift-Icon. Gelöscht wird im Formular, nicht hier: ein
          "Löschen" in jeder Zeile lädt auf einem Touchscreen zum Fehlgriff ein. */}
      <button
        type="button"
        onClick={onBearbeiten}
        className="flex min-h-14 w-full items-center gap-3 p-3 text-left"
      >
        <span className="flex-1">
          <span className="block font-medium text-slate-900">
            {eintrag.bezeichnung}
          </span>
          <span className="mt-0.5 block text-sm text-slate-500">
            {eintrag.kategorie ? `${eintrag.kategorie} · ` : ""}
            pro {EINHEIT_LABEL[eintrag.einheit]}
          </span>
        </span>
        <span className="whitespace-nowrap font-semibold tabular-nums text-slate-900">
          {formatEuro(eintrag.einzelpreis)}
        </span>
      </button>
    </li>
  );
}

function LeerZustand({
  hatEintraege,
  onNeu,
}: {
  hatEintraege: boolean;
  onNeu: () => void;
}) {
  if (hatEintraege) {
    return (
      <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-600">
        Nichts gefunden. Andere Suche probieren?
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center">
      <p className="font-medium text-slate-900">Noch keine Preise</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-slate-600">
        Leg deine häufigsten Leistungen an. Baustift ordnet deine
        Sprachnachrichten später automatisch diesen Preisen zu.
      </p>
      <Button className="mt-4" onClick={onNeu}>
        <IconPlus className="h-5 w-5" />
        Ersten Preis anlegen
      </Button>
    </div>
  );
}
