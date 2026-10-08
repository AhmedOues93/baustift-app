# Baustift

SaaS für Handwerker in Deutschland: Leistung per **Sprachnachricht**
beschreiben → fertiges **Angebot als PDF**.

## Wie es funktioniert

```
Sprachaufnahme · Aufmass · Leistungspaket · Tastatur
   │  Whisper (Sprache → deutscher Text)
   ▼
Transkript
   │  Claude (Text + Preisliste → Positionen)
   ▼
Positionen  ──►  Preis-Matching gegen die eigene Preisliste
   │
   ▼
Prüftor: unsichere Zeilen müssen bestätigt werden, sonst geht nichts raus
   │
   ▼
PDF  ──►  Versand per E-Mail oder WhatsApp, Nachfassen
   │
   ▼
Kundenlink: der Kunde sagt selbst zu oder ab — ohne Konto
   │                                    │
   │ angenommen                         └─► Absage mit Grund
   ▼
Auftrag (Termin, Baustellendokumentation)
   ▼
Rechnung ──► PDF · E-Rechnung (EN 16931) · Teilzahlungen · Mahnung
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
| E-Rechnung | EN 16931 / CII, geprüft gegen den Schematron der EU-Kommission |
| Fehler-Monitoring | Sentry über die Store-Schnittstelle (optional, ohne DSN folgenlos) |
| Bereitstellung | Render (`render.yaml`), Region Frankfurt |

## Entwickeln

```bash
npm ci
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
    (app)/           angemeldeter Bereich (Angebote, Aufträge, Rechnungen,
                     Kunden, Preisliste, Pakete, Aufmass, Konto)
    angebot/[token]/ das Angebot beim Kunden — ohne Konto, ohne Anmeldung
    api/             Angebotserstellung, PDF, E-Rechnung, Export, Stripe,
                     healthz
    rechtliches/     Impressum, Datenschutz, AGB, AV-Vertrag
  components/        UI-Bausteine und Navigation
  lib/
    ai/              Whisper, Claude, Preis-Matching, Kostenerfassung
    aufmass/         Masse aus Sprache, Gruppierung
    erechnung/       EN 16931 / CII
    pdf/             Angebots- und Rechnungs-PDF
    stripe/          Client und Statuszuordnung
    supabase/        Browser-, Server- und Admin-Client, Middleware
    rechnen.ts       Beträge — rechnet wie Postgres, nicht wie JavaScript
supabase/
  migrations/        Schema (in dieser Reihenfolge ausführen)
  test/              Supabase-Nachbau und Ablauftest
scripts/             Prüfwerkzeuge (siehe oben) und Vorschau-Daten
render.yaml          Beschreibung des Dienstes bei Render
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

## Betrieb

Die Anwendung läuft auf **Render**: <https://baustift.onrender.com>
Der Dienst ist in [`render.yaml`](render.yaml) beschrieben (Region
Frankfurt, Node 22, Lebenszeichen auf `/api/healthz`); Geheimnisse stehen
dort nicht, nur die Namen der Variablen.

Alles zum Einrichten — welche Umgebungsvariable woher kommt, was einmalig
in Supabase und Stripe einzustellen ist, und ein Live-Testplan — steht in
**[docs/betrieb/veroeffentlichen.md](docs/betrieb/veroeffentlichen.md)**.

## Was vor dem ersten echten Kunden noch offen ist

Nichts davon ist Programmierarbeit:

- [ ] **Umgebungsvariablen bei Render eintragen.** `npm run bereit
      --umgebung` listet alle elf mit Herkunft und Zweck.
- [ ] **Supabase einrichten:** Migrationen einspielen, Redirect-URLs
      setzen, Sicherung einschalten und eine Wiederherstellung einmal
      ausprobiert haben. Das Projekt muss in einer **EU-Region** liegen —
      das lässt sich später nicht ändern.
- [ ] **Stripe-Webhook** auf `/api/stripe/webhook` zeigen lassen.
- [ ] **Live-Testplan einmal durchgehen** (Registrierung, Bestätigungsmail,
      Passwort-Reset, gesprochenes Angebot, Kundenlink, Rechnung,
      Stripe-Testabo). Steht in der Betriebsdokumentation.
- [ ] **Rechtstexte ausfüllen** (`./scripts/platzhalter.sh`),
      **AV-Verträge** mit Supabase, OpenAI, Anthropic, Stripe, Resend und
      Render abschliessen, **anwaltlich prüfen** lassen.

Bewusst später, nicht vergessen: ein **GoBD-Export zur
Datenträgerüberlassung** (IDEA-Format mit `INDEX.XML`) für den Fall einer
Betriebsprüfung. Rechnungen und Positionen lassen sich heute schon als CSV
und als vollständiges JSON ausgeben; das reicht für die Aufbewahrung, nicht
für die Form, die ein Prüfer verlangen kann. Das ist eine Produkt-, keine
Codeschuld — und es lohnt sich erst, wenn der erste Betrieb eine
Betriebsprüfung vor sich hat.

## Kosten je Angebot

Whisper und Claude kosten zusammen rund **0,05–0,10 €** pro Angebot
(mit Prompt-Caching auf dem Preiskatalog). Jeder Lauf wird in `ki_nutzung`
mit Modell, Token und geschätzten Kosten protokolliert — ohne diese Zahlen
kennt man bei 39 €/Monat weder die Marge noch das Konto, das aus dem Ruder
läuft. Das Kontingent (`src/lib/abo.ts`) ist der Deckel nach oben.
