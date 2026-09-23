/**
 * Abo-Modell an einer Stelle.
 *
 * Preise und Kontingente stehen bewusst im Code und nicht in der Datenbank:
 * sie ändern sich selten, müssen aber an fünf Stellen gleich sein (Abo-Seite,
 * Konto, Kontingentprüfung, Stripe, PDF-Fusszeile). Eine Konstante ist dafür
 * zuverlässiger als fünf Abfragen.
 */

/** Zustände, die `profiles.subscription_status` annehmen kann. */
export type AboStatus = "trial" | "aktiv" | "gekuendigt" | "pausiert";

/**
 * Wie viele Angebote pro Kalendermonat.
 *
 * Der Sinn ist nicht Geiz, sondern Kostenschutz: jedes Angebot kostet uns
 * echtes Geld bei Whisper und Claude. Ohne Deckel kann ein einzelnes Konto
 * (oder ein Skript) die Marge auffressen. Die Grenze liegt so hoch, dass ein
 * normaler Betrieb sie nie sieht.
 */
export const KONTINGENT: Record<string, number> = {
  trial: 10,
  aktiv: 200,
  gekuendigt: 0,
  pausiert: 0,
};

export const PREIS_MONATLICH_EUR = 39;

export function planName(status: string): string {
  switch (status) {
    case "aktiv":
      return "Baustift Pro";
    case "gekuendigt":
      return "Gekündigt";
    case "pausiert":
      return "Pausiert";
    default:
      return "Testphase";
  }
}

/** Darf dieser Betrieb gerade ein weiteres Angebot erzeugen? */
export function darfAngebotErstellen(
  status: string,
  verbrauchtDiesenMonat: number,
): { erlaubt: boolean; grund?: string } {
  const grenze = KONTINGENT[status] ?? KONTINGENT.trial;

  if (grenze === 0) {
    return {
      erlaubt: false,
      grund:
        "Dein Abo ist nicht aktiv. Schliesse es ab, um weiter Angebote zu erstellen.",
    };
  }

  if (verbrauchtDiesenMonat >= grenze) {
    return {
      erlaubt: false,
      grund:
        status === "trial"
          ? `In der Testphase sind ${grenze} Angebote enthalten. Schliesse das Abo ab, um weiterzumachen.`
          : `Du hast diesen Monat ${grenze} Angebote erstellt. Melde dich bei uns, wenn du mehr brauchst.`,
    };
  }

  return { erlaubt: true };
}
