import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";

import { serverEnv } from "@/lib/env";
import {
  matchePositionen,
  type GematchtePosition,
  type KiPosition,
} from "@/lib/ai/matching";
import type { Einheit, PreislisteEintrag } from "@/types/database";

/**
 * =============================================================================
 * Claude-Integration — Transkript → strukturierte Angebotspositionen
 * =============================================================================
 *
 * DAS PROBLEM
 * Whisper liefert einen Fliesstext wie:
 *   "Also, Bad komplett, ungefähr acht Quadratmeter Fliesen, Dusche raus,
 *    neue Duschwanne rein, und den Waschtisch tauschen wir auch."
 * Daraus muss werden: Positionen mit Menge, Einheit und Preis.
 *
 * WARUM CLAUDE UND NICHT REGEX
 * "acht Quadratmeter" → 8 / m², "Dusche raus" → Demontage, "Bad komplett"
 * impliziert mehrere Gewerke. Das ist Sprachverständnis, kein Parsing.
 *
 * DIE VIER ENTSCHEIDUNGEN IN DIESER DATEI
 *
 *  1. STRUCTURED OUTPUTS statt "gib mir JSON zurück"
 *     `output_config.format` mit einem Zod-Schema erzwingt schema-konformes
 *     JSON. Kein Markdown-Fence-Abschneiden, kein JSON.parse in try/catch.
 *
 *  2. KATALOG-KURZ-IDs (K1, K2, …) statt UUIDs
 *     Claude bekommt die Preisliste mit kurzen Referenzen. Gründe: eine UUID
 *     ist ~20 Tokens und lädt zu Tippfehlern ein, "K7" ist ein Token und wird
 *     zuverlässig wiedergegeben. Die Rückübersetzung auf die echte UUID macht
 *     `refToId` unten — eine unbekannte Referenz wird dabei einfach verworfen.
 *
 *  3. PROMPT CACHING auf System-Prompt + Katalog
 *     Beides ist pro Nutzer identisch über alle Angebote hinweg. Mit
 *     `cache_control` zahlt man den Katalog nur beim ersten Angebot voll.
 *     Deshalb steht der variable Teil (das Transkript) auch in der
 *     User-Message und NICHT im System-Prompt: jede Änderung am Prefix würde
 *     den Cache entwerten.
 *
 *  4. PREISE KOMMEN NIE VON CLAUDE
 *     Das Schema hat bewusst kein Preisfeld. Claude liefert nur `katalog_ref`;
 *     den Euro-Betrag setzt `matchePositionen()` aus der Datenbank.
 *     Siehe matching.ts.
 * =============================================================================
 */

/** Opus 5: bestes Verständnis von Fachsprache — hier zählt Genauigkeit. */
const MODELL = "claude-opus-5";

const EINHEITEN = [
  "stk",
  "m",
  "m2",
  "m3",
  "h",
  "tag",
  "pauschal",
  "kg",
  "l",
] as const satisfies readonly Einheit[];

/**
 * Antwortschema. Jedes Feld ist bewusst knapp gehalten — je kleiner das Schema,
 * desto stabiler die Ausgabe. Die Beschreibungen (`.describe()`) landen im
 * JSON-Schema und wirken wie Mini-Prompts pro Feld.
 */
const AngebotSchema = z.object({
  titel: z
    .string()
    .describe("Kurzer Titel des Angebots, z. B. 'Badsanierung Musterstr. 4'"),
  kunde_name: z
    .string()
    .nullable()
    .describe("Name des Kunden, falls im Diktat genannt, sonst null"),
  positionen: z
    .array(
      z.object({
        bezeichnung: z
          .string()
          .describe("Kurze Leistungsbezeichnung, wie sie im Angebot steht"),
        beschreibung: z
          .string()
          .nullable()
          .describe("Optionaler Langtext/Detail, sonst null"),
        menge: z.number().describe("Menge; wenn unklar, 1"),
        einheit: z.enum(EINHEITEN),
        katalog_ref: z
          .string()
          .nullable()
          .describe(
            "Referenz aus der Preisliste, z. B. 'K7'. null, wenn kein Eintrag passt.",
          ),
        konfidenz: z
          .number()
          .describe("Wie sicher ist die Zuordnung? 0.0 bis 1.0"),
      }),
    )
    .describe("Alle erkannten Leistungen, in sinnvoller Reihenfolge"),
  hinweis: z
    .string()
    .nullable()
    .describe(
      "Kurzer Hinweis an den Handwerker, was im Diktat unklar war (deutsch), sonst null",
    ),
});

export interface ExtraktionsErgebnis {
  titel: string;
  /** Für die Verbrauchsprotokollierung. */
  modell: string;
  kundeName: string | null;
  hinweis: string | null;
  positionen: GematchtePosition[];
  /** Für Kostenkontrolle/Monitoring. */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
  };
}

const SYSTEM_PROMPT = `Du bist Kalkulator in einem deutschen Handwerksbetrieb (SHK, Elektro, Fliesen, Trockenbau).

Du bekommst ein Transkript, in dem ein Handwerker eine Baustelle beschreibt, und die Preisliste seines Betriebs. Erstelle daraus die Positionen für ein Angebot.

Regeln:
- Jede eigenständige Leistung wird eine eigene Position. "Bad komplett" ist keine Position, sondern mehrere (z. B. Demontage, Abdichtung, Fliesen, Montage Sanitärobjekte).
- Nutze fast immer die Preisliste: wähle den Eintrag, der die Leistung am besten trifft, und gib seine Referenz in "katalog_ref" an (z. B. "K7").
- Passt kein Eintrag, setze "katalog_ref": null und formuliere die Position trotzdem sauber. Der Handwerker ergänzt den Preis später selbst.
- Erfinde niemals Preise. Es gibt kein Preisfeld — das ist Absicht.
- Mengen: rechne gesprochene Zahlen in Ziffern um ("acht Quadratmeter" -> 8, "m2"). Ist keine Menge genannt, nimm 1 und setze eine niedrige Konfidenz.
- Einheiten: übernimm die Einheit des gewählten Preislisten-Eintrags, wenn das Diktat nichts anderes vorgibt.
- "konfidenz": 0.9+ wenn Leistung und Preislisten-Eintrag klar übereinstimmen, 0.5-0.8 bei Auslegung, unter 0.5 wenn du im Wesentlichen rätst.
- Bezeichnungen sind kundentauglich und fachlich korrekt formuliert, kein Umgangston aus dem Diktat ("Dusche raus" -> "Demontage und Entsorgung Duschabtrennung").
- Schreibe alle Texte auf Deutsch.
- Was du nicht sicher verstanden hast, kommt nach "hinweis" — nicht raten und stillschweigend einbauen.`;

/**
 * Baut den Katalogtext für den Prompt und die Rückübersetzung K-Ref → UUID.
 *
 * Sortierung nach ID sorgt für eine stabile Reihenfolge: nur so ist der
 * gecachte Prompt-Prefix zwischen zwei Anfragen byte-identisch und der
 * Cache greift überhaupt.
 */
function baueKatalog(preisliste: PreislisteEintrag[]) {
  const aktive = preisliste
    .filter((e) => e.aktiv)
    .sort((a, b) => a.id.localeCompare(b.id));

  const refToId = new Map<string, string>();
  const zeilen = aktive.map((e, i) => {
    const ref = `K${i + 1}`;
    refToId.set(ref, e.id);
    // Kompaktes Format statt JSON: spart deutlich Tokens bei gleicher Klarheit.
    const teile = [
      ref,
      e.bezeichnung,
      e.einheit,
      e.kategorie ?? "-",
      e.stichworte.length ? e.stichworte.join("/") : "-",
    ];
    return teile.join(" | ");
  });

  const text =
    zeilen.length > 0
      ? `Preisliste des Betriebs (Referenz | Bezeichnung | Einheit | Kategorie | Stichworte):\n${zeilen.join("\n")}`
      : "Der Betrieb hat noch keine Preisliste gepflegt. Setze überall katalog_ref auf null.";

  return { text, refToId };
}

/**
 * Hauptfunktion: Transkript + Preisliste → fertige, bepreiste Positionen.
 */
export async function extrahiereAngebot(
  transkript: string,
  preisliste: PreislisteEintrag[],
): Promise<ExtraktionsErgebnis> {
  const client = new Anthropic({ apiKey: serverEnv().anthropicApiKey });
  const katalog = baueKatalog(preisliste);

  const antwort = await client.beta.messages.parse({
    model: MODELL,
    max_tokens: 16000,
    // Adaptives Thinking: Claude entscheidet selbst, wie viel es nachdenkt.
    // Bei "Bad komplett, 8 m²" muss es Gewerke auseinanderziehen — das ist
    // genau der Fall, in dem sich Nachdenken auszahlt.
    thinking: { type: "adaptive" },
    // Server-seitiger Fallback: lehnt der Sicherheitsfilter eine Anfrage
    // unerwartet ab, beantwortet Anthropic sie automatisch mit einem anderen
    // Modell, statt dass der Nutzer einen Fehler sieht.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [
      // Zwei Blöcke, beide gecacht: Rollenbeschreibung (für alle Nutzer gleich)
      // und Katalog (pro Betrieb gleich). Der Cache-Breakpoint sitzt am Ende
      // des unveränderlichen Teils.
      { type: "text", text: SYSTEM_PROMPT },
      {
        type: "text",
        text: katalog.text,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Transkript der Sprachnachricht:\n\n"""\n${transkript}\n"""`,
      },
    ],
    output_config: { format: betaZodOutputFormat(AngebotSchema) },
  });

  // Sicherheitsfilter hat abgelehnt (trotz Fallback möglich) — sauber melden,
  // statt auf undefined zuzugreifen.
  if (antwort.stop_reason === "refusal") {
    throw new Error(
      "Die KI hat die Verarbeitung abgelehnt. Bitte formuliere die Sprachnachricht neu.",
    );
  }

  const daten = antwort.parsed_output;
  if (!daten) {
    throw new Error(
      "Die KI-Antwort konnte nicht gelesen werden. Bitte noch einmal versuchen.",
    );
  }

  // K-Referenzen auf echte UUIDs zurückübersetzen. Unbekannte Referenzen
  // (Tippfehler der KI) werden zu null — matchePositionen() sucht dann selbst
  // über Textähnlichkeit weiter.
  const rohPositionen: KiPosition[] = daten.positionen.map((p) => ({
    bezeichnung: p.bezeichnung,
    beschreibung: p.beschreibung,
    menge: Number.isFinite(p.menge) && p.menge > 0 ? p.menge : 1,
    einheit: p.einheit,
    preisliste_id: p.katalog_ref
      ? (katalog.refToId.get(p.katalog_ref.trim().toUpperCase()) ?? null)
      : null,
    konfidenz: p.konfidenz,
  }));

  return {
    titel: daten.titel,
    modell: MODELL,
    kundeName: daten.kunde_name,
    hinweis: daten.hinweis,
    // Hier bekommen die Positionen ihre Preise — aus der Datenbank.
    positionen: matchePositionen(rohPositionen, preisliste),
    usage: {
      inputTokens: antwort.usage.input_tokens,
      outputTokens: antwort.usage.output_tokens,
      cacheReadTokens: antwort.usage.cache_read_input_tokens ?? 0,
    },
  };
}
