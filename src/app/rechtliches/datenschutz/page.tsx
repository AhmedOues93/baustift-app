export const metadata = { title: "Datenschutz · Baustift" };

/**
 * Informationspflichten nach Art. 13 DSGVO.
 *
 * Der wichtigste Teil ist die Liste der Auftragsverarbeiter: hier steht,
 * wohin die Daten tatsächlich fliessen. Diese Liste folgt direkt aus der
 * Architektur der App und muss aktualisiert werden, sobald ein Dienst
 * hinzukommt oder wegfällt.
 */
export default function DatenschutzPage() {
  return (
    <>
      <h1>Datenschutzerklärung</h1>

      <h2>Verantwortlicher</h2>
      <p>
        [Firmenname], [Anschrift], [E-Mail]. Datenschutzbeauftragter:
        [Name oder „nicht bestellt, da nicht erforderlich“].
      </p>

      <h2>Welche Daten wir verarbeiten</h2>
      <ul>
        <li>
          <strong>Kontodaten:</strong> E-Mail-Adresse, Passwort (nur als
          Hashwert), Firmendaten, die du in den Einstellungen hinterlegst.
        </li>
        <li>
          <strong>Inhaltsdaten:</strong> deine Preisliste, deine Kunden sowie
          die Angebote, die du erstellst. Darin können personenbezogene Daten
          deiner Auftraggeber enthalten sein — dafür bist du Verantwortlicher
          und wir Auftragsverarbeiter (siehe AV-Vertrag).
        </li>
        <li>
          <strong>Sprachaufnahmen:</strong> werden zur Umwandlung in Text an
          unseren Dienstleister übermittelt und anschliessend verworfen. Wir
          speichern die Audiodatei nicht. Gespeichert wird nur der Text, damit
          du nachvollziehen kannst, woraus ein Angebot entstanden ist.
        </li>
        <li>
          <strong>Zahlungsdaten:</strong> werden ausschliesslich von unserem
          Zahlungsdienstleister verarbeitet. Wir speichern keine Kartendaten.
        </li>
        <li>
          <strong>Technische Daten:</strong> Server-Protokolle mit IP-Adresse
          und Zeitpunkt zur Abwehr von Missbrauch.
        </li>
      </ul>

      <h2>Rechtsgrundlagen</h2>
      <p>
        Die Verarbeitung erfolgt zur Erfüllung des Nutzungsvertrags
        (Art. 6 Abs. 1 lit. b DSGVO), zur Erfüllung gesetzlicher Pflichten
        (lit. c, etwa steuerliche Aufbewahrung) sowie auf Grundlage unseres
        berechtigten Interesses an einem sicheren Betrieb (lit. f).
      </p>

      <h2>Empfänger und Auftragsverarbeiter</h2>
      {/* Drei Spalten passen auf 390px nicht nebeneinander. Statt die Tabelle
          umzubauen, scrollt sie in ihrem eigenen Kasten — die Seite selbst
          bleibt umbruchfrei. */}
      <div className="-mx-5 overflow-x-auto px-5">
      <table>
        <thead>
          <tr>
            <th>Dienst</th>
            <th>Zweck</th>
            <th>Ort der Verarbeitung</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Supabase</td>
            <td>Datenbank, Anmeldung, Dateispeicher</td>
            <td>EU (Region Frankfurt)</td>
          </tr>
          <tr>
            <td>OpenAI (Whisper)</td>
            <td>Sprachaufnahme in Text umwandeln</td>
            <td>USA, Standardvertragsklauseln</td>
          </tr>
          <tr>
            <td>Anthropic (Claude)</td>
            <td>Aus dem Text Angebotspositionen erzeugen</td>
            <td>USA, Standardvertragsklauseln</td>
          </tr>
          <tr>
            <td>Stripe</td>
            <td>Zahlungsabwicklung und Rechnungen</td>
            <td>EU/USA, Standardvertragsklauseln</td>
          </tr>
          <tr>
            <td>[Hosting-Anbieter]</td>
            <td>Betrieb der Anwendung</td>
            <td>[Region]</td>
          </tr>
        </tbody>
      </table>
      </div>
      <p>
        Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung.
        Inhalte, die an OpenAI und Anthropic übermittelt werden, werden dort
        nach Angaben der Anbieter nicht zum Training von Modellen verwendet.
      </p>

      <h2>Speicherdauer</h2>
      <ul>
        <li>Sprachaufnahmen: nicht gespeichert.</li>
        <li>
          Konto- und Inhaltsdaten: bis zur Löschung des Kontos, danach
          [Frist] zur Abwicklung, soweit keine gesetzliche Aufbewahrungs-
          pflicht entgegensteht.
        </li>
        <li>Protokolldaten: [Frist, üblich 7–30 Tage].</li>
      </ul>

      <h2>Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung
        der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich
        dafür an [E-Mail]. Ausserdem steht dir ein Beschwerderecht bei einer
        Aufsichtsbehörde zu, etwa [zuständige Landesbehörde].
      </p>

      <h2>Cookies</h2>
      <p>
        Wir setzen ausschliesslich technisch notwendige Cookies für die
        Anmeldung. Es findet kein Tracking und keine Werbemessung statt —
        deshalb gibt es auch kein Einwilligungsbanner.
      </p>

      <p>Stand: [Datum]</p>
    </>
  );
}
