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
  ["pakete", "/pakete"],
  ["paket", "/pakete/pk1"],
  // Die einzige Seite ohne Anmeldung — und die, die der Kunde sieht.
  ["kundenangebot", "/angebot/tok-a2"],
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
    const text = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40);
    // Verweise im Fliesstext sind keine Schaltflächen.
    const imText = el.tagName === "A" && el.closest("p, li");
    /**
     * Ein Auswahlkästchen in einer Beschriftung ist selbst klein — getroffen
     * wird aber die ganze Beschriftung, denn ein Klick darauf schaltet das
     * Feld. Entscheidend ist also ihre Höhe, nicht die des Kästchens.
     */
    const beschriftung = el.closest("label");
    const trefferHoehe =
      beschriftung && (el.type === "checkbox" || el.type === "radio")
        ? beschriftung.getBoundingClientRect().height
        : r.height;
    if (!imText && trefferHoehe < minKnopf) {
      befunde.push(`zu flach (${Math.round(trefferHoehe)} px): „${text}“`);
    }
    if (r.right > breite + 1 && !inWischreihe(el)) {
      befunde.push(`ragt ${Math.round(r.right - breite)} px über den Rand: „${text}“`);
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

  /**
   * Bedienbarkeit ohne Maus und ohne Augen.
   *
   * Kein vollständiger Barrierefreiheitstest — aber die vier Fehler, die
   * sich ohne Werkzeug nicht sehen lassen und die jede Vorlesesoftware
   * sofort trifft.
   */

  // 1. Jedes Bedienelement braucht einen Namen. Ohne ihn liest die
  //    Vorlesesoftware "Schaltfläche" und sonst nichts.
  for (const el of document.querySelectorAll("input, select, textarea, button, a[href]")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (el.type === "hidden") continue;

    const ausBeschriftung = el.id
      ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)
      : null;
    const name = (
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      (el.getAttribute("aria-labelledby")
        ? document.getElementById(el.getAttribute("aria-labelledby"))?.textContent
        : "") ||
      ausBeschriftung?.textContent ||
      el.closest("label")?.textContent ||
      el.textContent ||
      ""
    ).trim();

    if (name === "") {
      befunde.push(`ohne Namen für die Vorlesesoftware: <${el.tagName.toLowerCase()}>`);
    }
  }

  // 2. Bilder ohne alt-Text. Ein leeres alt ist in Ordnung (Schmuck),
  //    ein fehlendes nicht.
  for (const bild of document.querySelectorAll("img")) {
    if (bild.getAttribute("alt") === null) {
      befunde.push(`Bild ohne alt-Angabe: ${(bild.getAttribute("src") || "").slice(-40)}`);
    }
  }

  // 3. Die Seite braucht eine Sprache — sonst liest eine englische
  //    Stimme deutsche Texte vor.
  if (!document.documentElement.getAttribute("lang")) {
    befunde.push("Die Seite nennt keine Sprache (<html lang>)");
  }

  // 4. Genau eine Hauptüberschrift.
  const h1 = document.querySelectorAll("h1").length;
  if (h1 > 1) befunde.push(`${h1} Hauptüberschriften (h1) auf einer Seite`);

  return befunde;
}

/**
 * Lässt sich die Seite mit der Tastatur bedienen — und sieht man dabei, wo
 * man ist?
 *
 * Geprüft wird das Erste, woran es scheitert: ob nach ein paar Tabulatoren
 * überhaupt etwas den Fokus hat, und ob dieser Fokus sichtbar ist. Ein
 * unsichtbarer Fokus ist schlimmer als keiner: man tippt ins Blaue.
 */
async function tastatur(seite) {
  const befunde = [];
  let gefunden = 0;

  for (let i = 0; i < 12; i++) {
    await seite.keyboard.press("Tab");
    const ergebnis = await seite.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      const stil = getComputedStyle(el);
      // Ein Ring entsteht über outline oder über einen Schatten (Tailwind
      // ring-*). Eines von beidem muss da sein.
      const sichtbar =
        (stil.outlineStyle !== "none" && parseFloat(stil.outlineWidth) > 0) ||
        (stil.boxShadow !== "none" && stil.boxShadow !== "") ||
        stil.borderColor !== getComputedStyle(document.body).borderColor;
      return {
        name: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30),
        sichtbar,
      };
    });
    if (!ergebnis) continue;
    gefunden++;
    if (!ergebnis.sichtbar) {
      befunde.push(`Fokus nicht sichtbar auf „${ergebnis.name}"`);
    }
  }

  if (gefunden === 0) {
    befunde.push("Mit der Tabulatortaste ist nichts zu erreichen");
  }
  return [...new Set(befunde)];
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
      const befunde = [
        ...(await seite.evaluate(messen, { minKnopf: MIN_KNOPF, minSchrift: MIN_SCHRIFT })),
        ...(await tastatur(seite)),
        ...konsole,
      ];
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
