import { KONTINGENT, PREIS_MONATLICH_EUR } from "@/lib/abo";

export const metadata = { title: "AGB · Baustift" };

/**
 * Allgemeine Geschäftsbedingungen.
 *
 * Preis und Kontingente kommen aus derselben Konstante wie die Abo-Seite und
 * die Kontingentprüfung. Sie von Hand hierher zu schreiben wäre die sicherste
 * Art, irgendwann AGB zu haben, die etwas anderes versprechen als die
 * Software tut — und genau das ist der teure Fehler.
 *
 * Vor dem Verkauf anwaltlich prüfen lassen: AGB-Recht ist in Deutschland
 * abmahnfähig, und eine unwirksame Klausel fällt ersatzlos weg.
 */
export default function AgbPage() {
  return (
    <>
      <h1>Allgemeine Geschäftsbedingungen</h1>

      <h2>1. Geltungsbereich und Vertragspartner</h2>
      <p>
        Diese Bedingungen gelten für die Nutzung der Software Baustift,
        angeboten von [Firmenname], [Anschrift]. Baustift richtet sich
        ausschliesslich an Unternehmer im Sinne des §14 BGB. Ein Angebot an
        Verbraucher erfolgt nicht; ein Widerrufsrecht besteht daher nicht.
      </p>
      <p>
        Abweichende Bedingungen des Nutzers gelten nur, wenn wir ihnen
        ausdrücklich in Textform zustimmen.
      </p>

      <h2>2. Leistung</h2>
      <p>
        Baustift nimmt eine gesprochene oder geschriebene Beschreibung
        entgegen, schlägt daraus Positionen für ein Angebot vor, gleicht sie
        mit der hinterlegten Preisliste ab und erzeugt daraus Angebots- und
        Rechnungsdokumente. Die Bereitstellung erfolgt als Software über das
        Internet; eine Überlassung von Programmdateien findet nicht statt.
      </p>
      <p>
        Die Vorschläge entstehen mithilfe automatisierter Verfahren und können
        fehlerhaft oder unvollständig sein. Sie sind vor dem Versand zu prüfen.
        Verantwortlich für Inhalt, Mengen, Preise, steuerliche Richtigkeit und
        Rechtmässigkeit eines versendeten Angebots oder einer Rechnung bleibt
        allein der Nutzer. Baustift ist ein Werkzeug und ersetzt weder eine
        fachliche Kalkulation noch eine steuerliche Beratung.
      </p>

      <h2>3. Vertragsschluss und Testphase</h2>
      <p>
        Mit der Registrierung beginnt eine kostenlose Testphase, in der{" "}
        <span className="zahl">{KONTINGENT.trial}</span> Angebote enthalten
        sind. Die Testphase endet mit dem Verbrauch dieses Kontingents und geht
        nicht automatisch in ein kostenpflichtiges Abonnement über. Ein
        kostenpflichtiger Vertrag kommt erst zustande, wenn der Nutzer das
        Abonnement über den Zahlungsdienstleister abschliesst.
      </p>

      <h2>4. Preise und Zahlung</h2>
      <p>
        Das Abonnement kostet{" "}
        <span className="zahl">{PREIS_MONATLICH_EUR}</span> € pro Monat zzgl.
        gesetzlicher Umsatzsteuer. Die Abrechnung erfolgt monatlich im Voraus
        über unseren Zahlungsdienstleister Stripe. Enthalten sind{" "}
        <span className="zahl">{KONTINGENT.aktiv}</span> Angebote je
        Kalendermonat; nicht genutzte Angebote verfallen zum Monatsende und
        werden nicht erstattet. Wer regelmässig mehr braucht, vereinbart mit
        uns eine gesonderte Abrede.
      </p>
      <p>
        Das Kontingent dient dem Schutz vor unverhältnismässigen Kosten der
        automatisierten Verarbeitung, nicht der künstlichen Verknappung. Ein
        gewöhnlicher Handwerksbetrieb erreicht es im Normalbetrieb nicht.
      </p>

      <h2>5. Laufzeit und Kündigung</h2>
      <p>
        Der Vertrag läuft auf unbestimmte Zeit. Beide Seiten können ihn
        jederzeit zum Ende des laufenden Abrechnungsmonats kündigen. Die
        Kündigung ist jederzeit im Kundenportal möglich, das unter „Abo“
        erreichbar ist; eine Begründung ist nicht erforderlich. Das Recht zur
        ausserordentlichen Kündigung aus wichtigem Grund bleibt unberührt.
      </p>
      <p>
        Nach Vertragsende bleibt das Konto für [Frist] eingeschränkt
        zugänglich, damit Daten exportiert werden können; danach werden sie
        gelöscht. Der Export ist jederzeit auch vorher unter „Konto“ möglich.
      </p>

      <h2>6. Pflichten des Nutzers</h2>
      <ul>
        <li>Zugangsdaten sind vertraulich zu behandeln und nicht weiterzugeben.</li>
        <li>
          Es dürfen nur Daten eingegeben werden, für deren Verarbeitung der
          Nutzer berechtigt ist. Für die Rechtmässigkeit der Verarbeitung der
          Daten seiner Auftraggeber ist der Nutzer verantwortlich; es gilt der{" "}
          <a href="/rechtliches/av-vertrag">
            Vertrag zur Auftragsverarbeitung
          </a>
          .
        </li>
        <li>
          Die erzeugten Dokumente sind vor dem Versand zu prüfen (siehe
          Abschnitt 2).
        </li>
        <li>
          Automatisierte Massennutzung über den vertraglichen Umfang hinaus,
          Umgehung der Nutzungsgrenzen und Weitergabe des Zugangs an Dritte
          sind untersagt.
        </li>
        <li>
          Der Nutzer ist für die Aufbewahrung seiner steuerlich relevanten
          Unterlagen selbst verantwortlich. Baustift ersetzt keine
          revisionssichere Archivierung im Sinne der GoBD.
        </li>
      </ul>

      <h2>7. Verfügbarkeit</h2>
      <p>
        Wir bemühen uns um eine hohe Verfügbarkeit, schulden aber keine
        bestimmte Quote. Wartungsarbeiten kündigen wir nach Möglichkeit vorher
        an und legen sie ausserhalb der üblichen Arbeitszeiten. Zeiten, in
        denen ein eingesetzter Dienstleister ausfällt, liegen ausserhalb
        unseres Einflussbereichs.
      </p>

      <h2>8. Haftung</h2>
      <p>
        Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei
        der Verletzung von Leben, Körper oder Gesundheit. Bei leicht
        fahrlässiger Verletzung einer wesentlichen Vertragspflicht — also einer
        Pflicht, deren Erfüllung die ordnungsgemässe Durchführung des Vertrags
        überhaupt erst ermöglicht und auf deren Einhaltung der Nutzer
        regelmässig vertrauen darf — ist die Haftung auf den
        vertragstypischen, vorhersehbaren Schaden begrenzt. Im Übrigen ist die
        Haftung ausgeschlossen. Die Haftung nach dem Produkthaftungsgesetz
        bleibt unberührt.
      </p>
      <p>
        Für Schäden, die daraus entstehen, dass ein automatisiert erzeugter
        Vorschlag ungeprüft übernommen und versendet wurde, haften wir nicht;
        die Prüfpflicht nach Abschnitt 2 liegt beim Nutzer.
      </p>
      <p>
        Für den Verlust von Daten haften wir nur in dem Umfang, der bei
        ordnungsgemässer und regelmässiger Sicherung durch den Nutzer entstanden
        wäre.
      </p>

      <h2>9. Änderungen dieser Bedingungen</h2>
      <p>
        Wir können diese Bedingungen mit Wirkung für die Zukunft ändern, wenn
        dafür ein sachlicher Grund besteht. Über Änderungen informieren wir
        mindestens [Frist, üblich 6 Wochen] vorher per E-Mail. Widerspricht der
        Nutzer nicht bis zum Wirksamwerden, gelten sie als angenommen; darauf
        weisen wir in der Mitteilung gesondert hin. Im Fall des Widerspruchs
        kann jede Seite zum Wirksamwerden kündigen.
      </p>

      <h2>10. Datenschutz</h2>
      <p>
        Es gelten die{" "}
        <a href="/rechtliches/datenschutz">Datenschutzerklärung</a> und der{" "}
        <a href="/rechtliches/av-vertrag">Vertrag zur Auftragsverarbeitung</a>.
      </p>

      <h2>11. Schlussbestimmungen</h2>
      <p>
        Es gilt deutsches Recht unter Ausschluss des UN-Kaufrechts.
        Ausschliesslicher Gerichtsstand für alle Streitigkeiten aus diesem
        Vertrag ist [Ort], soweit der Nutzer Kaufmann, juristische Person des
        öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen ist.
      </p>
      <p>
        Sollte eine Bestimmung unwirksam sein, bleibt der Vertrag im Übrigen
        wirksam.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
