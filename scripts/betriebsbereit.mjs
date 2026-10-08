/**
 * =============================================================================
 * Betriebsbereitschaft prüfen
 * =============================================================================
 * Vor dem ersten echten Kunden: sind alle Einstellungen gesetzt, und sehen sie
 * plausibel aus? Ein grüner Build sagt darüber nichts — die App baut auch
 * völlig ohne Schlüssel und scheitert dann beim ersten Klick.
 *
 * Geprüft wird die Form, nicht die Gültigkeit: ob ein Schlüssel wirklich zum
 * richtigen Konto gehört, kann nur der Anbieter sagen. Es werden bewusst KEINE
 * Anfragen an Stripe, Anthropic oder OpenAI geschickt — die kosten Geld und
 * könnten in Produktion etwas auslösen.
 *
 *   node scripts/betriebsbereit.mjs            # liest .env.local
 *   node scripts/betriebsbereit.mjs --umgebung # liest die echte Umgebung
 */

import { readFileSync, existsSync } from "node:fs";

const ausUmgebung = process.argv.includes("--umgebung");
const werte = { ...(ausUmgebung ? process.env : {}) };

if (!ausUmgebung) {
  const datei = process.env.ENV_DATEI ?? ".env.local";
  if (!existsSync(datei)) {
    console.error(`✗ ${datei} gibt es nicht. Für die echte Umgebung: --umgebung`);
    process.exit(1);
  }
  for (const zeile of readFileSync(datei, "utf8").split("\n")) {
    const treffer = zeile.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (treffer) werte[treffer[1]] = treffer[2].trim().replace(/^["']|["']$/g, "");
  }
}

const PRUEFUNGEN = [
  ["NEXT_PUBLIC_SITE_URL", /^https:\/\/[^/]+$/, "vollständige Adresse ohne Schrägstrich am Ende, z. B. https://baustift.de", "Bestätigungs- und Passwortlinks"],
  ["NEXT_PUBLIC_SUPABASE_URL", /^https:\/\/[a-z0-9-]+\.supabase\.co$/, "die Projekt-URL aus Supabase → Project Settings → API", "Datenbank und Anmeldung"],
  ["NEXT_PUBLIC_SUPABASE_ANON_KEY", /^[A-Za-z0-9._-]{40,}$/, "der anon-Schlüssel (öffentlich, darf im Browser stehen)", "Anmeldung im Browser"],
  ["SUPABASE_SERVICE_ROLE_KEY", /^[A-Za-z0-9._-]{40,}$/, "der service_role-Schlüssel — NIEMALS im Browser, nur als Server-Variable", "Verbrauchsprotokoll und Stripe-Webhook"],
  ["ANTHROPIC_API_KEY", /^sk-ant-/, "Schlüssel aus der Anthropic Console", "Positionen aus dem Diktat"],
  ["OPENAI_API_KEY", /^sk-/, "Schlüssel aus dem OpenAI-Dashboard", "Sprache zu Text (Whisper)"],
  ["STRIPE_SECRET_KEY", /^sk_(test|live)_/, "Geheimschlüssel aus Stripe; sk_test_ zum Üben, sk_live_ für echtes Geld", "Abo abschliessen"],
  ["STRIPE_WEBHOOK_SECRET", /^whsec_/, "aus Stripe → Developers → Webhooks → Signing secret", "Abo-Status nach der Zahlung"],
  ["STRIPE_PRICE_ID", /^price_/, "die Preis-Kennung des Abos aus Stripe", "Abo abschliessen"],
  ["RESEND_API_KEY", /^re_/, "Schlüssel aus Resend", "Angebot per E-Mail versenden", true],
  ["RESEND_ABSENDER", /^.+<[^@]+@[^>]+>$/, 'Format: Name <post@deine-domain.de> — die Domain muss in Resend bestätigt sein', "Angebot per E-Mail versenden", true],
  ["SENTRY_DSN", /^https:\/\/\w+@/, "Sentry → Projekt → Settings → Client Keys", "Fehler landen zusätzlich bei Sentry", true],
];

let fehlt = 0;
let schief = 0;

console.log(ausUmgebung ? "Prüfe die laufende Umgebung\n" : "Prüfe .env.local\n");

for (const [name, form, hinweis, wofuer, freiwillig] of PRUEFUNGEN) {
  const wert = (werte[name] ?? "").trim();
  if (!wert) {
    /**
     * Freiwillige Werte sind kein Fehler. Ohne Resend läuft alles weiter,
     * der Versandknopf verschwindet nur — und ohne Sentry stehen Fehler im
     * Log des Hosters. Beides als "fehlt" zu zählen, würde den Blick auf
     * das lenken, was wirklich fehlt.
     */
    if (freiwillig) {
      console.log(`· ${name} nicht gesetzt (freiwillig)`);
      console.log(`    ohne: ${wofuer} entfällt`);
      continue;
    }
    console.log(`✗ ${name} fehlt`);
    console.log(`    gebraucht für: ${wofuer}`);
    console.log(`    ${hinweis}`);
    fehlt++;
  } else if (!form.test(wert)) {
    console.log(`⚠ ${name} sieht nicht aus wie erwartet`);
    console.log(`    ${hinweis}`);
    schief++;
  } else {
    console.log(`✓ ${name}`);
  }
}

// Der eine Fehler, der still Geld kostet: Live-Schlüssel auf einer Testadresse.
const live = (werte.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_");
const adresse = werte.NEXT_PUBLIC_SITE_URL ?? "";
if (live && (adresse.includes("localhost") || adresse.includes("vercel.app") || adresse === "")) {
  console.log("\n⚠ Stripe läuft im Echtbetrieb (sk_live_), die Adresse ist aber eine Test-Adresse.");
  console.log("  Damit werden echte Zahlungen auf einer Vorschau ausgelöst.");
  schief++;
}

console.log();
if (fehlt === 0 && schief === 0) {
  console.log("✓ Alle Einstellungen vorhanden und plausibel.");
  console.log("  Ob die Schlüssel zum richtigen Konto gehören, sagt nur der jeweilige Anbieter.");
} else {
  console.log(`${fehlt} fehlend, ${schief} auffällig.`);
}
process.exit(fehlt > 0 ? 1 : 0);
