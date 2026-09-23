import "server-only";

import OpenAI from "openai";

import { serverEnv } from "@/lib/env";

/**
 * Sprachaufnahme → deutscher Text (Whisper).
 *
 * Läuft ausschliesslich serverseitig — der OpenAI-Key darf nie ins Browser-
 * Bundle. Das Audio kommt als `File`/`Blob` aus dem Upload-Handler.
 */
export async function transkribiere(audio: File): Promise<string> {
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
    // Reiner Text — Zeitstempel brauchen wir im MVP nicht.
    response_format: "text",
  });

  // Bei response_format "text" liefert das SDK direkt einen String.
  return typeof ergebnis === "string" ? ergebnis.trim() : String(ergebnis).trim();
}
