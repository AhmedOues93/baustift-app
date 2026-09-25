import Link from "next/link";

export const metadata = { title: "Nicht gefunden · Baustift" };

/**
 * 404.
 *
 * Erreicht man vor allem über einen alten Link auf ein gelöschtes Angebot —
 * oder weil jemand die Adresse von Hand getippt hat. Ohne diese Seite zeigt
 * Next seine eigene, englische Rohseite ohne Weg zurück.
 */
export default function NichtGefunden() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center">
      <p className="zahl text-5xl font-semibold text-text-leise/40">404</p>
      <h1 className="font-titel text-2xl font-bold tracking-tight text-text">
        Das gibt es nicht (mehr)
      </h1>
      <p className="max-w-sm text-text-leise">
        Vielleicht wurde der Vorgang gelöscht, oder die Adresse stimmt nicht.
      </p>
      <Link
        href="/angebote"
        className="mt-2 inline-flex min-h-12 items-center rounded-gross bg-tief px-6 font-medium text-text-invers transition-colors active:bg-text"
      >
        Zu den Angeboten
      </Link>
    </div>
  );
}
