/**
 * =============================================================================
 * Preis-Matching — diktierte Leistung → Eintrag aus der Preisliste
 * =============================================================================
 *
 * WARUM ES DAS GIBT
 * Der Handwerker diktiert "Bad komplett fliesen, 8 Quadratmeter". In seiner
 * Preisliste steht aber "Fliesenarbeiten Wand/Boden 30x60". Ein exakter
 * Textvergleich (`=` oder `LIKE`) findet das nie. Wir brauchen also ein
 * unscharfes Matching.
 *
 * ZWEISTUFIGES VERFAHREN
 *   Stufe 1 — Claude (siehe extract-angebot.ts): bekommt die komplette
 *             Preisliste als Katalog und ordnet jede Position selbst eine ID zu.
 *             Claude versteht Fachsprache und Synonyme, das kann kein
 *             String-Vergleich.
 *   Stufe 2 — diese Datei: prüft Claudes Vorschlag nach und springt ein, wenn
 *             Claude keine ID geliefert hat.
 *
 * WICHTIGSTE REGEL DER GANZEN APP
 * Der PREIS kommt IMMER aus der Datenbank, niemals aus der KI-Antwort.
 * Claude liefert nur eine ID; den Euro-Betrag lesen wir hier selbst aus dem
 * Katalog. Ein halluzinierter Preis in einem verbindlichen Angebot wäre ein
 * echter wirtschaftlicher Schaden — diese Trennung schliesst das aus.
 *
 * Alles hier ist absichtlich pure (keine DB, kein Netzwerk) und damit gut
 * testbar.
 */

import type { Einheit, PreislisteEintrag } from "@/types/database";

/** Ab diesem Ähnlichkeitswert übernehmen wir den Treffer automatisch. */
export const AUTO_MATCH_SCHWELLE = 0.72;
/** Darunter: Vorschlag anzeigen, aber vom Nutzer bestätigen lassen. */
export const VORSCHLAG_SCHWELLE = 0.45;

/**
 * Normalisiert deutschen Handwerkertext für den Vergleich.
 *
 * Umlaute werden auf den nackten Vokal zurückgeführt (ä→a, ö→o, ü→u, ß→ss)
 * UND die ausgeschriebene Form gleich mit (ae→a, oe→o, ue→u). Erst dadurch
 * findet "sanitar" auch "Sanitär" — und genau so tippt man auf einer
 * Handytastatur mit dreckigen Fingern.
 *
 * Dass dabei auch harmlose Wörter zusammenfallen ("neue" → "neu"), ist kein
 * Problem: die Funktion läuft auf BEIDE Seiten des Vergleichs, gesucht wird
 * also immer in derselben normalisierten Welt.
 */
export function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "a")
    .replace(/ö/g, "o")
    .replace(/ü/g, "u")
    .replace(/ß/g, "ss")
    .replace(/ae/g, "a")
    .replace(/oe/g, "o")
    .replace(/ue/g, "u")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Sørensen-Dice-Koeffizient über Zeichen-Bigramme: 0 = nichts gemeinsam,
 * 1 = identisch. Gleiche Idee wie `similarity()` aus pg_trgm, nur in JS,
 * damit wir ohne zusätzlichen DB-Roundtrip pro Position auskommen.
 */
export function aehnlichkeit(a: string, b: string): number {
  const x = normalisiere(a);
  const y = normalisiere(b);
  if (!x || !y) return 0;
  if (x === y) return 1;

  const bigramme = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      out.set(g, (out.get(g) ?? 0) + 1);
    }
    return out;
  };

  const ba = bigramme(x);
  const bb = bigramme(y);
  if (ba.size === 0 || bb.size === 0) return 0;

  let treffer = 0;
  for (const [g, n] of ba) {
    treffer += Math.min(n, bb.get(g) ?? 0);
  }

  return (2 * treffer) / (x.length - 1 + (y.length - 1));
}

/**
 * Bewertet einen Katalogeintrag gegen den diktierten Text.
 * Basis ist die Textähnlichkeit, dazu zwei Zuschläge aus der Praxis:
 *
 *  - Stichworte: der Handwerker pflegt selbst Synonyme ("verfliesen",
 *    "Bad fliesen"). Ein Stichworttreffer ist ein sehr starkes Signal.
 *  - Einheit: passt m² zu m², spricht das für den Eintrag. Passt es nicht,
 *    ziehen wir etwas ab — "Fliesen verlegen" pro m² ist etwas anderes als
 *    eine Pauschale.
 */
export function bewerte(
  gesucht: string,
  eintrag: PreislisteEintrag,
  einheit?: Einheit | null,
): number {
  let score = aehnlichkeit(gesucht, eintrag.bezeichnung);

  // Auch gegen die Kategorie prüfen ("Sanitär" im Diktat, Bezeichnung anders).
  if (eintrag.kategorie) {
    score = Math.max(score, aehnlichkeit(gesucht, eintrag.kategorie) * 0.6);
  }

  const norm = normalisiere(gesucht);
  for (const wort of eintrag.stichworte) {
    const n = normalisiere(wort);
    if (!n) continue;
    // Enthält das Diktat das Stichwort wörtlich? Dann Score deutlich anheben.
    if (norm.includes(n)) score = Math.max(score, 0.85);
    else score = Math.max(score, aehnlichkeit(gesucht, wort) * 0.9);
  }

  if (einheit) {
    score += einheit === eintrag.einheit ? 0.08 : -0.05;
  }

  return Math.min(1, Math.max(0, score));
}

/** Rohposition, wie sie aus der KI-Extraktion kommt. */
export interface KiPosition {
  bezeichnung: string;
  beschreibung?: string | null;
  menge: number;
  einheit: Einheit;
  /** Von Claude vorgeschlagene Preislisten-ID (kann falsch oder null sein). */
  preisliste_id?: string | null;
  /** Selbsteinschätzung von Claude, 0–1. */
  konfidenz?: number | null;
}

/** Fertig aufgelöste Position, bereit zum Speichern in `positionen`. */
export interface GematchtePosition {
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
  preisliste_id: string | null;
  zu_pruefen: boolean;
  ki_konfidenz: number | null;
  /** Nur fürs UI: warum wurde so entschieden? */
  match_grund: "katalog" | "aehnlichkeit" | "vorschlag" | "kein_treffer";
}

/**
 * Löst eine einzelne KI-Position gegen die Preisliste auf.
 *
 * Reihenfolge:
 *  1. Claude hat eine ID geliefert und die existiert → übernehmen (Preis aus DB).
 *  2. Sonst: bester Treffer über `bewerte()`.
 *     - >= AUTO_MATCH_SCHWELLE   → übernehmen
 *     - >= VORSCHLAG_SCHWELLE    → Preis vorschlagen, aber `zu_pruefen`
 *     - darunter                 → kein Treffer, Preis 0, `zu_pruefen`
 *
 * `zu_pruefen` ist kein Fehler, sondern das Sicherheitsnetz: die Zeile wird im
 * Review-Screen gelb markiert, der Nutzer setzt den Preis in zwei Sekunden.
 * Lieber einmal nachfragen als still einen falschen Preis ins Angebot schreiben.
 */
export function matchePosition(
  pos: KiPosition,
  katalog: PreislisteEintrag[],
): GematchtePosition {
  const basis = {
    bezeichnung: pos.bezeichnung,
    beschreibung: pos.beschreibung ?? null,
    menge: pos.menge,
    einheit: pos.einheit,
    ki_konfidenz: pos.konfidenz ?? null,
  };

  // --- 1. Von Claude vorgeschlagene ID ---------------------------------------
  if (pos.preisliste_id) {
    const treffer = katalog.find((e) => e.id === pos.preisliste_id);
    if (treffer) {
      return {
        ...basis,
        // Beschreibung aus dem Katalog als Fallback (sauberer Langtext fürs PDF).
        beschreibung: basis.beschreibung ?? treffer.beschreibung,
        einzelpreis: treffer.einzelpreis, // <- Preis aus der DB, nicht von der KI
        preisliste_id: treffer.id,
        zu_pruefen: false,
        match_grund: "katalog",
      };
    }
    // ID unbekannt (halluziniert oder Eintrag gelöscht) → unten weitersuchen.
  }

  // --- 2. Lokales unscharfes Matching ----------------------------------------
  const suchtext = [pos.bezeichnung, pos.beschreibung].filter(Boolean).join(" ");

  let bester: PreislisteEintrag | null = null;
  let besterScore = 0;
  for (const eintrag of katalog) {
    if (!eintrag.aktiv) continue;
    const score = bewerte(suchtext, eintrag, pos.einheit);
    if (score > besterScore) {
      besterScore = score;
      bester = eintrag;
    }
  }

  if (bester && besterScore >= AUTO_MATCH_SCHWELLE) {
    return {
      ...basis,
      beschreibung: basis.beschreibung ?? bester.beschreibung,
      einzelpreis: bester.einzelpreis,
      preisliste_id: bester.id,
      zu_pruefen: false,
      ki_konfidenz: basis.ki_konfidenz ?? round2(besterScore),
      match_grund: "aehnlichkeit",
    };
  }

  if (bester && besterScore >= VORSCHLAG_SCHWELLE) {
    return {
      ...basis,
      einzelpreis: bester.einzelpreis,
      preisliste_id: bester.id,
      zu_pruefen: true, // Vorschlag — Nutzer muss bestätigen
      ki_konfidenz: round2(besterScore),
      match_grund: "vorschlag",
    };
  }

  return {
    ...basis,
    einzelpreis: 0,
    preisliste_id: null,
    zu_pruefen: true,
    match_grund: "kein_treffer",
  };
}

/** Bequemlichkeit: ganze Liste auflösen. */
export function matchePositionen(
  positionen: KiPosition[],
  katalog: PreislisteEintrag[],
): GematchtePosition[] {
  return positionen.map((p) => matchePosition(p, katalog));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
