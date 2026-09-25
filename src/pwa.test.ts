import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * =============================================================================
 * PWA: installierbar bleiben
 * =============================================================================
 * Die App wird auf der Baustelle vom Startbildschirm gestartet, nicht aus dem
 * Browsermenü. Installierbarkeit hängt an einer Handvoll Dateien, die im
 * Alltag niemand aufruft — ein Tippfehler im Manifest oder ein Pfad, den die
 * Middleware plötzlich abfängt, fällt deshalb erst auf, wenn ein Pilotbetrieb
 * die App nicht mehr installieren kann. Diese Tests prüfen genau die
 * Bedingungen, die die Browser für "Zum Startbildschirm hinzufügen" stellen.
 */

const wurzel = process.cwd();
const lies = (pfad: string) => readFileSync(join(wurzel, pfad));

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; type?: string; purpose?: string }[];
}

const manifest: Manifest = JSON.parse(
  lies("public/manifest.webmanifest").toString("utf8"),
);

/** Breite und Höhe aus dem IHDR-Block einer PNG-Datei. */
function pngMasse(puffer: Buffer): { breite: number; hoehe: number } {
  expect(puffer.subarray(1, 4).toString("ascii")).toBe("PNG");
  return { breite: puffer.readUInt32BE(16), hoehe: puffer.readUInt32BE(20) };
}

describe("Manifest", () => {
  it("erfüllt die Installationskriterien der Browser", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    // Ohne "standalone" (oder "fullscreen") bietet kein Browser die
    // Installation an — es wäre dann nur ein Lesezeichen.
    expect(["standalone", "fullscreen"]).toContain(manifest.display);
    // Die Startseite muss im Geltungsbereich liegen, sonst startet die
    // installierte App im Browser-Tab.
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true);
  });

  it("verlangt ein 192er, ein 512er und ein maskierbares Icon", () => {
    const groessen = manifest.icons.map((i) => i.sizes);
    expect(groessen).toContain("192x192");
    expect(groessen).toContain("512x512");
    // Ohne maskierbares Icon schneidet Android das Logo in seine Rundung.
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("verweist auf vorhandene PNG-Dateien in der angegebenen Grösse", () => {
    for (const icon of manifest.icons) {
      const [breite, hoehe] = icon.sizes.split("x").map(Number);
      const masse = pngMasse(lies(join("public", icon.src)));
      expect(masse).toEqual({ breite, hoehe });
    }
  });
});

describe("Service Worker", () => {
  const sw = lies("public/sw.js").toString("utf8");

  it("speichert keine Antworten mit Nutzerdaten zwischen", () => {
    // Seitenaufrufe dürfen nur aus dem Netz kommen; Angebote, Preise und
    // Kundendaten haben im Cache eines Baustellen-Handys nichts verloren.
    expect(sw).toContain('if (request.method !== "GET") return;');
    expect(sw).toMatch(/pathname\.startsWith\("\/api"\)/);
  });

  it("hat eine Offline-Seite, die er auch vorhält", () => {
    expect(sw).toContain("/offline.html");
    expect(lies("public/offline.html").toString("utf8")).toContain("<html");
  });
});

describe("Middleware-Matcher", () => {
  // Der Matcher steht als Literal in der Konfiguration. Wir lesen ihn aus der
  // Datei, statt das Modul zu laden: middleware.ts zieht den halben
  // Supabase-Stack nach, und geprüft werden soll hier nur der Pfadfilter.
  const quelle = lies("src/middleware.ts").toString("utf8");
  const treffer = quelle.match(/"(\/\(\(\?!.*)",/);
  // Im Quelltext steht der Ausdruck in einer Zeichenkette: dort ist jeder
  // Rückstrich verdoppelt. Ohne dieses Zurückwandeln entstünde ein anderes
  // Muster als das, das Next tatsächlich benutzt — und der Test prüfte etwas,
  // das es nicht gibt. Genau das war er eine Zeit lang.
  const muster = new RegExp(`^${(treffer?.[1] ?? "").replace(/\\\\/g, "\\")}$`);

  it("lässt die öffentlichen Dateien durch", () => {
    // Dieselbe Falle wie bei den PWA-Dateien, nur mit anderem Schaden: eine
    // Suchmaschine, die auf /login umgeleitet wird, nimmt die Seite nicht
    // auf, und ein Besucher ohne Konto kommt nicht an das Muster-Angebot.
    for (const pfad of [
      "/robots.txt",
      "/sitemap.xml",
      "/og.png",
      "/muster-angebot.pdf",
      "/bilder/aufnahme.png",
    ]) {
      expect(muster.test(pfad), `${pfad} wird abgefangen`).toBe(false);
    }
  });

  it("lässt die PWA-Dateien durch", () => {
    // Fängt die Middleware sie ab, bekommt der Browser ohne Session eine
    // Weiterleitung auf /login statt Manifest oder Service Worker — und die
    // App lässt sich nicht mehr installieren.
    for (const pfad of [
      "/manifest.webmanifest",
      "/sw.js",
      "/offline.html",
      "/icons/icon-192.png",
      "/icons/apple-touch-icon.png",
    ]) {
      expect(muster.test(pfad), `${pfad} wird abgefangen`).toBe(false);
    }
  });

  it("greift bei echten Seiten weiterhin", () => {
    for (const pfad of ["/angebote", "/preisliste", "/einstellungen"]) {
      expect(muster.test(pfad), `${pfad} wird nicht geprüft`).toBe(true);
    }
  });
});
