import "server-only";

import OpenAI from "openai";

import { serverEnv } from "@/lib/env";

/**
 * Sprachaufnahme → deutscher Text (Whisper).
 *
 * Läuft ausschliesslich serverseitig — der OpenAI-Key darf nie ins Browser-
 * Bundle. Das Audio kommt als `File` aus dem Upload-Handler.
 */

export interface Transkript {
  text: string;
  /** Dauer in Sekunden — Grundlage für die Kostenabrechnung. */
  sekunden: number;
}

/** Whisper nimmt höchstens 25 MB pro Datei. */
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

/**
 * Deckel für die Aufnahmedauer. Ein Angebot beschreibt man in zwei Minuten;
 * alles darüber ist eher ein vergessener Aufnahmeknopf in der Hosentasche —
 * und der kostet dann bares Geld.
 */
export const AUDIO_MAX_SEKUNDEN = 10 * 60;

/**
 * Vokabular je Vorgang.
 *
 * Der Prompt gibt Whisper vor, womit zu rechnen ist. Ohne ihn wird aus
 * "Fliesen" gerne "Fliegen". Beim Aufmass geht es um etwas anderes als beim
 * Angebot: dort sind es Fachbegriffe, hier sind es Zahlen und Masseinheiten —
 * und ein falsch gehörtes "zwei Komma fünfzig" ist teurer als ein falsch
 * gehörtes Fachwort, weil es niemandem auffällt.
 */
const VOKABULAR = {
  angebot:
    "Angebot im Handwerk. Fachbegriffe: Fliesen, Estrich, Dusche, Badewanne, " +
    "Waschtisch, Armatur, Vorwandinstallation, Trockenbau, Silikonfugen, " +
    "Abdichtung, Quadratmeter, laufender Meter, Stunden, Pauschale.",
  aufmass:
    "Aufmass auf der Baustelle. Gesprochen werden Masse in Metern und " +
    "Zentimetern, zum Beispiel: Wand 1: 5 Meter mal 2,50 Meter. " +
    "Bad Boden: 3,20 auf 2,40. Abzüglich Tür 90 mal 2,10. " +
    "Sockelleiste 12 Meter 50. Drei Fenster je 1,20 mal 1,40.",
} as const;

export type Vokabular = keyof typeof VOKABULAR;

export async function transkribiere(
  audio: File,
  vokabular: Vokabular = "angebot",
): Promise<Transkript> {
  const openai = new OpenAI({ apiKey: serverEnv().openaiApiKey });

  const ergebnis = await openai.audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
    // Sprache fix auf Deutsch: verhindert, dass Whisper bei kurzen Aufnahmen
    // oder starkem Dialekt auf Englisch umschaltet.
    language: "de",
    prompt: VOKABULAR[vokabular],
    // verbose_json statt text: liefert zusätzlich die Dauer, die wir für die
    // Kostenerfassung brauchen.
    response_format: "verbose_json",
  });

  return {
    text: ergebnis.text.trim(),
    sekunden: Math.round(ergebnis.duration ?? 0),
  };
}
