"use client";

import { useEffect } from "react";

/**
 * Auffangseite für einen Fehler, der eine Seite abbrechen lässt.
 *
 * Ohne sie zeigt Next im Produktivbetrieb nur "Application error" — auf
 * Englisch, ohne Weg zurück, und der Handwerker steht auf der Baustelle
 * davor. Wichtig ist hier weniger die Erklärung als der Knopf: einmal
 * neu laden hilft in den meisten Fällen wirklich.
 *
 * Der Fehlertext selbst wird bewusst nicht angezeigt. Er hilft niemandem,
 * der ihn liest, und kann Innereien preisgeben; die Kennung reicht, um ihn
 * im Protokoll wiederzufinden.
 */
export default function Fehlerseite({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Landet in den Server-Protokollen und, falls eingerichtet, in Sentry.
    console.error("seite.abgebrochen", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 text-center">
      <h1 className="font-titel text-2xl font-bold tracking-tight text-text">
        Da ist etwas schiefgegangen
      </h1>
      <p className="max-w-sm text-text-leise">
        Deine Daten sind nicht betroffen. Meistens hilft es, es noch einmal zu
        versuchen.
      </p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-12 items-center justify-center rounded-gross bg-akzent px-6 font-medium text-text-invers transition-colors active:bg-akzent-hover"
        >
          Nochmal versuchen
        </button>
        <a
          href="/angebote"
          className="inline-flex min-h-12 items-center justify-center rounded-gross border border-linie bg-flaeche px-6 font-medium text-text transition-colors active:bg-papier"
        >
          Zu den Angeboten
        </a>
      </div>
      {error.digest ? (
        <p className="zahl mt-2 text-xs text-text-leise/70">
          Kennung: {error.digest}
        </p>
      ) : null}
    </div>
  );
}
