export const metadata = { title: "Datenschutz · Baustift" };

/**
 * Informationspflichten nach Art. 13 DSGVO.
 *
 * Der wichtigste Teil ist die Liste der Empfänger: hier steht, wohin die
 * Daten tatsächlich fliessen. Diese Liste folgt aus der Architektur der App,
 * nicht aus einem Muster — sie ist zu aktualisieren, sobald ein Dienst
 * hinzukommt oder wegfällt. Wer hier einen Dienst vergisst, hat eine falsche
 * Erklärung veröffentlicht, und das ist schlimmer als eine unvollständige.
 *
 * Platzhalter in eckigen Klammern sind die Angaben, die nur der Betreiber
 * kennt. Alles andere ist bewusst ausformuliert und entspricht dem Stand des
 * Codes.
 */
/**
 * Wohin die Daten tatsächlich fliessen.
 *
 * Eine Liste statt zweier Auszeichnungen: die Angaben erscheinen auf dem
 * Handy als Karten und auf dem Rechner als Tabelle, dürfen sich dabei aber
 * niemals unterscheiden. Ein Dienst, der nur in einer der beiden Fassungen
 * steht, wäre eine falsche Datenschutzerklärung.
 */
const EMPFAENGER = [
  {
    dienst: "Supabase",
    zweck: "Datenbank, Anmeldung, Logo-Speicher",
    ort: "EU (Region Frankfurt)",
  },
  {
    dienst: "OpenAI",
    zweck: "Diktat in Text umwandeln",
    ort: "USA, Standardvertragsklauseln",
  },
  {
    dienst: "Anthropic",
    zweck: "Aus dem Text Angebotspositionen vorschlagen",
    ort: "USA, Standardvertragsklauseln",
  },
  {
    dienst: "Stripe",
    zweck: "Zahlungsabwicklung des Abonnements",
    ort: "EU/USA, Standardvertragsklauseln",
  },
  {
    dienst: "Resend",
    zweck:
      "Versand von Angeboten, Rechnungen und Erinnerungen an Auftraggeber — einschliesslich des angehängten PDF",
    ort: "USA, Standardvertragsklauseln",
  },
  {
    dienst: "[Hosting-Anbieter]",
    zweck: "Betrieb der Anwendung, Server-Protokolle",
    ort: "[Region]",
  },
  {
    dienst: "[Sentry, falls eingesetzt]",
    zweck: "Fehlerprotokolle ohne Inhalte",
    ort: "[Region]",
  },
];

export default function DatenschutzPage() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>

      <p>
        Diese Erklärung beschreibt, was mit den Daten geschieht, die bei der
        Nutzung von Baustift anfallen. Sie richtet sich an die
        Handwerksbetriebe, die Baustift nutzen. Für die Daten der Auftraggeber, die ein
        Betrieb hier erfasst, ist der Betrieb selbst verantwortlich; dafür
        gilt zusätzlich der{" "}
        <a href="/rechtliches/av-vertrag">Vertrag zur Auftragsverarbeitung</a>.
      </p>

      <h2>Verantwortlicher</h2>
      <p>
        [Firmenname], [Anschrift], [E-Mail]. Ein Datenschutzbeauftragter ist
        [nicht bestellt, da die Voraussetzungen des §38 BDSG nicht vorliegen /
        bestellt: Name, Kontakt].
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Kontodaten:</strong> E-Mail-Adresse und Passwort. Das
          Passwort wird nie im Klartext gespeichert, sondern nur als
          kryptografischer Hashwert, aus dem es sich nicht zurückrechnen
          lässt.
        </li>
        <li>
          <strong>Firmendaten:</strong> Name, Anschrift, Telefon, E-Mail,
          Website, Steuernummer, Umsatzsteuer-Identifikationsnummer,
          Bankverbindung und ein hochgeladenes Logo. Sie stehen auf den
          erzeugten Angeboten und Rechnungen und sind dort gesetzlich
          vorgeschrieben (§14 UStG).
        </li>
        <li>
          <strong>Inhaltsdaten:</strong> Preisliste, Kunden, Angebote,
          Rechnungen, Aufmasse und die dazugehörigen Positionen. Darin sind in der Regel
          personenbezogene Daten der Auftraggeber enthalten — Name, Anschrift,
          Kontaktdaten, Angaben zum Bauvorhaben.
        </li>
        <li>
          <strong>Aufmasse:</strong> die beim Messen erfassten Räume,
          Bezeichnungen und Masse sowie der dabei gesprochene Satz. Er bleibt
          gespeichert, damit ein Wert später nachvollziehbar ist.
        </li>
        <li>
          <strong>Diktate:</strong> die Sprachaufnahme wird zur Umwandlung in
          Text an einen Dienstleister übermittelt und danach verworfen. Wir
          speichern die Audiodatei nicht — es gibt in der Anwendung keinen
          Speicherort dafür. Gespeichert wird nur der Text, damit
          nachvollziehbar bleibt, woraus ein Angebot entstanden ist.
        </li>
        <li>
          <strong>Nutzungsdaten der automatisierten Verarbeitung:</strong> je
          Angebot halten wir fest, welches Modell verwendet wurde, wie viele
          Texteinheiten und Aufnahmesekunden verarbeitet wurden und welche
          Kosten dabei entstanden sind. Inhalte stehen darin nicht. Diese
          Angaben dienen der Abrechnung und der Kostenkontrolle.
        </li>
        <li>
          <strong>Zahlungsdaten:</strong> wir speichern die Kennungen, unter
          denen unser Zahlungsdienstleister das Konto und das Abonnement führt,
          sowie den Status des Abonnements. Karten- und Kontodaten sehen und
          speichern wir nicht; sie werden ausschliesslich beim
          Zahlungsdienstleister eingegeben und dort verarbeitet.
        </li>
        <li>
          <strong>Anfragezähler:</strong> zum Schutz vor Überlastung und
          Missbrauch halten wir je automatisierter Anfrage die Konto-Kennung
          und den Zeitpunkt fest. Diese Einträge werden nach spätestens einer
          Stunde automatisch gelöscht.
        </li>
        <li>
          <strong>Rückmeldungen:</strong> was im Testbetrieb über die
          Feedback-Funktion geschrieben wird, zusammen mit Konto-Kennung und
          Zeitpunkt.
        </li>
        <li>
          <strong>Fehlerprotokolle:</strong> schlägt ein Vorgang fehl, halten
          wir fest, welcher Vorgang betroffen war, welcher Fehlertyp auftrat
          und zu welchem Konto er gehörte. Inhalte werden dabei bewusst nicht
          protokolliert: keine Transkripte, keine Kundennamen, keine Beträge.
        </li>
        <li>
          <strong>Server-Protokolle:</strong> beim Aufruf fallen bei unserem
          Hosting-Anbieter technisch bedingt IP-Adresse, Zeitpunkt, aufgerufene
          Adresse und Browserkennung an.
        </li>
      </ul>

      <h2>Rechtsgrundlagen</h2>
      <p>
        Konto-, Firmen- und Inhaltsdaten sowie die Zahlungsabwicklung
        verarbeiten wir zur Erfüllung des Nutzungsvertrags (Art. 6 Abs. 1
        lit. b DSGVO). Fehlerprotokolle, Anfragezähler und Server-Protokolle
        stützen sich auf unser berechtigtes Interesse an einem sicheren und
        funktionsfähigen Betrieb (lit. f). Rückmeldungen im Testbetrieb sind
        freiwillig (lit. a); die Einwilligung ist jederzeit widerrufbar.
        Steuerlich aufbewahrungspflichtige Unterlagen verarbeiten wir zur
        Erfüllung einer rechtlichen Verpflichtung (lit. c).
      </p>

      <h2>Automatisierte Verarbeitung von Diktaten</h2>
      <p>
        Baustift wandelt ein Diktat in Text um und schlägt daraus Positionen
        für ein Angebot vor. Dabei kommen Sprachmodelle von Dienstleistern zum
        Einsatz. Übermittelt werden dafür die Aufnahme beziehungsweise der
        eingegebene Text sowie die Bezeichnungen aus der Preisliste. Der
        gespeicherte Kundendatensatz — Name, Anschrift, Kontaktdaten — wird
        nicht mitgeschickt; das Angebot wird dem Kunden erst danach in der
        Anwendung zugeordnet.
      </p>
      <p>
        Wer allerdings Namen oder Anschriften mitspricht („Bad bei Familie
        Becker, Lindenstrasse zwölf“), übermittelt sie als Teil des Textes
        mit. Wer das vermeiden will, diktiert die Leistung und ordnet den
        Kunden in der Anwendung zu. Die Preise stammen in jedem Fall aus der
        eigenen Preisliste und nie aus dem Modell.
      </p>
      <p>
        Es findet keine automatisierte Entscheidung im Sinne des Art. 22 DSGVO
        statt: das Ergebnis ist ein Vorschlag, der vor dem Versand geprüft und
        geändert werden kann, und ohne diese Freigabe verlässt nichts das
        Haus.
      </p>

      <h2>Empfänger und Auftragsverarbeiter</h2>

      {/* Auf dem Handy als Karten, ab `sm` als Tabelle — aus einer Quelle.
          Drei Spalten auf 390px hiessen entweder eine seitlich scrollende
          Tabelle, bei der niemand merkt, dass rechts noch etwas steht, oder
          "Standardvertragsklauseln" quer über den Rand. Beides ist bei einem
          Text, der gelesen werden muss, keine Lösung. */}
      <ul className="flex list-none flex-col gap-3 p-0 sm:hidden">
        {EMPFAENGER.map((e) => (
          <li
            key={e.dienst}
            className="flex flex-col gap-1 rounded-feld border border-linie p-3"
          >
            <span className="font-medium text-text">{e.dienst}</span>
            <span className="text-sm">{e.zweck}</span>
            <span className="text-sm">{e.ort}</span>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <table>
          <thead>
            <tr>
              <th>Dienst</th>
              <th>Wofür</th>
              <th>Ort der Verarbeitung</th>
            </tr>
          </thead>
          <tbody>
            {EMPFAENGER.map((e) => (
              <tr key={e.dienst}>
                <td>{e.dienst}</td>
                <td>{e.zweck}</td>
                <td>{e.ort}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Mit allen genannten Dienstleistern bestehen Verträge zur
        Auftragsverarbeitung nach Art. 28 DSGVO. Für die Übermittlung in die
        USA gelten Standardvertragsklauseln; soweit ein Anbieter unter dem
        EU-US Data Privacy Framework zertifiziert ist, stützt sich die
        Übermittlung zusätzlich darauf. Inhalte, die an OpenAI und Anthropic
        übermittelt werden, werden dort nach Angaben der Anbieter nicht zum
        Training von Modellen verwendet.
      </p>

      <h2>Speicherdauer</h2>
      <ul>
        <li>Sprachaufnahmen: nicht gespeichert.</li>
        <li>Anfragezähler: spätestens nach einer Stunde gelöscht.</li>
        <li>
          Konto-, Firmen- und Inhaltsdaten: bis zur Löschung des Kontos. Die
          Löschung wird sofort und vollständig ausgeführt und umfasst Kunden,
          Preisliste, Angebote, Rechnungen und Rückmeldungen.
        </li>
        <li>
          Unterlagen, die steuerlich aufbewahrungspflichtig sind, bewahren wir
          auch nach einer Löschung für die gesetzliche Frist auf, soweit wir
          dazu verpflichtet sind.
        </li>
        <li>Fehlerprotokolle: [Frist, üblich 30 Tage].</li>
        <li>Server-Protokolle: [Frist des Hosting-Anbieters, üblich 7–30 Tage].</li>
      </ul>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16),
        Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18),
        Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen,
        die sich auf ein berechtigtes Interesse stützen (Art. 21).
      </p>
      <p>
        Zwei davon sind in der Anwendung eingebaut und brauchen keine Anfrage:
        unter „Konto“ lassen sich alle eigenen Daten in maschinenlesbarer Form
        herunterladen und das Konto samt aller Daten löschen. Für alles Weitere
        genügt eine Nachricht an [E-Mail].
      </p>
      <p>
        Ausserdem steht dir ein Beschwerderecht bei einer Aufsichtsbehörde zu,
        zuständig ist [Aufsichtsbehörde des Bundeslandes].
      </p>

      <h2>Cookies</h2>
      <p>
        Wir setzen ausschliesslich technisch notwendige Cookies, die die
        Anmeldung aufrechterhalten. Es findet kein Tracking, keine Analyse des
        Nutzungsverhaltens und keine Werbemessung statt — deshalb gibt es auch
        kein Einwilligungsbanner.
      </p>

      <h2>Änderungen</h2>
      <p>
        Ändert sich die Verarbeitung — etwa weil ein Dienstleister hinzukommt —
        aktualisieren wir diese Erklärung und informieren über wesentliche
        Änderungen per E-Mail.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
