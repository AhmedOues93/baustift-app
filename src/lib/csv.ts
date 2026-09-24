/**
 * CSV schreiben — für den Datenexport.
 *
 * Bewusst für Excel im deutschsprachigen Raum gebaut, nicht nach RFC:
 *
 *  - **Semikolon** als Trenner. Excel erwartet das hier, weil das Komma schon
 *    der Dezimaltrenner ist. Mit Komma landet die ganze Zeile in Spalte A.
 *  - **BOM** am Anfang. Ohne ihn zeigt Excel aus "Müller" ein "MÃ¼ller".
 *  - **CRLF** als Zeilenende, ebenfalls für Excel.
 *  - Zahlen mit **Komma** als Dezimaltrenner, sonst rechnet Excel nicht damit.
 *
 * Das ist keine Unsauberkeit, sondern der Zweck: die Datei soll sich beim
 * Handwerker per Doppelklick öffnen, nicht in einem Import-Assistenten enden.
 */

export type CsvWert = string | number | boolean | null | undefined;

/** Ein Feld so quoten, dass Trenner, Anführungszeichen und Umbrüche halten. */
function feld(wert: CsvWert): string {
  if (wert === null || wert === undefined) return "";

  if (typeof wert === "number") {
    // Deutsche Schreibweise, damit Excel die Zahl als Zahl erkennt.
    return String(wert).replace(".", ",");
  }
  if (typeof wert === "boolean") return wert ? "ja" : "nein";

  const text = String(wert);
  if (/[";\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function csvZeile(werte: CsvWert[]): string {
  return werte.map(feld).join(";");
}

/**
 * Vollständige CSV-Datei aus Kopfzeile und Datenzeilen.
 * Gibt einen String zurück; das BOM setzt `csvAntwort`.
 */
export function csvDatei(kopf: string[], zeilen: CsvWert[][]): string {
  return [csvZeile(kopf), ...zeilen.map(csvZeile)].join("\r\n") + "\r\n";
}

/** Fertige HTTP-Antwort mit BOM und Download-Namen. */
export function csvAntwort(dateiname: string, inhalt: string): Response {
  return new Response("﻿" + inhalt, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dateiname}"`,
      // Enthält Kundendaten — nirgends zwischenspeichern.
      "Cache-Control": "private, no-store",
    },
  });
}
