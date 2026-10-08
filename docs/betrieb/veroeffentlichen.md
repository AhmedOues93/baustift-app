# Baustift betreiben

Die Anwendung läuft auf **Render**: <https://baustift.onrender.com>

Es ist **eine** Next-Anwendung, keine zwei Projekte — die Landingpage liegt
unter `/` derselben Anwendung, in der auch die App läuft. Das ist Absicht:
wer sich anmeldet, bleibt auf derselben Domain, und es gibt keinen zweiten
Aufbau, der gepflegt werden muss.

| Adresse | Was dort liegt |
|---|---|
| `/` | Landingpage (öffentlich) |
| `/login`, `/signup` | Anmeldung und Registrierung |
| `/angebote`, `/rechnungen`, `/auftraege`, `/kunden`, `/preisliste`, `/pakete`, `/aufmass`, `/einstellungen` | die App, nur mit Anmeldung |
| `/angebot/<schlüssel>` | das Angebot beim Kunden — ohne Konto, ohne Anmeldung |
| `/rechtliches/*` | Impressum, Datenschutz, AGB, AV-Vertrag |
| `/api/healthz` | Lebenszeichen für Render |

## Auf dem eigenen Rechner

```bash
npm ci
cp .env.example .env.local     # ausfüllen, siehe unten
npm run dev
```

Dann **http://localhost:3000**. Ohne die Supabase-Werte startet die
Anwendung nicht: die Startseite braucht sie zwar nicht, die Middleware
prüft aber bei jedem Aufruf die Sitzung.

---

## Render

Der Dienst ist in [`render.yaml`](../../render.yaml) beschrieben — Region
Frankfurt, Build- und Startbefehl, Node 22, Lebenszeichen auf
`/api/healthz`. Die Datei enthält **keine Geheimnisse**: alle Werte mit
`sync: false` trägt der Besitzer einmal im Render-Dashboard ein.

### Umgebungsvariablen bei Render eintragen

Render → Dienst `baustift` → **Environment**. Woher jeder Wert kommt:

| Variable | Woher | Fehlt sie, dann … |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://baustift.onrender.com`, später die eigene Domain | **bricht der Build ab** (Absicht, siehe unten) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | App startet nicht |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ebenda → `anon` `public` | niemand kann sich anmelden |
| `SUPABASE_SERVICE_ROLE_KEY` | ebenda → `service_role` (**nie ins Frontend**) | Stripe-Webhook und Verbrauchsprotokoll scheitern |
| `ANTHROPIC_API_KEY` | <https://console.anthropic.com/settings/keys> | kein Angebot aus dem Diktat |
| `OPENAI_API_KEY` | <https://platform.openai.com/api-keys> | keine Sprachaufnahme |
| `STRIPE_SECRET_KEY` | Stripe → Developers → API keys (`sk_test_…` zum Üben) | kein Abo abschliessbar |
| `STRIPE_PRICE_ID` | Stripe → Product → Pricing → API ID (`price_…`) | Checkout scheitert |
| `STRIPE_WEBHOOK_SECRET` | Stripe → Webhooks → Signing secret (`whsec_…`) | Zahlung kommt nie im Konto an |
| `RESEND_API_KEY` | <https://resend.com/api-keys> — **freiwillig** | Versandknopf verschwindet, PDF wird heruntergeladen |
| `RESEND_ABSENDER` | `Name <post@deine-domain.de>`, Domain in Resend bestätigt — **freiwillig** | wie oben |
| `SENTRY_DSN` | Sentry → Projekt → Client Keys — **freiwillig** | Fehler stehen nur im Render-Log |

`npm run bereit --umgebung` prüft alle zwölf auf Vorhandensein und Form und
sagt zu jeder, wofür sie gebraucht wird. Die drei freiwilligen zählen nicht
als Fehler — ohne sie läuft die Anwendung, nur die jeweilige Funktion
entfällt. Es werden dabei **keine** Anfragen
an Stripe, Anthropic oder OpenAI geschickt.

> **`NEXT_PUBLIC_SITE_URL` muss schon beim Bauen dastehen.** Aus ihr
> entstehen der Bestätigungslink der Registrierung, der Link zum
> Zurücksetzen des Passworts, die Rücksprungadresse von Stripe und der
> Kundenlink zum Angebot. Fehlt sie, bricht der Produktionsbuild
> absichtlich ab (`src/lib/env.ts`) — besser, als stillschweigend auf
> `localhost` zu verlinken und erst am ersten Kunden zu merken, dass
> niemand hereinkommt.

### Einmalig in den Fremddiensten

1. **Supabase → Authentication → URL Configuration**
   - Site URL: `https://baustift.onrender.com`
   - Redirect URLs: `https://baustift.onrender.com/auth/callback`

   Fehlt das, landen Bestätigungs- und Passwort-Links ins Leere.

2. **Supabase → Migrationen einspielen.** Alle Dateien aus
   `supabase/migrations/` in aufsteigender Reihenfolge, etwa über
   `supabase db push` oder den SQL-Editor.

3. **Stripe → Developers → Webhooks → Endpoint**
   `https://baustift.onrender.com/api/stripe/webhook`. Diese Ereignisse
   abonnieren: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Das Signing Secret danach als
   `STRIPE_WEBHOOK_SECRET` eintragen und neu veröffentlichen.

4. **Eigene Domain (wenn gewünscht).** Render → Settings → Custom Domain.
   Render nennt die DNS-Einträge; das Zertifikat stellt Render selbst aus.
   Danach `NEXT_PUBLIC_SITE_URL` ändern, **neu bauen**, und die Adressen in
   Supabase und Stripe nachziehen.

---

## Was automatisch geprüft wird — und was nicht

Drei Stufen, die man nicht verwechseln sollte:

| Stufe | Befehl | Was wirklich angefasst wird |
|---|---|---|
| **Absicht** | `npm test` | Datenbank im Arbeitsspeicher, Attrappen für Whisper, Claude, Stripe und E-Mail. Prüft, was die Anwendung tun *will*. |
| **Verhalten** | `npm run test:db` | **Echtes Postgres.** Trigger, Summen, RLS, Unveränderlichkeit gestellter Rechnungen, und ob Browser und Datenbank dieselben Beträge rechnen. |
| | `npm run test:rauch` | Die **gebaute** Anwendung: alle Seiten und Routen, PDFs werden gerendert und wieder ausgelesen. |
| | `npm run erechnung` | **Offizielle Regelwerke**: CII-Schema D16B und der EN-16931-Schematron der EU-Kommission. |
| | `npm run mobil` | **Echter Chromium** bei 390 px und 360 px. |
| **Nur mit echten Zugangsdaten** | — | Registrierung, Bestätigungsmail, Passwort-Reset, echte Transkription, echte Extraktion, echter Stripe-Durchlauf, echter Mailversand. Siehe Live-Testplan unten. |

Dazu `npm run typecheck` und `npm run lint`. Alles zusammen läuft in CI
(`.github/workflows/ci.yml`) bei jedem Push.

### Sicherheitslücken in den Abhängigkeiten

`npm audit --omit=dev` muss **0** melden — das läuft in CI mit und bricht
den Lauf ab, sobald etwas auftaucht, das beim Nutzer ankommt.

`npm audit` ohne den Schalter meldet weiterhin neun Funde. Alle stecken im
Entwicklungswerkzeug: Tailwind 3 und ESLint bringen ältere
Glob-Bibliotheken mit (`micromatch`, `braces`, `fast-glob`). Die laufen
beim Bauen, sehen keine Nutzereingabe und werden nicht ausgeliefert.
Beheben liesse sich das nur mit einem Umstieg auf Tailwind 4 — anderes
Konfigurationsformat, und damit ein echtes Risiko für das Aussehen aller
Bildschirme. Das ist eine bewusste Entscheidung und kein übersehener
Punkt; sie gehört beim nächsten grösseren Aufräumen erledigt.

### Stände der E-Rechnungs-Prüfung

`npm run erechnung` lädt fremde Regelwerke — **auf feste Stände genagelt**,
damit das Ergebnis nicht davon abhängt, welcher Tag gerade ist:

| Regelwerk | Stand |
|---|---|
| EN 16931 (EU-Kommission) | `validation-1.3.16` |
| XRechnung (KoSIT) | `v2.6.0` |
| ISO-Schematron-Skelett | `2020-10-01` |
| Saxon-HE | Commit `355db68f` (12.4) |

Die Stände stehen als Konstanten oben in
`scripts/erechnung-pruefen.sh`. Heraufsetzen ist eine bewusste Entscheidung
mit eigenem Commit. Die geladenen Artefakte landen unter `.pruefung/` und
nicht im Git — über 100 MB fremder Code, jederzeit identisch neu ladbar.

---

## Live-Testplan

Dieser Teil lässt sich nicht automatisieren: er braucht echte Zugangsdaten
und löst echte Vorgänge aus. In dieser Reihenfolge, weil jeder Punkt den
nächsten voraussetzt. **Stripe dabei im Testmodus lassen** (`sk_test_…`),
sonst fliesst echtes Geld.

- [ ] `https://baustift.onrender.com/api/healthz` antwortet `{"status":"ok"}`
- [ ] `/` zeigt die Landingpage
- [ ] `/robots.txt` und `/sitemap.xml` liefern Text und XML, keine
      Weiterleitung auf die Anmeldung
- [ ] **Registrieren** unter `/signup`; Bestätigungsmail kommt an, der Link
      führt in die App *(prüft `NEXT_PUBLIC_SITE_URL` und die
      Supabase-Redirects)*
- [ ] **Passwort zurücksetzen** über `/passwort-vergessen`; Link führt auf
      `/passwort-neu` und das neue Passwort funktioniert
- [ ] Firmendaten eintragen — ohne sie ist das PDF kein Geschäftsdokument
- [ ] **Preisliste importieren** (CSV aus Excel, mit Umlauten)
- [ ] **Angebot einsprechen** *(prüft `OPENAI_API_KEY` und
      `ANTHROPIC_API_KEY`)*; unsichere Positionen erscheinen gelb
- [ ] Unsichere Positionen bestätigen — vorher lässt sich nichts versenden
- [ ] **PDF** öffnen und herunterladen
- [ ] **Per E-Mail versenden** *(prüft `RESEND_*`)*; die Mail enthält den
      Kundenlink
- [ ] **Kundenlink** in einem privaten Fenster öffnen (ohne Anmeldung):
      Angebot sichtbar, PDF ladbar, **annehmen** funktioniert
- [ ] Im Betrieb steht jetzt „Der Kunde hat zugesagt" und eine Mail ist
      angekommen
- [ ] Angebot **in eine Rechnung** umwandeln, Rechnung stellen
- [ ] **E-Rechnung** herunterladen und in der Buchhaltungssoftware des
      Vertrauens einlesen
- [ ] **Abo im Stripe-Testmodus** abschliessen; danach steht in Supabase
      bei `profiles` der Status auf `aktiv` — sonst kommt der Webhook nicht
      an. Testkarte: `4242 4242 4242 4242`
- [ ] Kundenportal öffnen und wieder schliessen
- [ ] **Datenexport** unter `/einstellungen` herunterladen
- [ ] Die Seite auf dem Handy zum Startbildschirm hinzufügen

---

## Was ausserhalb der Technik noch offen ist

Nichts davon ist Programmierarbeit:

1. **Rechtstexte ausfüllen.** `./scripts/platzhalter.sh` zeigt die offenen
   Stellen, `docs/rechtliches/checkliste.md` erklärt jede einzelne. Sie
   bleiben bewusst leer — sie brauchen echte Unternehmensdaten.
2. **AV-Verträge annehmen** bei Supabase, OpenAI, Anthropic, Stripe,
   Resend und Render. Abschnitt 5 derselben Checkliste.
3. **Anwaltliche Prüfung** der ausgefüllten Texte.
