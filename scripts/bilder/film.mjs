/**
 * =============================================================================
 * Einen echten Mitschnitt der Anwendung aufnehmen
 * =============================================================================
 * Das Video auf der Startseite ist kein Animationsfilm, sondern ein
 * Bildschirmmitschnitt der laufenden Anwendung mit denselben Beispieldaten
 * wie der Rauchtest. Wer es sieht, sieht das Produkt — nicht eine Vorstellung
 * davon.
 *
 * Kein Ton: auf dem Bau läuft niemand mit eingeschaltetem Lautsprecher herum,
 * und ein stummes Video darf von selbst starten. Deshalb auch kurz und als
 * Schleife.
 *
 * Erzeugt wird webm. Das hiesige ffmpeg kann kein H.264, und ein MP4 ohne
 * Lizenz zu bauen wäre ohnehin die falsche Abkürzung. Browser, die webm nicht
 * abspielen, zeigen das Standbild — deshalb wird eines mit aufgenommen.
 */

import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";

const BROWSER = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASIS = process.env.BASIS ?? "http://localhost:3196";
const ZIEL = "public/bilder";
const ROH = ".pruefung/film";

rmSync(ROH, { recursive: true, force: true });
mkdirSync(ROH, { recursive: true });

const browser = await chromium.launch({ executablePath: BROWSER });
const kontext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "de-DE",
  recordVideo: { dir: ROH, size: { width: 390, height: 844 } },
  // Bewegung zulassen: der Mitschnitt soll zeigen, wie es sich anfühlt.
  reducedMotion: "no-preference",
});

const seite = await kontext.newPage();

/** Sanft scrollen statt springen — ein Sprung sieht im Video nach Fehler aus. */
async function rollen(bis, dauer = 900) {
  await seite.evaluate(
    ([ziel, ms]) =>
      new Promise((fertig) => {
        const start = window.scrollY;
        const weg = ziel - start;
        const t0 = performance.now();
        const schritt = (t) => {
          const p = Math.min(1, (t - t0) / ms);
          // Weich anfahren und abbremsen.
          const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
          window.scrollTo(0, start + weg * e);
          p < 1 ? requestAnimationFrame(schritt) : fertig();
        };
        requestAnimationFrame(schritt);
      }),
    [bis, dauer],
  );
}

async function zeige(pfad, ms = 1400) {
  await seite.goto(BASIS + pfad, { waitUntil: "networkidle", timeout: 30000 });
  await seite.waitForTimeout(ms);
}

// --- Der Ablauf, den das Produkt verspricht ---------------------------------
// 1. Aufnahmebildschirm: hier fängt alles an.
await zeige("/angebote/neu", 1800);

// 2. Das fertige Angebot mit dem Prüftor — der Unterschied zu "KI schreibt
//    dir irgendwas".
await zeige("/angebote/a1", 1500);
await rollen(300, 1000);
await seite.waitForTimeout(1200);
await rollen(1100, 1400);
await seite.waitForTimeout(1200);

// 3. Die Summe.
await rollen(2400, 1200);
await seite.waitForTimeout(1400);

// 4. Das Angebot beim Kunden — ohne Konto, mit zwei Knöpfen.
await zeige("/angebot/tok-a2", 1600);
await rollen(700, 1200);
await seite.waitForTimeout(1800);

// 5. Und die Übersicht, in der sich alles sammelt.
await zeige("/angebote", 1800);

// Standbild für Browser, die webm nicht abspielen: der Aufnahmebildschirm,
// also genau das Bild, mit dem der Film beginnt.
await zeige("/angebote/neu", 600);
await seite.screenshot({ path: `${ZIEL}/film-standbild.png` });

await kontext.close();
await browser.close();

const datei = readdirSync(ROH).find((d) => d.endsWith(".webm"));
if (!datei) {
  console.error("✗ Kein Video entstanden.");
  process.exit(1);
}
renameSync(`${ROH}/${datei}`, `${ZIEL}/baustift-demo.webm`);
console.log("  ✓ public/bilder/baustift-demo.webm");
console.log("  ✓ public/bilder/film-standbild.png");
