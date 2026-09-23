/**
 * Was ein Angebot an KI-Kosten verursacht.
 *
 * Warum das im Code steht und mitgeschrieben wird: bei einem Abo für 39 €
 * im Monat entscheidet der Verbrauch über die Marge. Ohne Messung weiss man
 * weder, ob der Preis trägt, noch merkt man, wenn ein einzelnes Konto aus dem
 * Ruder läuft. Jeder Lauf landet deshalb in `ki_nutzung`.
 *
 * ACHTUNG: Listenpreise ändern sich. Diese Konstanten sind der Stand bei der
 * Implementierung und gehören beim Kalkulieren gegen die Preisseiten der
 * Anbieter geprüft — sie sind für die Kostenschätzung da, nicht für die
 * Buchhaltung.
 */

/** Grober Umrechnungskurs; für eine Kostenschätzung genau genug. */
const USD_ZU_EUR = 0.92;

/** Preise in US-Dollar je 1 Mio. Token. */
export const MODELL_PREISE = {
  "claude-opus-5": {
    eingabe: 5.0,
    ausgabe: 25.0,
    // Ein Cache-Treffer kostet rund ein Zehntel des normalen Eingabepreises.
    // Genau deshalb liegt der Katalog im gecachten Prompt-Prefix.
    cache: 0.5,
  },
} as const;

/** Whisper kostet pro Minute Audio, nicht pro Token. */
const WHISPER_USD_PRO_MINUTE = 0.006;

/** In Zehntel-Cent, damit ein Lauf für 0,04 € nicht auf 0 gerundet wird. */
function inZehntelcent(usd: number): number {
  return Math.round(usd * USD_ZU_EUR * 1000);
}

export function transkriptionKosten(sekunden: number): number {
  return inZehntelcent((sekunden / 60) * WHISPER_USD_PRO_MINUTE);
}

export function extraktionKosten(args: {
  modell: keyof typeof MODELL_PREISE;
  eingabeToken: number;
  ausgabeToken: number;
  cacheToken: number;
}): number {
  const p = MODELL_PREISE[args.modell];
  const usd =
    (args.eingabeToken / 1_000_000) * p.eingabe +
    (args.ausgabeToken / 1_000_000) * p.ausgabe +
    (args.cacheToken / 1_000_000) * p.cache;
  return inZehntelcent(usd);
}

/** 42 → "0,04 €" — für die Anzeige im Konto. */
export function formatZehntelcent(zehntelcent: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(zehntelcent / 1000);
}
