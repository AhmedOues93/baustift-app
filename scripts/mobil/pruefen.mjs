/**
 * =============================================================================
 * Mobil-Prüfung am gebauten Stand
 * =============================================================================
 * Die App wird auf der Baustelle mit einer Hand bedient, im Stehen, oft mit
 * Handschuh. Das prüft man nicht durch Hinsehen am Schreibtisch, und "sieht
 * gut aus" ist kein Befund. Geprüft wird deshalb messbar:
 *
 *   1. Kein waagerechtes Scrollen — der häufigste und ärgerlichste Fehler:
 *      eine zu breite Tabelle, und die ganze Seite rutscht.
 *   2. Jede Schaltfläche mindestens 44 px hoch (Apples Richtwert, und der
 *      Grund dafür ist eine Fingerkuppe, kein Geschmack).
 *   3. Kein Text unter 12 px.
 *   4. Nichts ragt über den rechten Rand hinaus.
 *
 * Gemessen wird bei 390 px — iPhone 13/14/15 in der Breite, unser Grundmass —
 * und zusätzlich bei 360 px, weil viele Android-Geräte schmaler sind.
 */

import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BROWSER = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const BASIS = process.env.BASIS ?? "http://localhost:3199";
const BILDER = process.env.BILDER ?? ".pruefung/mobil";

const SEITEN = [
  ["start", "/"],
  ["login", "/login"],
  ["angebote", "/angebote"],
  ["angebot", "/angebote/a1"],
  ["neu", "/angebote/neu"],
  ["rechnungen", "/rechnungen"],
  ["rechnung", "/rechnungen/r3"],
  ["kunden", "/kunden"],
  ["kundenakte", "/kunden/k1"],
  ["preisliste", "/preisliste"],
  ["aufmass", "/aufmass/auf1"],
  ["einstellungen", "/einstellungen"],
  ["abo", "/abo"],
];

const BREITEN = [390, 360];
const MIN_KNOPF = 44;
const MIN_SCHRIFT = 12;

/** Im Seitenkontext ausgeführt: was ist zu klein, was ragt heraus? */
function messen({ minKnopf, minSchrift }) {
  const breite = window.innerWidth;
  const befunde = [];

  if (document.documentElement.scrollWidth > breite + 1) {
    befunde.push(`waagerechtes Scrollen: ${document.documentElement.scrollWidth} px breit`);
  }

  /**
   * Eine Reihe von Filtern, die man seitwärts wischt, ist Absicht — dort darf
   * etwas rechts hinausragen. Für die Seite selbst gilt das nicht, und das
   * fängt die Prüfung oben ab.
   */
  const inWischreihe = (el) => {
    for (let k = el.parentElement; k && k !== document.body; k = k.parentElement) {
      if (["auto", "scroll"].includes(getComputedStyle(k).overflowX)) return true;
    }
    return false;
  };

  for (const el of document.querySelectorAll("button, a[href], input, select, textarea")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    const beschriftung = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40);
    // Verweise im Fliesstext sind keine Schaltflächen.
    const imText = el.tagName === "A" && el.closest("p, li");
    if (!imText && r.height < minKnopf) {
      befunde.push(`zu flach (${Math.round(r.height)} px): „${beschriftung}“`);
    }
    if (r.right > breite + 1 && !inWischreihe(el)) {
      befunde.push(`ragt ${Math.round(r.right - breite)} px über den Rand: „${beschriftung}“`);
    }
  }

  /**
   * Abgeschnittener Inhalt in einem Eingabefeld. Am Schreibtisch fällt das
   * nie auf, weil dort Beträge unter 1000 € getippt werden — und dann steht
   * bei der ersten Dusche für 1.450 € die Hälfte des Betrags ausserhalb.
   */
  for (const el of document.querySelectorAll("input")) {
    // Nur Zahlenfelder. Ein langer Leistungstext, der im Feld weiterläuft, ist
    // normal — bei 360 px geht es gar nicht anders, und beim Tippen scrollt es
    // mit. Ein halb abgeschnittener Betrag dagegen wird falsch gelesen.
    const zahl = el.inputMode === "decimal" || el.inputMode === "numeric" || el.type === "number";
    if (!zahl || !el.value) continue;
    if (el.scrollWidth > el.clientWidth + 1) {
      befunde.push(`Eingabe abgeschnitten: „${el.value}“ braucht ${el.scrollWidth} px, hat ${el.clientWidth} px`);
    }
  }

  for (const el of document.querySelectorAll("p, span, td, th, label, li, div")) {
    if (!el.firstChild || el.firstChild.nodeType !== 3 || !el.textContent.trim()) continue;
    const groesse = parseFloat(getComputedStyle(el).fontSize);
    if (groesse && groesse < minSchrift) {
      befunde.push(`Schrift ${groesse} px: „${el.textContent.trim().slice(0, 30)}“`);
    }
  }

  return befunde;
}

const browser = await chromium.launch({ executablePath: BROWSER });
let fehler = 0;

for (const breite of BREITEN) {
  console.log(`\n── ${breite} px`);
  const kontext = await browser.newContext({
    viewport: { width: breite, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "de-DE",
  });
  mkdirSync(`${BILDER}/${breite}`, { recursive: true });

  for (const [name, pfad] of SEITEN) {
    const seite = await kontext.newPage();
    const konsole = [];
    seite.on("pageerror", (e) => konsole.push(`JS-Fehler: ${e.message}`));
    try {
      const antwort = await seite.goto(BASIS + pfad, { waitUntil: "networkidle", timeout: 30000 });
      if (!antwort || antwort.status() >= 400) {
        console.log(`  ✗ ${name} -> HTTP ${antwort?.status()}`);
        fehler++;
        await seite.close();
        continue;
      }
      await seite.screenshot({ path: `${BILDER}/${breite}/${name}.png`, fullPage: true });
      const befunde = [...(await seite.evaluate(messen, { minKnopf: MIN_KNOPF, minSchrift: MIN_SCHRIFT })), ...konsole];
      if (befunde.length === 0) {
        console.log(`  ✓ ${name}`);
      } else {
        console.log(`  ✗ ${name}`);
        for (const b of [...new Set(befunde)]) console.log(`      ${b}`);
        fehler += befunde.length;
      }
    } catch (e) {
      console.log(`  ✗ ${name} -> ${e.message.split("\n")[0]}`);
      fehler++;
    }
    await seite.close();
  }
  await kontext.close();
}

await browser.close();
console.log(fehler === 0 ? "\n✓ Mobil in Ordnung" : `\n✗ ${fehler} Befund(e)`);
process.exit(fehler === 0 ? 0 : 1);
