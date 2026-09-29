/**
 * =============================================================================
 * Bildschirmfotos für die Startseite aufnehmen
 * =============================================================================
 * Die Bilder auf baustift.de zeigen das echte Produkt. Damit das auch in einem
 * halben Jahr noch stimmt, werden sie hier aufgenommen statt von Hand
 * geschnitten: einmal `npm run bilder`, und sie entsprechen wieder dem Stand
 * der Anwendung.
 *
 * Die alten Bilder stammten vom 25. September und zeigten unter anderem noch
 * das zu schmale Preisfeld — also genau einen Fehler, den wir inzwischen
 * behoben haben. Eine Startseite, die einen alten Stand bewirbt, ist die
 * schlechtere Werbung.
 *
 * Gezeigt werden dieselben Beispieldaten wie im Rauchtest (scripts/vorschau).
 * Es sind keine echten Betriebe und keine echten Kunden.
 */

import { chromium } from "playwright-core";

const BROWSER = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASIS = process.env.BASIS ?? "http://localhost:3197";
const ZIEL = "public/bilder";

/** Handybilder: 390 × 590 bei doppelter Auflösung — das Format der Rahmen. */
const HANDY = [
  { name: "aufnahme", pfad: "/angebote/neu", zu: 0 },
  { name: "angebot", pfad: "/angebote/a1", zu: 285 },
  { name: "liste", pfad: "/angebote", zu: 0 },
  { name: "aufmass", pfad: "/aufmass/auf1", zu: 120 },
  { name: "rechnungen", pfad: "/rechnungen", zu: 0 },
  { name: "kunde", pfad: "/kunden/k1", zu: 0 },
];

const browser = await chromium.launch({ executablePath: BROWSER });

const handy = await browser.newContext({
  viewport: { width: 390, height: 590 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: "de-DE",
});

for (const { name, pfad, zu } of HANDY) {
  const seite = await handy.newPage();
  await seite.goto(BASIS + pfad, { waitUntil: "networkidle", timeout: 30000 });
  if (zu) await seite.evaluate((y) => window.scrollTo(0, y), zu);
  // Kurz warten, damit nachgeladene Schriften nicht mitten im Wechsel stehen.
  await seite.waitForTimeout(400);
  await seite.screenshot({ path: `${ZIEL}/${name}.png` });
  console.log(`  ✓ ${name}.png  (${pfad})`);
  await seite.close();
}
await handy.close();

/**
 * Und einmal am Rechner. 1280 px, weil die Seitenleiste erst ab `lg`
 * (1024 px) erscheint — bei 900 px fotografiert man die Handy-Ansicht auf
 * einem breiten Bildschirm, und das Bild zeigt dann nicht, was es behauptet.
 */
const rechner = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2,
  locale: "de-DE",
});
const seite = await rechner.newPage();
await seite.goto(`${BASIS}/angebote`, { waitUntil: "networkidle", timeout: 30000 });
await seite.waitForTimeout(400);
await seite.screenshot({ path: `${ZIEL}/desktop.png` });
console.log("  ✓ desktop.png  (/angebote)");
await rechner.close();

await browser.close();
console.log("\nFertig. Bitte einmal ansehen, bevor es veröffentlicht wird.");
