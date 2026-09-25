export const metadata = { title: "Impressum · Baustift" };

/**
 * Pflichtangaben nach §5 DDG (bis 2024 §5 TMG).
 *
 * Was hier hineingehört, hängt von der Rechtsform ab:
 *
 *   Einzelunternehmen  -> Vor- und Nachname, Anschrift, Kontakt. Kein
 *                         Registereintrag. Eine Geschäftsbezeichnung darf
 *                         danebenstehen, ersetzt den Namen aber nicht.
 *   GmbH / UG          -> zusätzlich Firma laut Register, alle
 *                         Geschäftsführer, Registergericht und HRB-Nummer.
 *   GbR                -> alle Gesellschafter mit Namen.
 *
 * Eine Postfachadresse genügt nicht: es muss eine ladungsfähige Anschrift
 * sein. Die Umsatzsteuer-Identifikationsnummer ist nur anzugeben, wenn eine
 * vorhanden ist — die Steuernummer gehört NICHT ins Impressum.
 *
 * Bewusst nicht enthalten: die früher üblichen „Haftungsausschluss für
 * Links und Inhalte“-Absätze. Sie haben keine rechtliche Wirkung und wecken
 * nur den Eindruck, hier sei etwas aus einem Generator übernommen worden.
 */
export default function ImpressumPage() {
  return (
    <>
      <h1>Impressum</h1>

      <h2>Anbieter</h2>
      <p>
        [Firmenname laut Handelsregister bzw. Vor- und Nachname]
        <br />
        [Strasse und Hausnummer]
        <br />
        [PLZ und Ort]
        <br />
        Deutschland
      </p>

      <h2>Vertreten durch</h2>
      <p>[Name der vertretungsberechtigten Person(en); bei Einzelunternehmen entfällt dieser Abschnitt]</p>

      <h2>Kontakt</h2>
      <p>
        Telefon: [Telefonnummer]
        <br />
        E-Mail: [E-Mail-Adresse]
      </p>

      <h2>Registereintrag</h2>
      <p>
        Registergericht: [Amtsgericht]
        <br />
        Registernummer: [HRB …]
        <br />
        [Bei Einzelunternehmen und GbR entfällt dieser Abschnitt.]
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>
        Gemäss §27a UStG: [DE…]
        <br />
        [Entfällt, solange keine vergeben ist.]
      </p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Baustift richtet sich ausschliesslich an Unternehmer. Wir sind nicht
        bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
        Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </>
  );
}
