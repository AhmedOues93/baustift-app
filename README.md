# Baustift

SaaS für Handwerker (Sanitär, Elektro, Fliesen…) in Deutschland:
Leistung per **Sprachnachricht** beschreiben → Baustift erstellt daraus ein
professionelles **Angebot als PDF**.

## Stack

| Bereich | Technologie |
| --- | --- |
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Datenbank / Auth / Storage | Supabase (Postgres, Auth, Storage) |
| Transkription (Sprache → Text) | Whisper API (OpenAI) |
| Angebots-Extraktion (Text → Positionen) | Claude API (`@anthropic-ai/sdk`) |
| PDF | `@react-pdf/renderer` |
| Abo / Zahlung | Stripe |

## Ordnerstruktur

```
src/
  app/                 # App Router (Seiten + Route Handlers)
  components/ui/       # wiederverwendbare UI-Bausteine
  lib/
    supabase/          # Supabase-Clients (Browser / Server / Middleware)
    ai/                # Whisper-Transkription, Claude-Extraktion, Preis-Matching
    pdf/               # Angebots-PDF (react-pdf)
    stripe/            # Abo-Logik
  types/               # geteilte TypeScript-Typen (inkl. DB-Typen)
supabase/
  migrations/          # SQL-Schema (users, kunden, preisliste, angebote, positionen)
```

## Setup

```bash
npm install
cp .env.example .env.local   # Keys eintragen
npm run dev
```

Datenbank-Schema: SQL aus `supabase/migrations/` im Supabase SQL-Editor
ausführen (oder `supabase db push` mit der Supabase CLI).
