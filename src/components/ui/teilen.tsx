"use client";

import { useState } from "react";

import { IconTeilen } from "@/components/ui/icons";

/**
 * PDF teilen. Mobile Browser koennen das native Share-Sheet mit Datei oeffnen.
 * Falls Datei-Sharing nicht verfuegbar ist, wird das PDF direkt geoeffnet.
 */
export function TeilenKnopf({
  pfad,
  dateiname,
  titel,
  text,
  className = "",
}: {
  pfad: string;
  dateiname: string;
  titel: string;
  text: string;
  className?: string;
}) {
  const [laedt, setLaedt] = useState(false);

  async function pdfOeffnen() {
    // Nicht window.open() nach einem await benutzen: mobile Browser blockieren
    // solche Popups oft. Ein normaler Navigation-Sprung ist zuverlaessiger.
    window.location.assign(pfad);
  }

  async function teilen() {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      await pdfOeffnen();
      return;
    }

    setLaedt(true);
    try {
      const antwort = await fetch(pfad, {
        credentials: "same-origin",
        cache: "no-store",
      });
      if (!antwort.ok) throw new Error("PDF nicht erreichbar");

      const blob = await antwort.blob();
      const datei = new File([blob], dateiname, { type: "application/pdf" });

      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [datei] })) {
        await pdfOeffnen();
        return;
      }

      await navigator.share({ files: [datei], title: titel, text });
    } catch (ausnahme) {
      if (ausnahme instanceof DOMException && ausnahme.name === "AbortError") return;
      await pdfOeffnen();
    } finally {
      setLaedt(false);
    }
  }

  return (
    <button
      type="button"
      onClick={teilen}
      disabled={laedt}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-gross border border-linie bg-flaeche px-4 font-medium text-text transition-colors active:bg-papier disabled:opacity-60 ${className}`}
    >
      <IconTeilen className="h-5 w-5" />
      <span>{laedt ? "Einen Moment…" : "Teilen"}</span>
    </button>
  );
}
