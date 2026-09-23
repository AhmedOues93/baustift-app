"use client";

import { useMemo, useState } from "react";

import { ImportFormular } from "./import-formular";
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
  const [importSheet, setImportSheet] = useState(false);

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
          <h1 className="text-[28px] leading-none">Preisliste</h1>
          <p className="mt-1.5 text-sm text-text-leise">
            <span className="zahl">{eintraege.length}</span>{" "}
            {eintraege.length === 1 ? "Eintrag" : "Einträge"}
          </p>
        </div>
        {/* Auf dem Desktop oben rechts; mobil übernimmt der FAB unten. */}
        <div className="hidden gap-2 lg:flex">
          <Button variante="sekundaer" onClick={() => setImportSheet(true)}>
            Importieren
          </Button>
          <Button onClick={() => setSheet("neu")}>
            <IconPlus className="h-5 w-5" />
            Neuer Preis
          </Button>
        </div>
      </header>

      <div className="relative">
        <IconSuche className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-leise" />
        <input
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Suchen…"
          aria-label="Preisliste durchsuchen"
          className="min-h-11 w-full rounded-feld border border-linie bg-flaeche py-2 pl-11 pr-3 text-base text-text transition-colors placeholder:text-text-leise/60 focus:border-text focus:outline-none"
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
          onImport={() => setImportSheet(true)}
        />
      ) : (
        // pb: der FAB schwebt über der Liste und würde sonst den letzten
        // Preis verdecken. Auf dem Desktop gibt es keinen FAB -> kein Abstand.
        <ul className="flex flex-col gap-2 pb-20 lg:pb-0">
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
        className="fixed bottom-[calc(theme(spacing.navleiste)+1rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-akzent text-text-invers shadow-schwebend transition-colors active:bg-akzent-hover lg:hidden"
      >
        <IconPlus className="h-7 w-7" />
      </button>

      {importSheet ? (
        <ImportFormular onSchliessen={() => setImportSheet(false)} />
      ) : null}

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
        "min-h-11 shrink-0 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors",
        aktiv
          ? "bg-tief text-text-invers"
          : "border border-linie bg-flaeche text-text-leise active:bg-papier",
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
    <li className="overflow-hidden rounded-karte bg-flaeche shadow-karte">
      {/* Die ganze Karte ist tippbar — auf dem Handy zielt niemand auf ein
          kleines Stift-Icon. Gelöscht wird im Formular, nicht hier: ein
          "Löschen" in jeder Zeile lädt auf einem Touchscreen zum Fehlgriff ein. */}
      <button
        type="button"
        onClick={onBearbeiten}
        className="flex min-h-14 w-full items-center gap-3 p-4 text-left transition-colors active:bg-papier"
      >
        <span className="flex-1">
          <span className="block font-medium text-text">
            {eintrag.bezeichnung}
          </span>
          <span className="mt-0.5 block text-sm text-text-leise">
            {eintrag.kategorie ? `${eintrag.kategorie} · ` : ""}
            pro {EINHEIT_LABEL[eintrag.einheit]}
          </span>
        </span>
        {/* Preise immer in der Monoschrift: gleiche Ziffernbreite, dadurch
            stehen alle Beträge einer Liste exakt untereinander. */}
        <span className="zahl shrink-0 whitespace-nowrap text-[15px] font-medium text-text">
          {formatEuro(eintrag.einzelpreis)}
        </span>
      </button>
    </li>
  );
}

function LeerZustand({
  hatEintraege,
  onNeu,
  onImport,
}: {
  hatEintraege: boolean;
  onNeu: () => void;
  onImport: () => void;
}) {
  if (hatEintraege) {
    return (
      <p className="rounded-karte border border-dashed border-linie p-6 text-center text-text-leise">
        Nichts gefunden. Andere Suche probieren?
      </p>
    );
  }

  return (
    <div className="rounded-karte border border-dashed border-linie p-8 text-center">
      <p className="font-titel text-lg font-bold tracking-tight text-text">
        Noch keine Preise
      </p>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-text-leise">
        Leg deine häufigsten Leistungen an. Baustift ordnet deine
        Sprachnachrichten später automatisch diesen Preisen zu.
      </p>
      <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
        <Button onClick={onNeu}>
          <IconPlus className="h-5 w-5" />
          Ersten Preis anlegen
        </Button>
        <Button variante="sekundaer" onClick={onImport}>
          Aus Excel importieren
        </Button>
      </div>
    </div>
  );
}
