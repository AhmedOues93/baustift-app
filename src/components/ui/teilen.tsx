"use client";

import { useState } from "react";

import { IconTeilen } from "@/components/ui/icons";

/**
 * PDF teilen — über WhatsApp, Mail-App, AirDrop, was auch immer auf dem
 * Gerät installiert ist.
 *
 * Warum das im Handwerk wichtiger ist als der E-Mail-Versand aus der App:
 * die meisten Angebote gehen hier per WhatsApp raus. Die Kundin hat dem
 * Handwerker vorhin geschrieben, wo sie wohnt — also antwortet er im selben
 * Verlauf. Eine App, die das nicht kann, wird zwischendurch verlassen: PDF
 * herunterladen, Dateien-App suchen, WhatsApp öffnen, Anhang finden.
 *
 * Der Weg dahin ist die Web Share API. Sie ist auf Android-Chrome und
 * iOS-Safari da, also genau dort, wo dieses Produkt benutzt wird, und sie
 * öffnet das native Teilen-Blatt mit der Datei im Gepäck.
 *
 * Wo sie fehlt (Desktop-Firefox etwa), öffnen wir das PDF einfach — von dort
 * führt jeder Browser weiter. Ein Knopf, der nichts tut, wäre schlimmer als
 * einer, der etwas anderes tut.
 */
export function TeilenKnopf({
  pfad,
  dateiname,
  titel,
  text,
  className = "",
}: {
  /** Route, die das PDF ausliefert. */
  pfad: string;
  dateiname: string;
  /** Betreff im Teilen-Blatt. */
  titel: string;
  /** Begleittext, den die Ziel-App übernimmt. */
  text: string;
  className?: string;
}) {
  const [laedt, setLaedt] = useState(false);

  async function teilen() {
    // Kein Teilen-Blatt vorhanden: PDF öffnen und den Browser übernehmen
    // lassen. Das ist der Desktop-Fall.
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      window.open(pfad, "_blank", "noopener");
      return;
    }

    setLaedt(true);
    try {
      const antwort = await fetch(pfad);
      if (!antwort.ok) throw new Error("PDF nicht erreichbar");
      const blob = await antwort.blob();
      const datei = new File([blob], dateiname, { type: "application/pdf" });

      // Manche Geräte teilen Text, aber keine Dateien. Dann lieber das PDF
      // öffnen, als eine Nachricht ohne Angebot zu verschicken.
      if (!navigator.canShare?.({ files: [datei] })) {
        window.open(pfad, "_blank", "noopener");
        return;
      }

      await navigator.share({ files: [datei], title: titel, text });
    } catch (ausnahme) {
      // Wer das Teilen-Blatt wegwischt, hat keinen Fehler gemacht.
      if (ausnahme instanceof DOMException && ausnahme.name === "AbortError") return;
      // Alles andere: PDF öffnen. Eine Fehlermeldung würde den Handwerker
      // ratlos zurücklassen, das offene PDF bringt ihn weiter.
      window.open(pfad, "_blank", "noopener");
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
