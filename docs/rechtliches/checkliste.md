# Rechtstexte fertigstellen

Die vier Seiten unter `/rechtliches` sind ausformuliert und beschreiben die
Technik dieser Anwendung korrekt. Offen ist alles, was nur du wissen kannst:
Firmierung, Anschrift, Fristen, Hosting-Region.

`./scripts/platzhalter.sh` zeigt jederzeit, was noch fehlt.

**Diese Checkliste ist keine Rechtsberatung.** Sie ist die Vorarbeit, die
sonst ein Anwalt mühsam von dir erfragen müsste. Er prüft danach, statt zu
schreiben — das ist der Unterschied zwischen einer teuren und einer sehr
teuren Rechnung.

---

## 1. Angaben zum Unternehmen

Kommen in allen vier Texten vor.

| Angabe | Wo du sie findest |
|---|---|
| Firmenname | Gewerbeanmeldung oder Handelsregisterauszug — exakt wie dort |
| Anschrift | ladungsfähig, kein Postfach |
| Telefon, E-Mail | eine Adresse, die du wirklich liest |
| Vertretungsberechtigte | nur bei GmbH/UG/GbR |
| Registergericht und HRB | nur bei GmbH/UG |
| USt-IdNr. | nur falls vorhanden. **Die Steuernummer gehört nicht ins Impressum.** |
| Gerichtsstand (AGB) | üblich: Sitz deines Unternehmens |

Bei einem Einzelunternehmen entfallen Register und Vertretung — dann steht
dort dein Vor- und Nachname, auch wenn du unter einer Geschäftsbezeichnung
auftrittst.

## 2. Hosting

In der Datenschutzerklärung stehen `[Hosting-Anbieter]` und `[Region]`.
Läuft die Anwendung auf Vercel, trag Vercel ein und die Region, in der die
Funktionen ausgeführt werden — bei einem deutschen Produkt sinnvollerweise
Frankfurt (`fra1`). Das ist in den Projekteinstellungen des Hosters zu
sehen und dort auch umzustellen.

## 3. Fristen

Vier Stück, alle frei wählbar, alle mit einem üblichen Wert im Text:

- **Aufbewahrung nach Kündigung** (AGB 5): wie lange das Konto nach
  Vertragsende noch zum Export offen bleibt. Üblich 30 Tage.
- **Änderung der AGB** (AGB 9): Vorlauf der Ankündigung. Üblich 6 Wochen.
- **Wechsel eines Dienstleisters** (AV 5): Vorlauf. Üblich 4 Wochen.
- **Fehler- und Server-Protokolle** (Datenschutz): wie lange sie liegen.
  Üblich 30 beziehungsweise 7–30 Tage. Frag den Hoster, was er tatsächlich
  aufbewahrt — hier etwas zu behaupten, was nicht stimmt, ist das Risiko.

## 4. Aufsichtsbehörde

In der Datenschutzerklärung ist die Datenschutzbehörde deines Bundeslandes
zu nennen — nicht die des Kunden. Für Nordrhein-Westfalen etwa die
Landesbeauftragte für Datenschutz und Informationsfreiheit NRW.

## 5. AV-Verträge mit deinen Dienstleistern

Das ist die Sache, die du immer wieder gefragt hast. Kurz: du speicherst
Kundendaten deiner Handwerker nicht selbst, sondern bei anderen. Rechtlich
bist du der Verantwortliche, die anderen sind deine Auftragsverarbeiter, und
der AV-Vertrag hält fest, dass sie mit den Daten nur das tun, was du sagst.

Kein Anwalt nötig, kein Papier — bei allen ein fertiger Text im Dashboard,
den du annimmst. Einmal, zehn Minuten:

| Dienst | Wo | Was dabei wichtig ist |
|---|---|---|
| **Supabase** | Dashboard → Organization → Legal Documents → DPA | Projekt muss in der **EU-Region Frankfurt** liegen. Ein US-Projekt lässt sich später **nicht** umziehen — falls es schon falsch steht: neu anlegen, solange noch keine echten Daten drin sind. |
| **OpenAI** | Platform → Settings → Organization → Data Processing Addendum | Dort auch prüfen, dass API-Daten nicht zum Training verwendet werden (Standard bei der API). |
| **Anthropic** | Console → Settings → Legal/Compliance → DPA | Gleiches Thema; bei der API kein Training auf Kundendaten. |
| **Stripe** | Im Stripe-DPA enthalten, gilt mit den Nutzungsbedingungen | Nichts weiter zu tun, aber einmal gelesen haben. |
| **Resend** | Dashboard → Settings → Legal → DPA | Wird oft vergessen: **über Resend gehen Name, E-Mail und das komplette PDF deiner Endkunden.** Ohne DPA ist der Versand der Schwachpunkt. |
| **Hoster (Vercel o. a.)** | Dashboard → Settings → Legal → DPA | |
| **Sentry** | nur falls du `SENTRY_DSN` setzt | Ohne die Variable geht nichts dorthin, dann entfällt es. |

Danach: die Zeile `[Sentry, falls eingesetzt]` in der Datenschutzerklärung
entweder ausfüllen oder die Zeile löschen.

## 6. Zum Schluss

- `[Datum]` in allen drei Texten auf den Tag der Veröffentlichung setzen.
- `./scripts/platzhalter.sh` muss leer ausgehen.
- Dann erst zum Anwalt. Mit ausgefüllten Texten ist das eine Prüfung,
  keine Erstellung.

## Was die Texte über die Technik sagen — und was das im Code bedeutet

Damit du bei Rückfragen sprechfähig bist, und damit klar ist, was beim
Ändern der Architektur mitgepflegt werden muss:

| Zusage im Text | Wo sie im Code eingelöst wird |
|---|---|
| Keine Sprachaufnahmen gespeichert | `api/angebote/neu`: kein Upload, `audio_path` bleibt leer. Seit Migration 0011 gibt es den Speicherort dafür gar nicht mehr — geprüft in `supabase/test/10_flow.sql`, Schritt 21. |
| Keine PDF-Sammlung | `api/angebote/[id]/pdf` erzeugt bei jedem Abruf neu, `pdf_path` bleibt leer. |
| Mandantentrennung in der Datenbank | Row Level Security auf jeder Tabelle, geprüft in `10_flow.sql`, Schritte 6, 7, 13, 16. |
| Rechnungen unveränderlich | Trigger in `0005_rechnungen.sql`, geprüft in Schritt 10. |
| Nummern lückenlos | `next_angebot_nummer` / `next_rechnung_nummer`, geprüft in Schritt 12. |
| Protokolle ohne Inhalte | `src/lib/protokoll.ts` — nur Vorgang, Fehlertyp, Konto-ID. |
| Export und Löschung eingebaut | `api/konto/export`, `einstellungen/konto-actions.ts`. |
| Kundendatensatz geht nicht an die Sprachmodelle | `src/lib/ai/extract-angebot.ts` — übermittelt Transkript und Preislisten-Bezeichnungen, nicht den Kundensatz. Im Diktat mitgesprochene Namen sind Teil des Textes; genau so steht es auch in der Datenschutzerklärung. |
