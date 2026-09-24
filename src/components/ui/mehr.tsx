import Link from "next/link";

/**
 * "Mehr anzeigen" für lange Listen.
 *
 * Als Link mit Suchparameter statt als Knopf mit Zustand: das funktioniert
 * ohne JavaScript, überlebt einen Reload und lässt sich teilen. Auf einem
 * Handy im Funkloch ist das kein akademischer Vorteil.
 *
 * Warum überhaupt begrenzen: nach zwei Jahren Betrieb hat ein Handwerker
 * einige hundert Angebote. Sie alle auf einmal zu rendern macht die Seite
 * langsam und die Liste unbrauchbar — gesucht wird ohnehin oben.
 */
export function MehrAnzeigen({
  gezeigt,
  gesamt,
  schritt = 25,
  /** Die übrigen Suchparameter, damit Suche und Filter erhalten bleiben. */
  parameter = {},
}: {
  gezeigt: number;
  gesamt: number;
  schritt?: number;
  parameter?: Record<string, string | undefined>;
}) {
  if (gezeigt >= gesamt) return null;

  const rest = gesamt - gezeigt;
  const such = new URLSearchParams();
  for (const [schluessel, wert] of Object.entries(parameter)) {
    if (wert) such.set(schluessel, wert);
  }
  such.set("n", String(gezeigt + schritt));

  return (
    <Link
      href={`?${such.toString()}`}
      scroll={false}
      className="mx-auto inline-flex min-h-11 items-center justify-center rounded-gross border border-linie bg-flaeche px-5 text-sm font-medium text-text transition-colors active:bg-papier"
    >
      Weitere <span className="zahl mx-1">{Math.min(rest, schritt)}</span> anzeigen
      <span className="zahl ml-1 text-text-leise">({rest} übrig)</span>
    </Link>
  );
}

/** Wie viele Zeilen die Seite anzeigen soll — aus dem Parameter `n`. */
export function anzahlAusParameter(n: string | undefined, standard = 25): number {
  const wert = Number(n);
  // Keine krummen oder riesigen Werte aus der Adresszeile übernehmen: sonst
  // rendert ?n=999999 die Seite tot.
  if (!Number.isFinite(wert) || wert < standard) return standard;
  return Math.min(Math.floor(wert), 1000);
}
