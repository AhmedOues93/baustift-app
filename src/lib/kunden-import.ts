/**
 * CSV-Import für Kunden.
 *
 * Wie bei der Preisliste: fast jeder Betrieb hat seine Kundenliste schon
 * irgendwo — in Excel, im alten Programm, im Adressbuch. Sie von Hand
 * abzutippen macht niemand, und ohne Kunden bleibt jedes Angebot ohne
 * Empfänger.
 *
 * Die Zerlegung der Datei teilt sich den Code mit dem Preislisten-Import
 * (Trennzeichen erkennen, Anführungszeichen, BOM) — zwei eigene Parser
 * würden auseinanderlaufen, und der zweite hätte die Fehler des ersten noch
 * einmal.
 */

import { erkenneTrenner, findeSpalte, zerlege } from "@/lib/preisliste-import";

export interface KundenImportZeile {
  name: string;
  ansprechpartner: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  notizen: string | null;
}

export interface KundenImportErgebnis {
  zeilen: KundenImportZeile[];
  fehler: { zeile: number; grund: string }[];
}

/** Schreibweisen, unter denen eine Spalte auftauchen kann. */
const SPALTEN = {
  name: ["name", "kunde", "firma", "kundenname", "nachname", "bezeichnung"],
  ansprechpartner: ["ansprechpartner", "kontakt", "ansprechperson", "vorname"],
  strasse: ["strasse", "straße", "adresse", "anschrift", "str"],
  plz: ["plz", "postleitzahl"],
  ort: ["ort", "stadt", "wohnort"],
  email: ["email", "e mail", "mail", "emailadresse"],
  telefon: ["telefon", "tel", "telefonnummer", "handy", "mobil", "rufnummer"],
  notizen: ["notizen", "notiz", "bemerkung", "bemerkungen", "info"],
};

export function parseKundenCsv(inhalt: string): KundenImportErgebnis {
  // BOM entfernen — Excel schreibt ihn, und sonst heisst die erste Spalte
  // "﻿Name" und wird nicht erkannt.
  const text = inhalt.replace(/^﻿/, "");
  const zeilen = text.split(/\r?\n/).filter((z) => z.trim() !== "");

  if (zeilen.length < 2) {
    return {
      zeilen: [],
      fehler: [{ zeile: 0, grund: "Die Datei enthält keine Datenzeilen." }],
    };
  }

  const trenner = erkenneTrenner(zeilen[0]);
  const kopf = zerlege(zeilen[0], trenner);

  const idx = {
    name: findeSpalte(kopf, SPALTEN.name),
    ansprechpartner: findeSpalte(kopf, SPALTEN.ansprechpartner),
    strasse: findeSpalte(kopf, SPALTEN.strasse),
    plz: findeSpalte(kopf, SPALTEN.plz),
    ort: findeSpalte(kopf, SPALTEN.ort),
    email: findeSpalte(kopf, SPALTEN.email),
    telefon: findeSpalte(kopf, SPALTEN.telefon),
    notizen: findeSpalte(kopf, SPALTEN.notizen),
  };

  if (idx.name === -1) {
    return {
      zeilen: [],
      fehler: [
        {
          zeile: 1,
          grund:
            "Es fehlt eine Spalte für den Namen. Erwartet wird eine Kopfzeile wie „Name“ oder „Kunde“.",
        },
      ],
    };
  }

  const ergebnis: KundenImportErgebnis = { zeilen: [], fehler: [] };
  const gesehen = new Set<string>();

  for (let i = 1; i < zeilen.length; i++) {
    const felder = zerlege(zeilen[i], trenner);
    const wert = (nr: number) => (nr === -1 ? null : felder[nr]?.trim() || null);

    const name = felder[idx.name]?.trim();
    if (!name) {
      ergebnis.fehler.push({ zeile: i + 1, grund: "Kein Name." });
      continue;
    }

    // Doppelte Zeilen innerhalb derselben Datei überspringen: Exporte aus
    // alten Programmen enthalten sie regelmässig, und doppelte Kunden
    // machen später die Zuordnung im Angebot unübersichtlich.
    const schluessel = name.toLowerCase();
    if (gesehen.has(schluessel)) {
      ergebnis.fehler.push({ zeile: i + 1, grund: `„${name}“ steht doppelt in der Datei.` });
      continue;
    }
    gesehen.add(schluessel);

    ergebnis.zeilen.push({
      name,
      ansprechpartner: wert(idx.ansprechpartner),
      strasse: wert(idx.strasse),
      plz: wert(idx.plz),
      ort: wert(idx.ort),
      email: wert(idx.email),
      telefon: wert(idx.telefon),
      notizen: wert(idx.notizen),
    });
  }

  return ergebnis;
}
