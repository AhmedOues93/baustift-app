"use client";

import { useEffect, useRef } from "react";

/**
 * Waagrecht scrollbare Filterleiste, die den aktiven Filter sichtbar hält.
 *
 * Fünf Filter passen auf 390px nicht nebeneinander, also scrollt die Reihe.
 * Wer selbst tippt, sieht den gewählten Filter ohnehin — wer aber über einen
 * Link hereinkommt (etwa die Nachfassen-Kachel), landet auf einer Liste,
 * deren aktiver Filter rechts ausserhalb des Bildes steht. Die Liste zeigt
 * dann gefilterte Angebote, ohne dass sichtbar wäre, wonach gefiltert wird.
 *
 * Deshalb die einzige Zeile JavaScript hier: beim Öffnen den aktiven Filter
 * ins Bild holen. Ohne JavaScript bleibt die Leiste normal bedienbar, nur
 * eben nicht vorgescrollt.
 */
export function Filterleiste({ children }: { children: React.ReactNode }) {
  const leiste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const aktiv = leiste.current?.querySelector<HTMLElement>('[aria-current="true"]');
    // `inline: "nearest"` scrollt nur, wenn nötig — sonst ruckelt die Seite
    // bei jedem Öffnen, obwohl schon alles zu sehen ist.
    aktiv?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, []);

  return (
    <div
      ref={leiste}
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
    >
      {children}
    </div>
  );
}
