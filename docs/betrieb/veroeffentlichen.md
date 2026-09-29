# baustift.de veröffentlichen

Die Anwendung ist fertig gebaut, aber noch nirgends erreichbar. Es gibt
deshalb bis jetzt **keinen Link** — die Startseite liegt unter `/` derselben
Next-Anwendung, in der auch die App läuft:

| Adresse | Was dort liegt |
|---|---|
| `/` | Landingpage (öffentlich) |
| `/login`, `/signup` | Anmeldung und Registrierung |
| `/angebote`, `/rechnungen`, `/kunden`, `/preisliste`, `/aufmass`, `/auftraege`, `/einstellungen` | die App, nur mit Anmeldung |
| `/rechtliches/*` | Impressum, Datenschutz, AGB, AV-Vertrag |

Es ist **eine** Anwendung, keine zwei Projekte. Das ist Absicht: ein
Besucher, der sich anmeldet, bleibt auf derselben Domain, und es gibt keinen
zweiten Aufbau, der gepflegt werden muss.

## Auf dem eigenen Rechner ansehen

```bash
npm install
cp .env.example .env.local     # ausfüllen, siehe unten
npm run dev
```

Dann im Browser: **http://localhost:3000** — das ist die Landingpage.

Ohne die Supabase-Werte startet die Anwendung nicht; die Startseite braucht
sie zwar nicht, die Middleware prüft aber bei jedem Aufruf die Sitzung.

---

## Veröffentlichen (Vercel)

1. **Projekt anlegen.** Auf vercel.com mit GitHub anmelden, das Repository
   auswählen. Vercel erkennt Next selbst; es ist nichts einzustellen.

2. **Region auf Frankfurt.** Projekteinstellungen → Functions → Region
   `fra1`. Sonst laufen die Serverfunktionen in den USA, während die
   Datenbank in Frankfurt steht: langsamer, und es widerspricht dem, was in
   der Datenschutzerklärung steht.

3. **Umgebungsvariablen setzen** (Settings → Environment Variables), für
   Production **und** Preview:

   | Variable | Woher |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://baustift.de` — davon hängen Sitemap, Teilen-Bild und die Rückleitungen von Stripe ab |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ebenda |
   | `SUPABASE_SERVICE_ROLE_KEY` | ebenda — **nur** Production, nie ins Frontend |
   | `ANTHROPIC_API_KEY` | console.anthropic.com |
   | `OPENAI_API_KEY` | platform.openai.com |
   | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET` | Stripe-Dashboard |
   | `RESEND_API_KEY`, `RESEND_ABSENDER` | optional; ohne sie verschwindet der Versandknopf, alles andere läuft |
   | `SENTRY_DSN` | optional |

4. **Migrationen einspielen.** Alle Dateien aus `supabase/migrations/` der
   Reihe nach im SQL-Editor von Supabase ausführen — von `0001` bis zur
   letzten. Sie bauen aufeinander auf; die Reihenfolge ist Pflicht.

5. **Domain verbinden.** Vercel → Settings → Domains → `baustift.de`
   eintragen. Vercel nennt die DNS-Einträge, die beim Domainanbieter zu
   setzen sind (A-Record oder CNAME). Das Zertifikat stellt Vercel selbst
   aus. `www.baustift.de` gleich mit eintragen und auf die Hauptdomain
   leiten lassen.

6. **Supabase-Weiterleitungen eintragen.** Supabase → Authentication → URL
   Configuration:
   - Site URL: `https://baustift.de`
   - Redirect URLs: `https://baustift.de/auth/callback`

   Fehlt das, landen Bestätigungs- und Passwort-Links auf localhost — und
   niemand kann sein Konto bestätigen.

7. **Stripe-Webhook einrichten.** Stripe → Developers → Webhooks → Endpoint
   `https://baustift.de/api/stripe/webhook`. Diese Ereignisse abonnieren:
   `checkout.session.completed`,
   `customer.subscription.created/updated/deleted`. Das Signing Secret danach
   als `STRIPE_WEBHOOK_SECRET` in Vercel eintragen und neu veröffentlichen.

## Danach prüfen

In dieser Reihenfolge, weil jeder Punkt den nächsten voraussetzt:

- [ ] `https://baustift.de` zeigt die Landingpage
- [ ] `https://baustift.de/robots.txt` und `/sitemap.xml` liefern Text und
      XML, keine Weiterleitung auf die Anmeldung
- [ ] Registrieren, Bestätigungsmail kommt an, Link führt auf die App
- [ ] Firmendaten eintragen, einen Preis anlegen
- [ ] Ein Angebot einsprechen — hier zeigt sich, ob die KI-Schlüssel
      stimmen
- [ ] PDF öffnen und herunterladen
- [ ] Abo im Testmodus abschliessen; danach steht in Supabase bei `profiles`
      der Status auf `aktiv` — sonst kommt der Webhook nicht an
- [ ] Die Seite auf dem Handy zum Startbildschirm hinzufügen

## Was vor dem ersten echten Kunden noch fehlt

Nichts davon ist Programmierarbeit:

1. **Rechtstexte ausfüllen.** `./scripts/platzhalter.sh` zeigt die offenen
   Stellen, `docs/rechtliches/checkliste.md` erklärt jede einzelne.
2. **AV-Verträge annehmen** bei Supabase, OpenAI, Anthropic, Stripe, Resend
   und Vercel. Abschnitt 5 derselben Checkliste.
3. **Anwaltliche Prüfung** der ausgefüllten Texte.
4. **E-Rechnung mit einem echten EN-16931-Validator prüfen**, bevor die
   erste an einen Auftraggeber geht.
