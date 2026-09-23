"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * Abo abschliessen oder verwalten.
 *
 * Beides führt zu Stripe — die Seite dort ist der sicherste Ort für
 * Karten- und Rechnungsdaten und bringt Kündigung sowie Rechnungsarchiv
 * fertig mit.
 */
export function AboAktionen({
  aktiv,
  hatKunde,
}: {
  aktiv: boolean;
  hatKunde: boolean;
}) {
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function los(pfad: string) {
    setLaedt(true);
    setFehler(null);
    try {
      const antwort = await fetch(pfad, { method: "POST" });
      const ergebnis = await antwort.json();
      if (ergebnis.url) {
        window.location.href = ergebnis.url;
        return;
      }
      setFehler(ergebnis.fehler ?? "Das hat gerade nicht geklappt.");
    } catch {
      setFehler("Keine Verbindung. Bitte später nochmal.");
    }
    setLaedt(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        variante="akzent"
        vollbreit
        disabled={laedt}
        onClick={() => los(aktiv || hatKunde ? "/api/stripe/portal" : "/api/stripe/checkout")}
      >
        {laedt
          ? "Einen Moment…"
          : aktiv
            ? "Abo verwalten"
            : hatKunde
              ? "Zahlung fortsetzen"
              : "Jetzt abonnieren"}
      </Button>

      {!aktiv && hatKunde ? (
        <button
          type="button"
          onClick={() => los("/api/stripe/checkout")}
          disabled={laedt}
          className="min-h-11 text-sm font-medium text-text-invers/70 underline underline-offset-2"
        >
          Neues Abo starten
        </button>
      ) : null}

      {fehler ? (
        <p className="rounded-feld bg-warnung-flaeche px-3 py-2 text-sm text-warnung">
          {fehler}
        </p>
      ) : null}
    </div>
  );
}
