/**
 * Ist dieses Stripe-Ereignis älter als das zuletzt verarbeitete?
 *
 * Stripe garantiert die Zustellung, nicht die Reihenfolge. Ein
 * Wiederholungsversuch eines alten Ereignisses kann nach einem neueren
 * eintreffen. Ohne diese Prüfung würde ein "unbezahlt" von vor zwei Minuten
 * jemanden herabstufen, dessen Zahlung längst durch ist — und er stünde
 * mitten im Arbeitstag vor einer Bezahlschranke.
 *
 * Gleiche Zeit gilt als nicht veraltet: Stripe schickt bei einem Vorgang
 * mehrere Ereignisse mit demselben Zeitstempel, und die gehören alle
 * verarbeitet.
 */
export function istVeraltet(
  /** Was zuletzt verarbeitet wurde, ISO-Zeit oder null beim ersten Mal. */
  zuletzt: string | null | undefined,
  /** `created` des Ereignisses — Sekunden seit 1970, wie Stripe es liefert. */
  ereignisSekunden: number,
): boolean {
  if (!zuletzt) return false;
  const gespeichert = Date.parse(zuletzt);
  if (Number.isNaN(gespeichert)) return false;
  return ereignisSekunden * 1000 < gespeichert;
}

/** Der Zeitstempel eines Ereignisses als ISO-Zeit für die Datenbank. */
export function ereignisZeit(ereignisSekunden: number): string {
  return new Date(ereignisSekunden * 1000).toISOString();
}
