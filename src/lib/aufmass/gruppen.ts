import { EINHEIT_LABEL, type AufmassPosition, type Einheit } from "@/types/database";

/**
 * =============================================================================
 * Vom Aufmass zur Kalkulation
 * =============================================================================
 * Ein Aufmass besteht aus vielen einzelnen Massen — vier Wände, ein Boden,
 * zwei Fensterabzüge. Ein Angebot besteht aus wenigen Positionen mit einer
 * Menge. Dazwischen liegt genau ein Schritt: zusammenzählen, was zusammen
 * gehört.
 *
 * GRUPPIERT WIRD NACH RAUM UND EINHEIT. Quadratmeter Wand und Quadratmeter
 * Boden im selben Raum landen also in einer Gruppe — das ist gewollt, denn
 * beides wird als Fläche kalkuliert, und wer sie trennen will, legt zwei
 * Aufmasse an oder benennt die Räume feiner ("Bad Wand", "Bad Boden").
 *
 * ABZÜGE WERDEN ABGEZOGEN, nicht weggelassen. Sie bleiben als eigene Zeile
 * sichtbar, damit im Angebot nachvollziehbar ist, warum 38 m² und nicht 42
 * berechnet werden — die Frage stellt jeder Kunde, der selbst nachmisst.
 *
 * WELCHE LEISTUNG DAZU GEHÖRT, entscheidet der Handwerker. Das Aufmass weiss
 * nicht, ob 42 m² Wand Fliesen, Putz oder Farbe sind. Das zu raten wäre die
 * Sorte Bequemlichkeit, die ein falsches Angebot erzeugt.
 */

export interface Gruppe {
  /** Stabiler Schlüssel aus Raum und Einheit. */
  id: string;
  raum: string | null;
  einheit: Einheit;
  /** Summe der Masse, Abzüge bereits abgezogen. */
  menge: number;
  /** Was darin steckt — wird als Beschreibung ins Angebot übernommen. */
  einzelheiten: string;
  /** Wie viele Messungen dahinterstehen. */
  anzahlMessungen: number;
  /** Ist mindestens eine davon noch zu prüfen? */
  zuPruefen: boolean;
}

type Messzeile = Pick<
  AufmassPosition,
  | "raum"
  | "bezeichnung"
  | "einheit"
  | "wert"
  | "abzug"
  | "zu_pruefen"
  | "art"
  | "laenge"
  | "breite"
  | "hoehe"
  | "anzahl"
>;

/** Zahl in deutscher Schreibweise, ohne unnötige Nullen: 2,4 statt 2,400. */
function zahl(wert: number): string {
  return wert
    .toFixed(3)
    .replace(/\.?0+$/, "")
    .replace(".", ",");
}

/** "2,40 × 1,80" beziehungsweise "3 × 1,20 × 1,40". */
export function masseText(m: Messzeile): string {
  const teile: string[] = [];
  if (m.anzahl !== 1) teile.push(zahl(m.anzahl));
  if (m.laenge !== null) teile.push(zahl(m.laenge));
  if (m.breite !== null) teile.push(zahl(m.breite));
  if (m.hoehe !== null) teile.push(zahl(m.hoehe));
  return teile.join(" × ");
}

/** Der gerechnete Wert mit Einheit: "4,32 m²". */
export function wertText(m: Pick<Messzeile, "wert" | "einheit">): string {
  if (m.wert === null) return "—";
  return `${zahl(m.wert)} ${EINHEIT_LABEL[m.einheit]}`;
}

export function gruppiere(messungen: Messzeile[]): Gruppe[] {
  const karte = new Map<string, Gruppe>();

  for (const m of messungen) {
    // Ohne Wert ist nichts zu rechnen — die Zeile ist unvollständig und
    // wurde im Bildschirm schon als zu prüfen markiert.
    if (m.wert === null) continue;

    const id = `${m.raum ?? ""}|${m.einheit}`;
    const vorhanden = karte.get(id);
    const beitrag = m.abzug ? -m.wert : m.wert;
    const zeile = `${m.abzug ? "− " : ""}${m.bezeichnung || "Messung"}${
      masseText(m) ? ` ${masseText(m)}` : ""
    }`;

    if (vorhanden) {
      vorhanden.menge = runde(vorhanden.menge + beitrag);
      vorhanden.einzelheiten += `, ${zeile}`;
      vorhanden.anzahlMessungen += 1;
      vorhanden.zuPruefen ||= m.zu_pruefen;
    } else {
      karte.set(id, {
        id,
        raum: m.raum,
        einheit: m.einheit,
        menge: runde(beitrag),
        einzelheiten: zeile,
        anzahlMessungen: 1,
        zuPruefen: m.zu_pruefen,
      });
    }
  }

  // Sortiert wie im Aufmass gemessen: Räume in der Reihenfolge ihres ersten
  // Auftretens. Eine alphabetische Liste würde die Reihenfolge zerreissen,
  // in der er durchs Haus gegangen ist.
  return [...karte.values()];
}

function runde(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}

/** Vorschlag für die Bezeichnung im Angebot, solange keine gewählt ist. */
export function gruppenName(g: Gruppe): string {
  const art =
    g.einheit === "m2"
      ? "Fläche"
      : g.einheit === "m3"
        ? "Volumen"
        : g.einheit === "m"
          ? "Länge"
          : "Stück";
  return g.raum ? `${g.raum}: ${art}` : art;
}
