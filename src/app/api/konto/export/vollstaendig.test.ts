import { readFileSync, readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * =============================================================================
 * Ist der Datenexport noch vollständig?
 * =============================================================================
 * Art. 20 DSGVO verlangt alle personenbezogenen Daten — vollständig, nicht
 * ungefähr. Der Export ist aber eine Liste von Hand, und eine Liste von Hand
 * veraltet: seit sie geschrieben wurde, kamen Aufmasse, Messungen,
 * Teilzahlungen, Aufträge und die Baustellendokumentation dazu. Jede einzelne
 * davon fehlte, bis jemand zufällig hinsah.
 *
 * Deshalb vergleicht dieser Test die Tabellen aus den Migrationen mit denen,
 * die der Export abfragt. Kommt eine neue dazu, schlägt er fehl — und die
 * Entscheidung, ob sie hineingehört, wird bewusst getroffen statt vergessen.
 */

const MIGRATIONEN = "supabase/migrations";
const EXPORT = "src/app/api/konto/export/route.ts";

/**
 * Tabellen, die nicht in den Export gehören — mit Grund. Wer hier etwas
 * einträgt, soll erklären können, warum.
 */
const OHNE_EXPORT: Record<string, string> = {
  // Enthält nur die Anfragezeitpunkte der letzten Stunde und wird
  // automatisch geleert; für den Nutzer ohne Aussage.
  ki_anfragen: "Anfragebremse, nach einer Stunde gelöscht",
};

function tabellenAusMigrationen(): string[] {
  const gefunden = new Set<string>();
  for (const datei of readdirSync(MIGRATIONEN).sort()) {
    const inhalt = readFileSync(`${MIGRATIONEN}/${datei}`, "utf8");
    for (const treffer of inhalt.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi,
    )) {
      gefunden.add(treffer[1]);
    }
  }
  return [...gefunden];
}

describe("Datenexport (Art. 20 DSGVO)", () => {
  const quelle = readFileSync(EXPORT, "utf8");
  const tabellen = tabellenAusMigrationen();

  it("findet überhaupt Tabellen — sonst prüft der Test nichts", () => {
    expect(tabellen.length).toBeGreaterThan(8);
  });

  it("fragt jede Tabelle mit Nutzerdaten ab", () => {
    const fehlend = tabellen.filter(
      (t) =>
        !(t in OHNE_EXPORT) &&
        // profiles wird über die Konto-ID geholt, nicht als Liste.
        t !== "profiles" &&
        !quelle.includes(`from("${t}")`),
    );

    expect(
      fehlend,
      `Diese Tabellen fehlen im Datenexport: ${fehlend.join(", ")}. ` +
        `Entweder aufnehmen oder in OHNE_EXPORT begründen.`,
    ).toEqual([]);
  });

  it("holt die Firmendaten über die eigene Konto-ID", () => {
    expect(quelle).toContain('from("profiles")');
    expect(quelle).toContain('.eq("id", user.id)');
  });

  it("benutzt den Client des Nutzers, nicht den Admin-Zugang", () => {
    // Mit dem Service-Role-Key wäre RLS ausgehebelt — ein Fehler im Filter
    // würde dann fremde Daten exportieren.
    expect(quelle).not.toContain("createAdminClient");
    expect(quelle).toContain("createClient");
  });
});
