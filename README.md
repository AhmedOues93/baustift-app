# Baustift

SaaS für Handwerker in Deutschland: Leistung per **Sprachnachricht**
beschreiben → fertiges **Angebot als PDF**.

## Wie es funktioniert

```
Sprachaufnahme
   │  Whisper (Sprache → deutscher Text)
   ▼
Transkript
   │  Claude (Text + Preisliste → Positionen)
   ▼
Positionen  ──►  Preis-Matching gegen die eigene Preisliste
   │
   ▼
Prüfbildschirm (Mensch entscheidet)  ──►  PDF  ──►  Versand, Nachfassen
                                                        │
                                            angenommen  ▼
                                                    Rechnung
```

**Angebot und Rechnung sind getrennt** — nicht aus Ordnungsliebe, sondern
weil ein Angebot beliebig änderbar ist und eine gestellte Rechnung nicht.
Beim Umwandeln werden die Positionen kopiert, nicht verknüpft. Ab dem
Festschreiben lässt die Datenbank keine Änderung mehr zu (Trigger in
`0005_rechnungen.sql`); korrigiert wird über eine Stornorechnung mit
eigener Nummer. Das ist im Schema-Test mit abgedeckt.

**Die wichtigste Regel:** Preise kommen ausschliesslich aus der Datenbank.
Das Antwortschema der KI hat kein Preisfeld — Claude liefert nur eine
Referenz auf einen Preislisten-Eintrag, den Betrag setzt der Server
(`src/lib/ai/matching.ts`). Ein halluzinierter Betrag kann so nie in ein
verbindliches Angebot gelangen.

## Stack

| Bereich | Technologie |
| --- | --- |
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind |
| Datenbank / Auth / Storage | Supabase (Postgres mit RLS) |
| Transkription | Whisper (OpenAI) |
| Extraktion | Claude (`claude-opus-5`) mit Structured Outputs |
| PDF | `@react-pdf/renderer` |
| Abo | Stripe (Checkout, Kundenportal, Webhook) |
| E-Mail | Resend (optional — ohne Key läuft alles weiter) |

## Entwickeln

```bash
npm install
cp .env.example .env.local     # Keys eintragen
npm run dev
```

| Befehl | Zweck |
| --- | --- |
| `npm test` | Unit-Tests (Matching, Formate, Beträge, Kontingent, CSV, PDF, Routen) |
| `npm run test:db` | Schema, Trigger, RLS und Beträge gegen echtes Postgres |
| `npm run test:rauch` | Die **gebaute** Anwendung: antworten alle Seiten und Routen? |
| `npm run mobil` | Bedienbarkeit bei 390 px und 360 px, im echten Browser gemessen |
| `npm run erechnung` | E-Rechnung gegen CII-Schema und EN-16931-Prüfer der EU-Kommission |
| `npm run bereit` | Sind alle Einstellungen gesetzt und plausibel? |
| `npm run bilder` | Bildschirmfotos für die Startseite neu aufnehmen |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run icons` | PWA-Icons neu erzeugen |

`test:db` braucht ein erreichbares Postgres (`PGHOST`, `PGPORT`, `PGUSER`).
Es baut die Supabase-Bausteine (`auth.users`, `auth.uid()`, `storage.*`)
selbst nach — weder Docker noch eine Supabase-Instanz nötig.

**Echte Prüfungen und Attrappen auseinanderhalten.** `npm test` benutzt eine
Datenbank im Arbeitsspeicher (`src/test/fake-supabase.ts`) und Attrappen für
Whisper, Claude, Stripe und den E-Mail-Versand — es prüft, was die Anwendung
tun WILL. Was die Datenbank dann wirklich tut (Trigger, Summen, RLS,
Unveränderlichkeit gestellter Rechnungen), prüft `test:db` gegen echtes
Postgres; ob die gebaute Anwendung antwortet, prüft `test:rauch`; ob die
E-Rechnung der Norm entspricht, entscheidet in `erechnung` der Prüfer der
EU-Kommission und nicht unsere Meinung. `mobil` misst in einem echten
Chromium. Die Aufteilung ist Absicht: ein grüner Unit-Test hat die
PDF-Ausgabe schon einmal wochenlang für heil gehalten, während sie 500
lieferte.

## Ordnerstruktur

```
src/
  app/
    (auth)/          Login, Registrierung
    (app)/           angemeldeter Bereich (Angebote, Kunden, Preisliste, Konto)
    api/             Angebotserstellung, PDF, Stripe
    rechtliches/     Impressum, Datenschutz, AGB, AV-Vertrag
  components/        UI-Bausteine und Navigation
  lib/
    ai/              Whisper, Claude, Preis-Matching, Kostenerfassung
    pdf/             Angebots-PDF
    stripe/          Client und Statuszuordnung
    supabase/        Browser-, Server- und Admin-Client, Middleware
supabase/
  migrations/        Schema (in dieser Reihenfolge ausführen)
  test/              Supabase-Nachbau und Ablauftest
```

## Design-System

Alle Farben, Radien und Schatten stehen in `src/app/globals.css` und werden
über `tailwind.config.ts` nutzbar gemacht. Tailwinds Standardpalette ist
**ersetzt**, nicht erweitert: `bg-blue-500` erzeugt im Projekt kein CSS mehr.
Farben liegen als RGB-Kanäle vor, damit die Deckkraft-Kürzel (`/60`)
funktionieren.

Grundsätze: Elfenbein statt Weiss als Seitengrund, 1px-Linien oder gar keine,
Terrakotta nur für die eine hervorgehobene Aktion pro Bildschirm, Zahlen
immer in der Monoschrift (Klasse `.zahl`), Touch-Ziele mindestens 44px.

## Vor dem Start in den Verkauf

Der Code ist vollständig, diese Punkte sind es noch nicht:

**Rechtlich (Blocker)**
- [ ] Platzhalter in `/rechtliches/*` ausfüllen und anwaltlich prüfen lassen
- [ ] AV-Verträge mit Supabase, OpenAI, Anthropic und Stripe abschliessen
- [ ] Supabase-Projekt in einer **EU-Region** anlegen (später nicht umziehbar)

**Betrieb**
- [ ] Fehler-Monitoring anbinden (z. B. Sentry)
- [ ] Backups einrichten **und eine Wiederherstellung testen**
- [ ] Transaktionale E-Mails (Passwort zurücksetzen, Angebotsversand)
- [ ] Kostenauswertung aus `ki_nutzung` ansehen, bevor der Preis feststeht

**Produkt**
- [ ] E-Rechnung (XRechnung/ZUGFeRD als XML im PDF) — Pflicht zum Empfang
      seit 2025, zum Ausstellen gestaffelt ab 2027. Fristen mit dem
      Steuerberater prüfen.
- [ ] GoBD-Export für die Betriebsprüfung (Datenträgerüberlassung)

## Kosten je Angebot

Whisper und Claude kosten zusammen rund **0,05–0,10 €** pro Angebot
(mit Prompt-Caching auf dem Preiskatalog). Jeder Lauf wird in `ki_nutzung`
mit Modell, Token und geschätzten Kosten protokolliert — ohne diese Zahlen
kennt man bei 39 €/Monat weder die Marge noch das Konto, das aus dem Ruder
läuft. Das Kontingent (`src/lib/abo.ts`) ist der Deckel nach oben.
