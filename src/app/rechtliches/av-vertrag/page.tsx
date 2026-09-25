export const metadata = { title: "Auftragsverarbeitung · Baustift" };

/**
 * Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.
 *
 * Warum das kein optionales Extra ist: der Handwerker gibt uns Namen und
 * Anschriften SEINER Kunden. Damit ist er Verantwortlicher und wir sind
 * Auftragsverarbeiter — ohne diesen Vertrag ist die Nutzung für ihn
 * rechtswidrig. Fehlt er, verliert man genau die Kunden, die sauber arbeiten
 * wollen.
 *
 * Abschnitt 4 (technische und organisatorische Massnahmen) beschreibt, was
 * die Anwendung tatsächlich tut. Er ist deshalb mitzupflegen, wenn sich die
 * Architektur ändert: eine Zusage, die der Code nicht einlöst, ist schlimmer
 * als keine.
 */
export default function AvVertragPage() {
  return (
    <>
      <h1>Vertrag zur Auftragsverarbeitung</h1>

      <p>
        zwischen dem Nutzer (nachfolgend „Verantwortlicher“) und [Firmenname]
        (nachfolgend „Auftragsverarbeiter“). Der Vertrag kommt mit der
        Zustimmung bei der Registrierung zustande und gilt für die gesamte
        Dauer der Nutzung.
      </p>

      <h2>1. Gegenstand und Weisungsbindung</h2>
      <p>
        Der Auftragsverarbeiter verarbeitet personenbezogene Daten
        ausschliesslich zur Erbringung der vereinbarten Leistung: Erfassung von
        Kunden und Preisen, Erstellung von Angeboten aus Diktat oder Text,
        Erstellung von Rechnungen, Erzeugung und Versand der zugehörigen
        PDF-Dokumente sowie Erinnerungen an offene Posten.
      </p>
      <p>
        Die Verarbeitung erfolgt ausschliesslich auf dokumentierte Weisung des
        Verantwortlichen. Als Weisung gilt auch die Bedienung der Anwendung
        durch den Verantwortlichen. Hält der Auftragsverarbeiter eine Weisung
        für rechtswidrig, teilt er dies mit und darf ihre Ausführung aussetzen.
      </p>

      <h2>2. Art der Daten und betroffene Personen</h2>
      <ul>
        <li>
          <strong>Datenarten:</strong> Name, Anschrift, Ansprechpartner,
          Telefonnummer, E-Mail-Adresse, Notizen zum Auftrag, Angaben zum
          Bauvorhaben, Leistungspositionen, Mengen, Preise, Beträge,
          Zahlungsstände sowie die Texte aus Diktaten.
        </li>
        <li>
          <strong>Betroffene Personen:</strong> Auftraggeber des
          Verantwortlichen sowie deren Ansprechpartner.
        </li>
        <li>
          <strong>Zweck:</strong> Angebots- und Rechnungsstellung des
          Verantwortlichen gegenüber seinen Auftraggebern.
        </li>
      </ul>

      <h2>3. Dauer</h2>
      <p>
        Die Verarbeitung dauert an, solange der Nutzungsvertrag besteht. Nach
        dessen Ende werden die Daten gelöscht. Der Verantwortliche kann sie
        vorher jederzeit selbst herunterladen; er ist dafür nicht auf eine
        Anfrage angewiesen (siehe Abschnitt 6).
      </p>

      <h2>4. Technische und organisatorische Massnahmen (Art. 32 DSGVO)</h2>

      <h3>Vertraulichkeit</h3>
      <ul>
        <li>
          <strong>Mandantentrennung in der Datenbank selbst.</strong> Jede
          Tabelle mit Nutzerdaten ist durch Zugriffsregeln auf Datenbankebene
          („Row Level Security“) geschützt: eine Abfrage liefert ausschliesslich
          Zeilen des eigenen Kontos. Die Trennung hängt damit nicht davon ab,
          dass die Anwendung bei jeder Abfrage korrekt filtert — sie greift
          auch dann, wenn ein Programmierfehler das vergessen sollte.
        </li>
        <li>
          <strong>Verschlüsselte Übertragung</strong> auf allen Wegen (TLS),
          auch zu den eingesetzten Dienstleistern.
        </li>
        <li>
          <strong>Verschlüsselte Speicherung</strong> der Datenbank und der
          abgelegten Dateien.
        </li>
        <li>
          <strong>Passwörter</strong> werden nur als kryptografischer Hashwert
          gespeichert und sind nicht rückrechenbar.
        </li>
        <li>
          Zugriff auf Produktionsdaten haben nur benannte Personen, und nur
          soweit er für den Betrieb erforderlich ist.
        </li>
      </ul>

      <h3>Datensparsamkeit</h3>
      <ul>
        <li>
          <strong>Sprachaufnahmen werden nicht gespeichert.</strong> Sie
          enthalten Namen, Anschriften und Gesprächsfetzen Dritter und werden
          nach der Umwandlung in Text verworfen. In der Anwendung existiert
          kein Speicherort für Audiodateien.
        </li>
        <li>
          <strong>PDF-Dokumente werden nicht abgelegt,</strong> sondern bei
          jedem Abruf neu erzeugt. Es gibt damit keine Sammlung fertiger
          Dokumente mit Kundendaten.
        </li>
        <li>
          <strong>Fehlerprotokolle enthalten keine Inhalte.</strong>
          Protokolliert werden Vorgang, Fehlertyp und Konto-Kennung, niemals
          Transkripte, Kundennamen oder Beträge.
        </li>
        <li>
          An die Sprachmodelle gehen das Diktat und die Bezeichnungen aus der
          Preisliste. Der gespeicherte Kundendatensatz wird nicht
          mitübermittelt; enthält das Diktat selbst Namen oder Anschriften,
          sind sie allerdings Teil des Textes.
        </li>
      </ul>

      <h3>Integrität und Verfügbarkeit</h3>
      <ul>
        <li>
          Gestellte Rechnungen sind in der Datenbank unveränderlich: Nummer,
          Datum, Beträge und Positionen lassen sich nach dem Festschreiben
          nicht mehr ändern, auch nicht versehentlich. Korrekturen laufen über
          eine Stornorechnung mit eigener Nummer.
        </li>
        <li>
          Rechnungs- und Angebotsnummern werden lückenlos und ohne Doppelungen
          vergeben.
        </li>
        <li>
          Regelmässige Sicherungen durch den Datenbank-Anbieter mit geprüfter
          Wiederherstellung.
        </li>
        <li>
          Eine Bremse begrenzt die Zahl automatisierter Anfragen je Konto und
          schützt den Betrieb vor Überlastung.
        </li>
      </ul>

      <h3>Überprüfbarkeit</h3>
      <ul>
        <li>
          Die Trennung der Mandanten, die Unveränderlichkeit der Rechnungen und
          die Vergabe der Nummern sind durch automatisierte Tests gegen eine
          echte Datenbank abgesichert, die bei jeder Änderung laufen.
        </li>
      </ul>

      <h2>5. Unterauftragsverarbeiter</h2>
      <p>
        Der Verantwortliche stimmt dem Einsatz der in der{" "}
        <a href="/rechtliches/datenschutz">Datenschutzerklärung</a> genannten
        Dienstleister zu. Diese sind dort mit Zweck und Ort der Verarbeitung
        einzeln aufgeführt. Über den Wechsel oder die Hinzunahme eines
        Dienstleisters informieren wir mindestens [Frist, üblich 4 Wochen]
        vorher per E-Mail; der Verantwortliche kann widersprechen und in diesem
        Fall ausserordentlich kündigen.
      </p>

      <h2>6. Unterstützung des Verantwortlichen</h2>
      <p>
        Der Auftragsverarbeiter unterstützt den Verantwortlichen bei der
        Beantwortung von Betroffenenanfragen und bei
        Datenschutz-Folgenabschätzungen. Für Auskunft, Übertragbarkeit und
        Löschung ist keine Anfrage nötig: die Anwendung stellt unter „Konto“
        einen vollständigen Export aller Daten in maschinenlesbarer Form bereit
        sowie die sofortige Löschung des Kontos mit allen zugehörigen Daten.
      </p>

      <h2>7. Meldung von Verletzungen</h2>
      <p>
        Verletzungen des Schutzes personenbezogener Daten meldet der
        Auftragsverarbeiter dem Verantwortlichen unverzüglich, spätestens
        innerhalb von 24 Stunden nach Kenntnis, mit allen Angaben, die dieser
        für seine eigene Meldung nach Art. 33 DSGVO benötigt.
      </p>

      <h2>8. Löschung und Rückgabe</h2>
      <p>
        Nach Beendigung des Vertrags werden die Daten gelöscht, soweit keine
        gesetzliche Aufbewahrungspflicht entgegensteht. Der Verantwortliche ist
        dafür verantwortlich, seine Daten vorher zu exportieren, wenn er sie
        behalten möchte.
      </p>

      <h2>9. Kontrollrechte</h2>
      <p>
        Der Verantwortliche kann die Einhaltung dieser Pflichten überprüfen,
        nach vorheriger Ankündigung in angemessener Frist und ohne
        unverhältnismässige Störung des Betriebs. Der Nachweis kann auch durch
        geeignete Dokumentation oder Zertifikate der eingesetzten Dienstleister
        erbracht werden.
      </p>

      <h2>10. Vertraulichkeit</h2>
      <p>
        Alle mit der Verarbeitung befassten Personen sind zur Vertraulichkeit
        verpflichtet; die Verpflichtung besteht über das Ende ihrer Tätigkeit
        hinaus fort.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
