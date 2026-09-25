import type { MessungArt } from "@/types/database";

/**
 * =============================================================================
 * Gesprochene Masse verstehen
 * =============================================================================
 * "Wand 1: 5 Meter mal 2,50 Meter" braucht kein Sprachmodell. Es braucht
 * einen Parser und Tests — und hat davon drei Vorteile, die im Alltag zählen:
 *
 *  1. SOFORT. Das Ergebnis steht da, bevor der Handwerker den Zollstock
 *     zusammengeklappt hat. Eine Runde zum Modell und zurück dauert Sekunden,
 *     und die fallen bei dreissig Messungen hintereinander auf.
 *  2. KOSTENLOS. Dreissig Messungen sind dreissig Aufrufe. Beim Modell wäre
 *     das die Marge.
 *  3. PRÜFBAR. Ein Parser lässt sich mit echten Sätzen testen. Ein Modell
 *     lässt sich nur hoffen.
 *
 * Die KI ist der Rückfall für das, was hier durchfällt — nicht der Normalweg.
 * Das ist dieselbe Regel wie bei den Preisen: was die Datenbank sicher weiss,
 * fragen wir nicht das Modell.
 *
 * WAS ER VERSTEHEN MUSS, kommt von der Baustelle und nicht aus dem Lehrbuch:
 *
 *   "Wand 1: 5 Meter mal 2,50 Meter"        Fläche mit Bezeichnung
 *   "Bad Boden 3,20 auf 2,40"               "auf" statt "mal"
 *   "Wohnzimmer Decke 4 x 5"                Ziffer x Ziffer, ohne Einheit
 *   "Sockelleiste 12 Meter 50"              Nachkommastelle nachgeschoben
 *   "drei Fenster je 1,20 mal 1,40"         Anzahl
 *   "abzüglich Tür 90 mal 2,10"             Abzug, Zentimeter
 *   "Raum Bad: 2,20 mal 1,80 mal 2,50"      Volumen (drei Masse)
 *   "vier Steckdosen"                       Stückzahl ohne Mass
 *
 * Whisper liefert Zahlen meistens als Ziffern ("5 Meter mal 2,50 Meter"),
 * manchmal aber ausgeschrieben ("fünf Meter"). Beides wird abgedeckt.
 */

export interface Messung {
  raum: string | null;
  bezeichnung: string;
  art: MessungArt;
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  anzahl: number;
  abzug: boolean;
  /** Der Parser war sich nicht sicher — im Bildschirm gelb markieren. */
  zuPruefen: boolean;
}

/** Ausgeschriebene Zahlen, wie sie tatsächlich gesprochen werden. */
const ZAHLWORT: Record<string, number> = {
  null: 0, ein: 1, eine: 1, eins: 1, zwei: 2, drei: 3, vier: 4, fuenf: 5,
  sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, zwoelf: 12,
  dreizehn: 13, vierzehn: 14, fuenfzehn: 15, sechzehn: 16, siebzehn: 17,
  achtzehn: 18, neunzehn: 19, zwanzig: 20, dreissig: 30, vierzig: 40,
  fuenfzig: 50, sechzig: 60, siebzig: 70, achtzig: 80, neunzig: 90,
  hundert: 100,
};

/** Wörter, die ein Mass vom nächsten trennen. */
const MAL = /\b(?:mal|auf|x|×|zu)\b/;

/** Kennzeichnet einen Abzug. */
const ABZUG = /\b(?:abz(?:ü|ue)glich|abzug|minus|ohne|weniger)\b/i;

/** Kennzeichnet eine Wiederholung gleicher Masse: "je", "jeweils", "à". */
const JE = /\b(?:je|jeweils|a|à)\b/i;

/**
 * Umlaute vereinheitlichen, damit Zahlwörter und Schlüsselwörter auch dann
 * greifen, wenn die Transkription "fuenf" statt "fünf" schreibt.
 */
function ohneUmlaut(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");
}

/**
 * Eine gesprochene Zahl in eine echte verwandeln.
 *
 * Der heikle Teil sind die Kommastellen. Deutsch gesprochen kommt beides vor:
 * "2,50" (Whisper schreibt das Komma) und "zwei Meter fünfzig" (die
 * Nachkommastelle folgt der Einheit). Letzteres wird an anderer Stelle
 * zusammengesetzt; hier geht es um eine einzelne Zahl.
 */
function zahl(roh: string): number | null {
  const text = ohneUmlaut(roh.trim());
  if (!text) return null;

  // Ziffern: "2,50" oder "2.50" oder "250"
  const ziffern = text.match(/^(\d+)(?:[.,](\d+))?$/);
  if (ziffern) {
    return Number(`${ziffern[1]}.${ziffern[2] ?? "0"}`);
  }

  // Ein einzelnes Zahlwort.
  if (text in ZAHLWORT) return ZAHLWORT[text];

  // Zusammengesetzt: "zweiundzwanzig", "einundfuenfzig"
  const zusammen = text.match(/^(\w+?)und(\w+)$/);
  if (zusammen) {
    const einer = ZAHLWORT[zusammen[1]];
    const zehner = ZAHLWORT[zusammen[2]];
    if (einer !== undefined && zehner !== undefined) return zehner + einer;
  }

  return null;
}

/**
 * Masse aus einem Satz ziehen — mit ihrer Einheit, denn "90 mal 2,10" ist
 * eine Tür in Zentimetern und Metern gemischt, und das ist auf der Baustelle
 * völlig normal gesprochen.
 */
interface RohMass {
  wert: number;
  /** Stand eine Einheit dabei? cm und mm werden auf Meter gebracht. */
  einheitGenannt: boolean;
}

const ZAHL_MIT_EINHEIT = new RegExp(
  // Zahl (Ziffern oder Wort), optional Einheit, optional nachgeschobene
  // Nachkommastelle ("5 Meter 50").
  String.raw`(\d+(?:[.,]\d+)?|[a-zäöüß]+)\s*` +
    // \b nach der Einheit ist Pflicht: ohne sie passt das "m" auf das "m"
    // von "mal", und aus "90 mal 2,10" wird eine Angabe in Metern statt in
    // Zentimetern — also das Hundertfache.
    String.raw`(zentimeter|zm|cm|millimeter|mm|meter|metern|m)?\b` +
    String.raw`(?:\s+(\d{1,2}))?`,
  "gi",
);

function masse(satz: string): RohMass[] {
  const gefunden: RohMass[] = [];

  for (const treffer of satz.matchAll(ZAHL_MIT_EINHEIT)) {
    const grund = zahl(treffer[1]);
    if (grund === null) continue;

    const einheit = treffer[2] ? ohneUmlaut(treffer[2]) : null;
    const nachkomma = treffer[3];

    let wert = grund;

    // "5 Meter 50" -> 5,50. Nur sinnvoll, wenn eine Einheit dazwischen stand;
    // sonst wären "3 Fenster 2" zwei getrennte Angaben.
    if (nachkomma && einheit) {
      wert = grund + Number(`0.${nachkomma.padEnd(2, "0")}`);
    }

    if (einheit === "zentimeter" || einheit === "cm" || einheit === "zm") {
      wert = wert / 100;
    } else if (einheit === "millimeter" || einheit === "mm") {
      wert = wert / 1000;
    }

    gefunden.push({ wert, einheitGenannt: Boolean(einheit) });
  }

  return gefunden;
}

/**
 * Mass ohne genannte Einheit plausibel machen.
 *
 * "Tür 90 mal 2,10" meint 0,90 m — niemand baut eine Tür von 90 Metern. Ab
 * 25 aufwärts ohne Einheit und ohne Komma sind es Zentimeter. Die Grenze ist
 * bewusst grosszügig: eine Halle mit 24 Metern Länge gibt es, eine Wand mit
 * 30 Metern auch, aber die spricht man dann mit Einheit.
 */
function plausibel(mass: RohMass): { wert: number; unsicher: boolean } {
  if (mass.einheitGenannt) return { wert: mass.wert, unsicher: false };
  if (Number.isInteger(mass.wert) && mass.wert >= 25 && mass.wert <= 999) {
    return { wert: mass.wert / 100, unsicher: true };
  }
  return { wert: mass.wert, unsicher: false };
}

/**
 * Die Bezeichnung ist alles vor dem ersten Mass — ohne Füllwörter.
 * Aus "Wand 1: 5 Meter mal 2,50" wird "Wand 1".
 */
function bezeichnungAus(satz: string): { raum: string | null; text: string } {
  // Bis zum Doppelpunkt, sonst bis zur ersten Zahl.
  const bisDoppelpunkt = satz.match(/^([^:]{1,60}):/);
  let kopf = bisDoppelpunkt
    ? bisDoppelpunkt[1]
    : (satz.match(/^([^\d]{1,60}?)(?=\s*\d)/)?.[1] ?? "");

  kopf = kopf
    .replace(ABZUG, "")
    .replace(/\b(?:und|dann|noch|jetzt|also|so|ähm|ehm)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;.]+$/, "");

  // "Bad Wand 1" -> Raum "Bad", Bezeichnung "Wand 1". Nur wenn vorne ein
  // bekanntes Raumwort steht; sonst rät man dem Handwerker sein Wort um.
  const raumWort =
    /^(bad|k(?:ü|ue)che|wohnzimmer|schlafzimmer|kinderzimmer|flur|diele|keller|dachboden|garage|wc|g(?:ä|ae)ste-?wc|treppenhaus|b(?:ü|ue)ro|werkstatt|halle|terrasse|balkon|abstellraum|hauswirtschaftsraum|hwr)\b\s*/i;
  const raumTreffer = kopf.match(raumWort);
  if (raumTreffer && kopf.length > raumTreffer[0].length) {
    return {
      raum: gross(raumTreffer[1]),
      text: gross(kopf.slice(raumTreffer[0].length).trim()),
    };
  }

  return { raum: null, text: gross(kopf) };
}

/**
 * Was nach der Zahl kommt — für Sätze, die mit ihr anfangen.
 * Aus "vier Steckdosen" wird "Steckdosen".
 */
function nachZahl(satz: string): string {
  const ohne = satz
    .replace(ABZUG, "")
    .trim()
    .replace(/^(?:\d+(?:[.,]\d+)?|[a-zäöüßA-ZÄÖÜ]+)\s+/, "")
    .trim();
  return ohne ? gross(ohne) : "Messung";
}

function gross(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Eine gesprochene Messung deuten.
 *
 * Gibt `null` zurück, wenn gar nichts Brauchbares darin steht — dann fragt
 * der Aufrufer das Sprachmodell. Ein falsches Mass wäre schlimmer als eine
 * ehrliche Rückfrage.
 */
export function parseMessung(gesprochen: string): Messung | null {
  const satz = gesprochen.trim();
  if (!satz) return null;

  const normal = ohneUmlaut(satz);
  const abzug = ABZUG.test(satz);

  // Anzahl: "drei Fenster je 1,20 mal 1,40" — die 3 gehört nicht zu den
  // Massen. Erkannt wird sie nur mit "je"/"jeweils", weil sonst jede
  // Hausnummer in der Bezeichnung zur Stückzahl würde.
  let anzahl = 1;
  let rest = satz;
  const jeStelle = satz.search(new RegExp(JE.source, "i"));
  if (jeStelle > 0) {
    const zahlen = masse(satz.slice(0, jeStelle));
    if (zahlen.length > 0) {
      anzahl = zahlen[zahlen.length - 1].wert;
      // Gemessen wird nur, was NACH dem "je" steht. Sonst zählt die Anzahl
      // selbst als Mass, und aus "drei Fenster je 1,20 mal 1,40" wird ein
      // Volumen von 3 × 1,20 × 1,40.
      rest = satz.slice(jeStelle);
    }
  }

  // Alles vor einem Doppelpunkt ist Bezeichnung, nie Mass.
  const gemessen = rest.replace(/^[^:]{1,60}:/, " ");

  /**
   * Wie viele Masse gehören zusammen? Das sagen die Trennwörter, nicht die
   * Anzahl der Zahlen im Satz: "Wand 1 fünf Meter mal 2,50" enthält drei
   * Zahlen, aber nur ein "mal" — also zwei Masse, und die 1 gehört zur
   * Bezeichnung. Gezählt wird von hinten, weil die Masse am Satzende stehen
   * und die Bezeichnung am Anfang.
   */
  const trenner = gemessen.match(new RegExp(ohneUmlaut(MAL.source), "gi"))?.length ?? 0;
  const alle = masse(gemessen);
  const roh = trenner > 0 ? alle.slice(-(trenner + 1)) : alle;

  const { raum, text } = bezeichnungAus(satz);
  const bezeichnung = text || (abzug ? "Abzug" : "Messung");

  if (roh.length === 0) return null;

  // Eine einzelne Zahl OHNE Einheit ist gezählt, nicht gemessen: "vier
  // Steckdosen". Mit Einheit ist es ein laufender Meter: "12 Meter 50".
  // Die Unterscheidung steht und fällt mit dem gesprochenen "Meter" — und
  // genau so spricht man es auch.
  if (roh.length === 1 && !roh[0].einheitGenannt && Number.isInteger(roh[0].wert)) {
    return {
      raum,
      bezeichnung: bezeichnung === "Messung" ? nachZahl(satz) : bezeichnung,
      art: "stueck",
      laenge: null, breite: null, hoehe: null,
      anzahl: roh[0].wert, abzug, zuPruefen: false,
    };
  }

  // Zwei oder drei Masse, getrennt durch "mal"/"auf"/"x" -> Fläche/Volumen.
  const getrennt = trenner > 0;
  const werte = roh.map(plausibel);
  const unsicher = werte.some((w) => w.unsicher);

  if (getrennt && werte.length >= 3) {
    return {
      raum, bezeichnung, art: "volumen",
      laenge: werte[0].wert, breite: werte[1].wert, hoehe: werte[2].wert,
      anzahl, abzug, zuPruefen: unsicher,
    };
  }

  if (getrennt && werte.length === 2) {
    return {
      raum, bezeichnung, art: "flaeche",
      laenge: werte[0].wert, breite: werte[1].wert, hoehe: null,
      anzahl, abzug, zuPruefen: unsicher,
    };
  }

  if (werte.length === 1) {
    // Ein einzelnes Mass mit Einheit ist ein laufender Meter.
    return {
      raum, bezeichnung, art: "laenge",
      laenge: werte[0].wert, breite: null, hoehe: null,
      anzahl, abzug, zuPruefen: unsicher,
    };
  }

  // Mehrere Zahlen ohne Trennwort: nicht raten, sondern fragen lassen.
  return null;
}

/**
 * Der gerechnete Wert — dieselbe Regel wie die generierte Spalte in 0012.
 *
 * Gerundet wird auf drei Nachkommastellen, weil die Datenbankspalte
 * numeric(12,3) ist. Ohne das Runden zeigt der Bildschirm 1,8900000000000001,
 * wo die Datenbank 1,890 gespeichert hat — und spätestens beim Vergleich von
 * Aufmass und Angebot fragt jemand, welcher der beiden Werte stimmt.
 */
export function messwert(m: {
  art: MessungArt;
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  anzahl: number;
}): number | null {
  const { art, laenge, breite, hoehe, anzahl } = m;

  if (art === "stueck") return runde(anzahl);
  if (art === "laenge") {
    return laenge === null ? null : runde(anzahl * laenge);
  }
  if (art === "flaeche") {
    return laenge === null || breite === null
      ? null
      : runde(anzahl * laenge * breite);
  }
  return laenge === null || breite === null || hoehe === null
    ? null
    : runde(anzahl * laenge * breite * hoehe);
}

/** Auf drei Nachkommastellen, wie numeric(12,3). */
function runde(wert: number): number {
  return Math.round(wert * 1000) / 1000;
}
