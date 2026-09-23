"use client";

import { useEffect, useRef } from "react";

/**
 * Bottom Sheet auf dem Handy, zentrierter Dialog ab `sm`.
 *
 * Dasselbe Markup für beide — nur andere Klassen ab dem Breakpoint. Das ist
 * die Regel im ganzen Produkt: ein Bauteil, zwei Darstellungen, nie zwei
 * getrennte Implementierungen, die auseinanderlaufen.
 *
 * Kümmert sich um das, was man sonst dreimal vergisst: Escape schliesst,
 * Hintergrund scrollt nicht mit, Fokus landet im Dialog und kehrt beim
 * Schliessen dorthin zurück, wo er herkam.
 */
export function Sheet({
  titel,
  onSchliessen,
  children,
  fuss,
}: {
  titel: string;
  onSchliessen: () => void;
  children: React.ReactNode;
  /** Optionaler Bereich unter dem Inhalt, z. B. "Löschen". */
  fuss?: React.ReactNode;
}) {
  const inhaltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Fokus merken, um ihn beim Schliessen zurückzugeben — sonst springt der
    // Screenreader an den Seitenanfang.
    const vorher = document.activeElement as HTMLElement | null;

    const ersteEingabe = inhaltRef.current?.querySelector<HTMLElement>(
      "input, select, textarea, button",
    );
    ersteEingabe?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSchliessen();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      vorher?.focus();
    };
  }, [onSchliessen]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Schliessen"
        onClick={onSchliessen}
        className="absolute inset-0 bg-tief/40"
      />

      <div
        ref={inhaltRef}
        role="dialog"
        aria-modal="true"
        aria-label={titel}
        className={[
          "relative flex max-h-[92vh] w-full flex-col overflow-y-auto bg-flaeche shadow-sheet",
          // Nur oben gerundet: das Sheet sitzt bündig auf der Unterkante.
          "rounded-t-sheet px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4",
          "sm:max-w-lg sm:rounded-karte sm:p-6",
        ].join(" ")}
      >
        {/* Griff-Balken: das übliche Signal "nach unten wischen zum Schliessen". */}
        <div className="mx-auto mb-4 h-1.5 w-10 shrink-0 rounded-full bg-linie sm:hidden" />

        <h2 className="text-xl">{titel}</h2>

        {children}

        {fuss ? (
          <div className="mt-6 border-t border-linie pt-4">{fuss}</div>
        ) : null}
      </div>
    </div>
  );
}
