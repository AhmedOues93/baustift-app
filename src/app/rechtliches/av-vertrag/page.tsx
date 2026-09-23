export const metadata = { title: "Auftragsverarbeitung · Baustift" };

/**
 * Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.
 *
 * Warum das kein optionales Extra ist: der Handwerker gibt uns Namen und
 * Anschriften SEINER Kunden. Damit ist er Verantwortlicher und wir
 * Auftragsverarbeiter — ohne diesen Vertrag ist die Nutzung für ihn
 * rechtswidrig. Fehlt er, verliert man genau die Kunden, die sauber
 * arbeiten wollen.
 */
export default function AvVertragPage() {
  return (
    <>
      <h1>Vertrag zur Auftragsverarbeitung</h1>

      <p>
        zwischen dem Nutzer (nachfolgend „Verantwortlicher“) und [Firmenname]
        (nachfolgend „Auftragsverarbeiter“), geschlossen mit der Zustimmung
        bei Abschluss des Abonnements.
      </p>

      <h2>1. Gegenstand</h2>
      <p>
        Der Auftragsverarbeiter verarbeitet personenbezogene Daten
        ausschliesslich weisungsgebunden zur Erbringung der vertraglich
        vereinbarten Leistung: Erstellung, Speicherung und Ausgabe von
        Angeboten.
      </p>

      <h2>2. Art der Daten und betroffene Personen</h2>
      <ul>
        <li>
          Daten: Name, Anschrift, Kontaktdaten, Angaben zum Bauvorhaben,
          Beträge.
        </li>
        <li>Betroffene: Auftraggeber und Ansprechpartner des Nutzers.</li>
      </ul>

      <h2>3. Dauer</h2>
      <p>
        Die Verarbeitung dauert an, solange der Nutzungsvertrag besteht.
        Nach Beendigung werden die Daten gelöscht oder auf Wunsch
        herausgegeben, soweit keine gesetzliche Aufbewahrungspflicht besteht.
      </p>

      <h2>4. Technische und organisatorische Massnahmen</h2>
      <ul>
        <li>Verschlüsselte Übertragung (TLS) auf allen Wegen.</li>
        <li>Verschlüsselte Speicherung der Datenbank und der Dateien.</li>
        <li>
          Mandantentrennung auf Datenbankebene: jede Abfrage ist durch
          Zugriffsregeln (Row Level Security) auf das eigene Konto begrenzt.
        </li>
        <li>
          Sprachaufnahmen werden nach der Umwandlung in Text nicht
          gespeichert.
        </li>
        <li>Zugriff auf Produktionsdaten nur für benannte Personen.</li>
        <li>Regelmässige Sicherungen mit geprüfter Wiederherstellung.</li>
      </ul>

      <h2>5. Unterauftragsverarbeiter</h2>
      <p>
        Der Verantwortliche stimmt dem Einsatz der in der
        Datenschutzerklärung genannten Dienstleister zu. Über Änderungen
        informieren wir mit einer Frist von [Frist]; es besteht ein
        Widerspruchsrecht.
      </p>

      <h2>6. Unterstützungspflichten</h2>
      <p>
        Der Auftragsverarbeiter unterstützt den Verantwortlichen bei
        Betroffenenanfragen, Datenschutz-Folgenabschätzungen und meldet
        Verletzungen des Schutzes personenbezogener Daten unverzüglich,
        spätestens innerhalb von 24 Stunden nach Kenntnis.
      </p>

      <h2>7. Kontrollrechte</h2>
      <p>
        Der Verantwortliche kann die Einhaltung überprüfen, nach vorheriger
        Ankündigung und ohne unverhältnismässige Betriebsstörung.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
