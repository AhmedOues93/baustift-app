import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeDb } from "@/test/fake-supabase";

/**
 * =============================================================================
 * Sprachnachricht → Angebotsentwurf
 * =============================================================================
 * Die Route, um die es im ganzen Produkt geht — und bis hierher die einzige
 * ungetestete. Das ist kein Zufall: sie ruft zwei fremde Dienste, also ist ein
 * Test ohne Attrappen nicht möglich. Genau deshalb ist er nötig — die
 * Reihenfolge der Schutzschichten prüft sonst niemand.
 *
 * Wichtigster Punkt: Kontingent und Bremse müssen VOR dem ersten KI-Aufruf
 * greifen. Sonst zahlen wir für Anfragen, die wir danach ablehnen.
 *
 * Kein Netz, kein Whisper, kein Claude.
 */

let db: FakeDb;
/** Wurde die KI überhaupt angefasst? */
let kiAufrufe: string[];
let extraktion: () => unknown;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => db.client,
  createAdminClient: () => db.client,
}));

vi.mock("@/lib/ai/transcribe", () => ({
  AUDIO_MAX_BYTES: 25 * 1024 * 1024,
  AUDIO_MAX_SEKUNDEN: 600,
  transkribiere: async () => {
    kiAufrufe.push("whisper");
    return { text: "Bad fliesen, zwölf Quadratmeter, und eine neue Armatur setzen.", sekunden: 42 };
  },
}));

vi.mock("@/lib/ai/extract-angebot", () => ({
  extrahiereAngebot: async () => {
    kiAufrufe.push("claude");
    return extraktion();
  },
}));

const ERGEBNIS = {
  titel: "Bad Erdgeschoss",
  hinweis: null,
  modell: "claude-opus-5",
  positionen: [
    {
      bezeichnung: "Wandfliesen verlegen",
      beschreibung: null,
      menge: 12,
      einheit: "m2",
      einzelpreis: 48,
      preisliste_id: "pl1",
      zu_pruefen: false,
      ki_konfidenz: 0.95,
    },
    {
      // Nicht im Katalog gefunden — muss zur Prüfung markiert bleiben.
      bezeichnung: "Armatur setzen",
      beschreibung: null,
      menge: 1,
      einheit: "stk",
      einzelpreis: 0,
      preisliste_id: null,
      zu_pruefen: true,
      ki_konfidenz: 0.4,
    },
  ],
  usage: { inputTokens: 8000, outputTokens: 700, cacheReadTokens: 6000 },
};

function start(optionen: Parameters<typeof fakeSupabase>[1] = {}) {
  db = fakeSupabase(
    {
      profiles: [
        {
          id: "u1",
          subscription_status: "aktiv",
          mwst_satz: 19,
          kleinunternehmer: false,
          angebot_gueltig_tage: 30,
        },
      ],
      preisliste: [
        { id: "pl1", user_id: "u1", bezeichnung: "Wandfliesen", einheit: "m2", preis: 48, aktiv: true },
      ],
      angebote: [],
      positionen: [],
      ki_nutzung: [],
    },
    {
      rpc: { ki_anfrage_erlaubt: true, angebote_diesen_monat: 3, next_angebot_nummer: "AN-2026-0042" },
      ...optionen,
    },
  );
}

async function post(felder: Record<string, string | File> = { text: "Bad fliesen, zwölf Quadratmeter." }) {
  const { POST } = await import("./route");
  const fd = new FormData();
  for (const [k, v] of Object.entries(felder)) fd.set(k, v);
  return POST(new Request("http://localhost/api/angebote/neu", { method: "POST", body: fd }));
}

beforeEach(() => {
  vi.resetModules();
  kiAufrufe = [];
  extraktion = () => ERGEBNIS;
  start();
});

describe("Zugang", () => {
  it("weist ab, wer nicht angemeldet ist — vor jedem KI-Aufruf", async () => {
    start({ user: null });

    const antwort = await post();

    expect(antwort.status).toBe(401);
    expect(kiAufrufe).toEqual([]);
  });
});

describe("Kostenschutz", () => {
  it("bremst zu viele Anfragen mit 429 und sagt, wie lange", async () => {
    start({ rpc: { ki_anfrage_erlaubt: false } });

    const antwort = await post();

    expect(antwort.status).toBe(429);
    expect(antwort.headers.get("Retry-After")).toBe("60");
    // Der eigentliche Punkt: kein Cent ausgegeben.
    expect(kiAufrufe).toEqual([]);
  });

  it("lehnt ab, wenn das Monatskontingent ausgeschöpft ist", async () => {
    // aktiv = 200 Angebote im Monat.
    start({ rpc: { ki_anfrage_erlaubt: true, angebote_diesen_monat: 200 } });

    const antwort = await post();

    expect(antwort.status).toBe(402);
    expect(kiAufrufe).toEqual([]);
    expect(db.tabellen.angebote).toHaveLength(0);
  });

  it("lehnt ein gekündigtes Konto ab, auch bei null Verbrauch", async () => {
    start({ rpc: { ki_anfrage_erlaubt: true, angebote_diesen_monat: 0 } });
    db.tabellen.profiles[0].subscription_status = "gekuendigt";

    expect((await post()).status).toBe(402);
    expect(kiAufrufe).toEqual([]);
  });

  it("lässt eine kaputte Bremse den Betrieb nicht lahmlegen", async () => {
    // Gibt die Funktion nichts zurück (Fehler, fehlende Migration), muss das
    // Monatskontingent allein reichen — sonst steht die App still.
    start({ rpc: { ki_anfrage_erlaubt: null, angebote_diesen_monat: 3, next_angebot_nummer: "AN-2026-0042" } });

    expect((await post()).status).toBe(200);
  });
});

describe("Eingabe", () => {
  it("weist ein zu kurzes Diktat mit einer verständlichen Bitte ab", async () => {
    const antwort = await post({ text: "Bad" });
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(400);
    expect(rumpf.fehler).toContain("zu wenig");
    expect(kiAufrufe).toEqual([]);
  });

  it("wirft erfundene Untertitel weg, statt daraus ein Angebot zu bauen", async () => {
    // Whisper gibt bei Stille die YouTube-Abspänne aus, auf denen es
    // trainiert wurde. Die sind lang genug für die Längenprüfung — und die
    // KI baut daraus ein Angebot, das niemand gesprochen hat.
    const antwort = await post({ text: "Untertitel von Stephanie Geiger" });
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(400);
    expect(rumpf.fehler).toContain("zu wenig");
    expect(kiAufrufe).toEqual([]);
    expect(db.tabellen.angebote).toHaveLength(0);
  });

  it("lässt ein Diktat durch, das zufällig mit einer Floskel endet", async () => {
    const antwort = await post({
      text: "Heizkörper tauschen, vier Stück, inklusive Entsorgung. Vielen Dank.",
    });

    expect(antwort.status).toBe(200);
    expect(kiAufrufe).toContain("claude");
  });

  it("lehnt eine zu grosse Aufnahme ab, ohne sie zu übertragen", async () => {
    const zuGross = new File([new Uint8Array(26 * 1024 * 1024)], "a.webm", { type: "audio/webm" });

    const antwort = await post({ audio: zuGross });

    expect(antwort.status).toBe(413);
    expect(kiAufrufe).toEqual([]);
  });
});

describe("Speichern", () => {
  it("legt Angebot und Positionen an und liefert die Kennung zurück", async () => {
    const antwort = await post();
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(200);
    expect(rumpf.angebotId).toBeTruthy();

    const angebot = db.tabellen.angebote[0];
    expect(angebot.nummer).toBe("AN-2026-0042");
    expect(angebot.status).toBe("entwurf");
    expect(angebot.titel).toBe("Bad Erdgeschoss");
    expect(angebot.mwst_satz).toBe(19);
    // Die Aufnahme selbst wird bewusst nicht behalten.
    expect(angebot.audio_path).toBeNull();
    expect(db.tabellen.positionen).toHaveLength(2);
  });

  it("behält die Prüfmarkierung unsicherer Positionen", async () => {
    await post();

    const unsicher = db.tabellen.positionen.filter((p) => p.zu_pruefen);
    // Ohne diese Markierung greift das Prüftor vor dem Versand nicht.
    expect(unsicher).toHaveLength(1);
    expect(unsicher[0].bezeichnung).toBe("Armatur setzen");
  });

  it("setzt beim Kleinunternehmer 0 % in das Angebot", async () => {
    db.tabellen.profiles[0].kleinunternehmer = true;

    await post();

    expect(db.tabellen.angebote[0].mwst_satz).toBe(0);
  });

  it("hält fest, ob gesprochen oder getippt wurde", async () => {
    await post();
    expect(db.tabellen.angebote[0].eingabe_art).toBe("text");
    expect(db.tabellen.angebote[0].aufnahme_sekunden).toBeNull();

    start();
    await post({ audio: new File([new Uint8Array(1000)], "a.webm", { type: "audio/webm" }) });
    expect(db.tabellen.angebote[0].eingabe_art).toBe("sprache");
    expect(db.tabellen.angebote[0].aufnahme_sekunden).toBe(42);
  });

  it("schreibt den Verbrauch mit — sonst ist die Marge nicht messbar", async () => {
    await post({ audio: new File([new Uint8Array(1000)], "a.webm", { type: "audio/webm" }) });

    const arten = db.tabellen.ki_nutzung.map((n) => n.art).sort();
    expect(arten).toEqual(["extraktion", "transkription"]);
    for (const zeile of db.tabellen.ki_nutzung) {
      expect(zeile.user_id).toBe("u1");
      expect(zeile.kosten_zehntelcent).toBeGreaterThan(0);
    }
  });

  it("bricht ab, wenn keine Angebotsnummer zu bekommen ist", async () => {
    start({ rpc: { ki_anfrage_erlaubt: true, angebote_diesen_monat: 3, next_angebot_nummer: null } });

    const antwort = await post();

    expect(antwort.status).toBe(500);
    // Kein halbes Angebot ohne Nummer.
    expect(db.tabellen.angebote).toHaveLength(0);
  });
});

describe("wenn etwas nicht eingerichtet ist", () => {
  it("sagt es und rät nicht zum nächsten Versuch", async () => {
    // Fehlt ein Schlüssel, hilft kein zweiter Versuch. "Bitte versuche es
    // noch einmal" schickt den Handwerker genau dorthin.
    const { KonfigurationsFehler } = await import("@/lib/env");
    extraktion = () => {
      throw new KonfigurationsFehler("ANTHROPIC_API_KEY");
    };

    const antwort = await post();
    const rumpf = await antwort.json();

    // 503: der Dienst ist nicht gestört, er ist nicht eingerichtet.
    expect(antwort.status).toBe(503);
    expect(rumpf.fehler).toContain("liegt nicht an dir");
    expect(rumpf.fehler).not.toContain("noch einmal");
    // Und der Name der Variablen bleibt im Protokoll, nicht beim Nutzer.
    expect(JSON.stringify(rumpf)).not.toContain("ANTHROPIC_API_KEY");
  });
});

describe("wenn die KI nicht mitspielt", () => {
  it("meldet eine unmögliche Menge als Eingabefehler, nicht als Serverfehler", async () => {
    const { MengenFehler } = await import("@/lib/ai/matching");
    extraktion = () => {
      throw new MengenFehler("Die Menge „drei Bäder“ ist keine Zahl.");
    };

    const antwort = await post();
    const rumpf = await antwort.json();

    expect(antwort.status).toBe(422);
    expect(rumpf.fehler).toContain("Menge");
  });

  it("antwortet bei einem Ausfall der KI mit 502 und speichert nichts", async () => {
    extraktion = () => {
      throw new Error("Anthropic overloaded");
    };

    const antwort = await post();

    expect(antwort.status).toBe(502);
    expect(db.tabellen.angebote).toHaveLength(0);
  });
});
