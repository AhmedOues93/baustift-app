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

export async function transkribiere(audio: File): Promise<Transkript> {
  const openai = new OpenAI({ apiKey: serverEnv().openaiApiKey });

  const ergebnis = await openai.audio.transcriptions.create({
    file: audio,
    model: "whisper-1",
    // Sprache fix auf Deutsch: verhindert, dass Whisper bei kurzen Aufnahmen
    // oder starkem Dialekt auf Englisch umschaltet.
    language: "de",
    // Der Prompt gibt Whisper das Vokabular vor. Ohne ihn wird aus "Fliesen"
    // gerne "Fliegen" und aus "Vorwandinstallation" Unsinn.
    prompt:
      "Angebot im Handwerk. Fachbegriffe: Fliesen, Estrich, Dusche, Badewanne, " +
      "Waschtisch, Armatur, Vorwandinstallation, Trockenbau, Silikonfugen, " +
      "Abdichtung, Quadratmeter, laufender Meter, Stunden, Pauschale.",
    // verbose_json statt text: liefert zusätzlich die Dauer, die wir für die
    // Kostenerfassung brauchen.
    response_format: "verbose_json",
  });

  return {
    text: ergebnis.text.trim(),
    sekunden: Math.round(ergebnis.duration ?? 0),
  };
}
