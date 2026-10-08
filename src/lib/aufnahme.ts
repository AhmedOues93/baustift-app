/**
 * =============================================================================
 * Sprachaufnahme — die Regeln, die man nicht sieht
 * =============================================================================
 * Der Aufnahmebildschirm selbst lässt sich nicht sinnvoll testen: er braucht
 * ein Mikrofon, einen MediaRecorder und eine Hand am Telefon. Was sich sehr
 * wohl testen lässt, ist die Logik darin — welches Format genommen wird, ab
 * wann eine Aufnahme überhaupt etwas enthält, wann aufgegeben wird, und wann
 * ein Transkript in Wahrheit Stille war. Genau diese Fälle entscheiden auf der
 * Baustelle darüber, ob das Produkt funktioniert, und genau sie waren bisher
 * nirgends festgehalten.
 */

/**
 * Welches Aufnahmeformat kann dieser Browser?
 *
 * Safari kann kein WebM. Wir fragen den Browser, statt ein Format zu
 * erzwingen — sonst nimmt jedes iPhone stumm nichts auf. Der Prüfer wird
 * hereingereicht, damit die Reihenfolge testbar ist.
 */
export const FORMATE = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
] as const;

export function waehleFormat(kann: (typ: string) => boolean): string {
  for (const typ of FORMATE) {
    if (kann(typ)) return typ;
  }
  // Leerer String heisst: der Browser soll selbst entscheiden. Besser als ein
  // Format zu erzwingen, das er nicht kann — dann nimmt er gar nicht auf.
  return "";
}

/** Dateiendung zum gewählten Format. Whisper geht nach der Endung. */
export function endung(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Ab wann ist überhaupt etwas aufgenommen worden?
 *
 * Es gibt den Fall, dass der MediaRecorder startet, aber kein einziger
 * Datenblock ankommt — abgeschaltetes Mikrofon, belegte Audiohardware, ein
 * Android, das die Aufnahme sofort wieder beendet. Herauskommt ein Blob mit
 * null oder ein paar Byte. Den zu senden kostet einen Whisper-Aufruf und
 * bringt die Meldung "konnte nicht verarbeitet werden" — die dem Handwerker
 * nichts sagt, weil sein Telefon ja scheinbar aufgenommen hat.
 *
 * 2 KB sind grosszügig: eine Sekunde Opus liegt bei etwa 4 KB.
 */
export const MIN_AUFNAHME_BYTES = 2048;

export function aufnahmeBrauchbar(groesse: number): boolean {
  return groesse >= MIN_AUFNAHME_BYTES;
}

/**
 * Wie lange auf den Server gewartet wird, bevor aufgegeben wird.
 *
 * Die Route darf bis zu 120 Sekunden rechnen. Ohne eigene Grenze wartet der
 * Browser im Funkloch aber unbegrenzt: der Bildschirm steht auf "Angebot wird
 * erstellt…", und der einzige Ausweg ist Neuladen — wodurch die Aufnahme
 * verloren geht. Also lieber nach der Zeit der Route plus Puffer abbrechen
 * und "Nochmal senden" anbieten.
 */
export const SENDE_ZEITGRENZE_MS = 150_000;

/**
 * Whisper erfindet bei Stille Untertitel.
 *
 * Das Modell ist unter anderem auf YouTube-Untertiteln trainiert und gibt bei
 * stillem oder reinem Rauschsignal zuverlässig deren Abspann aus. Kommt so
 * ein Satz durch, baut die KI daraus ein Angebot über "Vielen Dank" — und der
 * Handwerker sieht einen Entwurf, den er nie gesprochen hat.
 *
 * Gefiltert wird nur, wenn das GESAMTE Transkript aus solchen Floskeln
 * besteht. Ein echtes Diktat endet vielleicht mit "Vielen Dank", besteht aber
 * nie nur daraus.
 */
const STILLE_FLOSKELN: RegExp[] = [
  // Sender- und Untertitel-Abspann in allen Jahrgängen.
  /^untertitel(ung)?( des| der| im auftrag des| von)?\b.*$/,
  /^amara org.*$/,
  /^copyright (wdr|zdf|ard|swr|br)\b.*$/,
  /^(zdf|ard|swr|wdr|br|arte)( \d{4})?$/,
  /^mit freundlicher unterstutzung\b.*$/,
  // Verabschiedungen aus Videountertiteln.
  /^vielen dank( fur s| furs| fur das)?( zuschauen| zusehen| ihre aufmerksamkeit)?$/,
  /^danke( fur s| furs)?( zuschauen| zusehen)?$/,
  /^das war s( fur heute)?$/,
  /^bis (zum nachsten mal|bald|dann)$/,
  /^(tschuss|auf wiedersehen|ciao)$/,
  // Geräuschmarken und blosse Füllwörter.
  /^(musik|applaus|lachen|stille|gerausche)$/,
  /^(so|und|ja|ah|hm|ok|okay)$/,
];

/** Satzzeichen weg, Umlaute vereinheitlicht — damit der Vergleich greift. */
function vereinfachen(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, "a")
    .replace(/[öÖ]/g, "o")
    .replace(/[üÜ]/g, "u")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * War da in Wahrheit nichts?
 *
 * Wahr, wenn das Transkript leer ist oder restlos aus erfundenen
 * Untertitel-Floskeln besteht.
 */
export function istStille(transkript: string): boolean {
  const text = vereinfachen(transkript);
  if (text === "") return true;

  // Erst als Ganzes — sonst zerschneidet die Satztrennung "Amara.org".
  if (STILLE_FLOSKELN.some((muster) => muster.test(text))) return true;

  // Dann satzweise: Whisper reiht bei längerer Stille mehrere Floskeln.
  // Der Punkt trennt nur mit folgendem Leerraum, damit "Amara.org" und
  // "60x60" nicht auseinanderfallen.
  const saetze = transkript
    .split(/[.!?]+(?=\s|$)|\n+/)
    .map(vereinfachen)
    .filter((s) => s !== "");

  if (saetze.length === 0) return true;
  return saetze.every((satz) => STILLE_FLOSKELN.some((muster) => muster.test(satz)));
}
