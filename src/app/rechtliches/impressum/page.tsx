export const metadata = { title: "Impressum · Baustift" };

/** Pflichtangaben nach §5 DDG (früher §5 TMG). */
export default function ImpressumPage() {
  return (
    <>
      <h1>Impressum</h1>

      <h2>Anbieter</h2>
      <p>
        [Firmenname]
        <br />
        [Strasse und Hausnummer]
        <br />
        [PLZ und Ort]
        <br />
        Deutschland
      </p>

      <h2>Vertreten durch</h2>
      <p>[Name der vertretungsberechtigten Person]</p>

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
      </p>

      <h2>Umsatzsteuer-Identifikationsnummer</h2>
      <p>Gemäss §27a UStG: [DE…]</p>

      <h2>Verbraucherstreitbeilegung</h2>
      <p>
        Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungs-
        verfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
      </p>
    </>
  );
}
