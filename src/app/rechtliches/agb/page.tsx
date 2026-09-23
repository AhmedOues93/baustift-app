export const metadata = { title: "AGB · Baustift" };

/** Entwurf. Vor dem Verkauf anwaltlich prüfen lassen. */
export default function AgbPage() {
  return (
    <>
      <h1>Allgemeine Geschäftsbedingungen</h1>

      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Bedingungen gelten für die Nutzung der Software Baustift durch
        Unternehmer im Sinne des §14 BGB. Ein Angebot an Verbraucher erfolgt
        nicht.
      </p>

      <h2>2. Leistung</h2>
      <p>
        Baustift ist eine Software zur Erstellung von Angeboten. Die
        Anwendung erzeugt Vorschläge mithilfe automatisierter Verfahren.
        Diese Vorschläge sind zu prüfen; verantwortlich für Inhalt, Preise
        und Rechtmässigkeit des versendeten Angebots bleibt der Nutzer.
      </p>

      <h2>3. Vertragsschluss, Testphase</h2>
      <p>
        Mit der Registrierung beginnt eine kostenlose Testphase im Umfang von
        [Anzahl] Angeboten. Ein kostenpflichtiges Abonnement kommt erst mit
        dem Abschluss über den Zahlungsdienstleister zustande.
      </p>

      <h2>4. Preise und Zahlung</h2>
      <p>
        Das Abonnement kostet [Betrag] € pro Monat zzgl. gesetzlicher
        Umsatzsteuer. Die Abrechnung erfolgt monatlich im Voraus über
        [Zahlungsdienstleister]. Im Abonnement sind [Anzahl] Angebote pro
        Kalendermonat enthalten.
      </p>

      <h2>5. Laufzeit und Kündigung</h2>
      <p>
        Der Vertrag läuft auf unbestimmte Zeit und kann von beiden Seiten mit
        einer Frist von [Frist] zum Ende des Abrechnungszeitraums gekündigt
        werden. Die Kündigung ist jederzeit im Kundenportal möglich.
      </p>

      <h2>6. Pflichten des Nutzers</h2>
      <ul>
        <li>Zugangsdaten sind vertraulich zu behandeln.</li>
        <li>
          Es dürfen keine Inhalte eingegeben werden, für deren Verarbeitung
          keine Berechtigung besteht.
        </li>
        <li>
          Automatisierte Massennutzung, die über den vertraglichen Umfang
          hinausgeht, ist untersagt.
        </li>
      </ul>

      <h2>7. Verfügbarkeit</h2>
      <p>
        Wir bemühen uns um eine hohe Verfügbarkeit, schulden jedoch keine
        bestimmte Quote. Wartungsarbeiten werden nach Möglichkeit angekündigt.
      </p>

      <h2>8. Haftung</h2>
      <p>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie
        bei Verletzung von Leben, Körper und Gesundheit. Bei leicht
        fahrlässiger Verletzung wesentlicher Vertragspflichten ist die
        Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.
        Im Übrigen ist die Haftung ausgeschlossen.
      </p>

      <h2>9. Datenschutz</h2>
      <p>
        Es gelten die Datenschutzerklärung und der Vertrag zur
        Auftragsverarbeitung.
      </p>

      <h2>10. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht. Gerichtsstand ist [Ort], soweit gesetzlich
        zulässig.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
