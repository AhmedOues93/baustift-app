import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { KONTINGENT, PREIS_MONATLICH_EUR } from "@/lib/abo";
import { NACHFASSEN_NACH_TAGEN } from "@/lib/angebot";

/**
 * =============================================================================
 * Startseite (baustift.de)
 * =============================================================================
 * Die einzige Seite, die jemand sieht, bevor er sich entscheidet. Deshalb
 * zeigt sie das Produkt, statt es zu beschreiben: jedes Bild hier ist ein
 * echter Bildschirm aus der Anwendung, aufgenommen auf 390px. Gezeichnete
 * Mockups wären hübscher und wären gelogen — und ein Handwerker, der nach der
 * Anmeldung etwas anderes vorfindet, kommt nicht wieder.
 *
 * Aufgebaut ist sie nach der Reihenfolge, in der die Fragen kommen:
 *   1. Was ist das, in einem Satz
 *   2. Kenne ich das Problem?
 *   3. Wie läuft das ab?
 *   4. Was kann es sonst?
 *   5. Was kostet es?
 *   6. Was passiert mit meinen Daten?
 *   7. Die Fragen, die übrig bleiben
 *
 * Preis und Kontingente kommen aus derselben Konstante wie die Abo-Seite und
 * die AGB. Eine Zahl, die hier von Hand steht, ist die sicherste Art,
 * irgendwann etwas anderes zu versprechen, als die Software tut.
 */

const BESCHREIBUNG =
  "Sprich auf der Baustelle ein, was gemacht wird. Baustift erkennt die " +
  "Positionen, rechnet mit deiner Preisliste und macht ein fertiges Angebot " +
  "als PDF. Für Handwerksbetriebe.";

export const metadata: Metadata = {
  title: "Baustift — Angebote einsprechen statt tippen",
  description: BESCHREIBUNG,
  keywords: [
    "Angebot Handwerk", "Angebotssoftware Handwerker", "Aufmass App",
    "Handwerkersoftware", "Rechnung schreiben Handwerk", "E-Rechnung",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    title: "Baustift — Angebote einsprechen statt tippen",
    description:
      "Einsprechen, prüfen, senden. Das Angebot ist fertig, bevor du im Auto sitzt.",
    type: "website",
    locale: "de_DE",
    siteName: "Baustift",
    // Das Bild ist der echte Kopf dieser Seite — so sieht der Empfänger in
    // WhatsApp genau das, was ihn nach dem Antippen erwartet.
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Baustift" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Baustift — Angebote einsprechen statt tippen",
    description:
      "Einsprechen, prüfen, senden. Das Angebot ist fertig, bevor du im Auto sitzt.",
    images: ["/og.png"],
  },
};

/**
 * Strukturierte Daten für die Suchmaschinen.
 *
 * Damit in den Ergebnissen Preis und Art der Anwendung stehen können, statt
 * nur ein Textschnipsel. Die Zahlen kommen auch hier aus der Konstante — eine
 * abweichende Angabe in den strukturierten Daten wäre eine falsche
 * Preisauszeichnung, und die ist abmahnfähig.
 */
function strukturierteDaten() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Baustift",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    inLanguage: "de",
    description: BESCHREIBUNG,
    offers: {
      "@type": "Offer",
      price: String(PREIS_MONATLICH_EUR),
      priceCurrency: "EUR",
      description: `${PREIS_MONATLICH_EUR} € pro Monat zzgl. MwSt., monatlich kündbar`,
    },
  };
}

export default function StartSeite() {
  return (
    <div className="min-h-screen bg-papier">
      <script
        type="application/ld+json"
        // Nur eigene, statisch erzeugte Daten — kein Fremdinhalt.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(strukturierteDaten()) }}
      />
      <Kopfleiste />
      <main>
        <Hero />
        <Problem />
        <Ablauf />
        <Funktionen />
        <Muster />
        <Preis />
        <Vertrauen />
        <Fragen />
        <Schluss />
      </main>
      <Fusszeile />
    </div>
  );
}

/* ========================================================================= */

function Kopfleiste() {
  return (
    <header className="sticky top-0 z-40 border-b border-linie bg-papier/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3">
        <Wortmarke />
        {/* Auf 390px ist die Kopfzeile auf den Pixel genau voll: darum
            schmalere Innenabstände und ein kürzeres Wort auf dem Handy. */}
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center rounded-gross px-3 text-sm font-medium text-text transition-colors hover:bg-flaeche sm:px-4"
          >
            Anmelden
          </Link>
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center rounded-gross bg-tief px-3 text-sm font-medium text-text-invers transition-colors hover:bg-text sm:px-4"
          >
            <span className="sm:hidden">Testen</span>
            <span className="hidden sm:inline">Kostenlos testen</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Wortmarke({ hell = false }: { hell?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-feld font-titel text-lg font-black ${
          hell ? "bg-text-invers text-tief" : "bg-tief text-text-invers"
        }`}
      >
        B
      </span>
      <span
        className={`font-titel text-lg font-extrabold tracking-[0.12em] ${
          hell ? "text-text-invers" : "text-text"
        }`}
      >
        BAUSTIFT
      </span>
    </span>
  );
}

/* ========================================================================= */

function Hero() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 lg:pb-24 lg:pt-20">
      <div className="grid items-center gap-12 lg:grid-cols-[1.25fr_.75fr]">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-akzent-flaeche px-3 py-1.5 text-sm font-medium text-akzent">
            Für Handwerksbetriebe
          </p>

          {/* Kein harter Umbruch: er sass auf dem Handy richtig und riss den
              Satz am Rechner an der falschen Stelle auseinander. balance
              verteilt die Zeilen gleichmässig, in jeder Breite. */}
          <h1 className="mt-5 text-[34px] leading-[1.05] [text-wrap:balance] sm:text-5xl lg:text-6xl">
            Das Angebot ist fertig, bevor du im Auto sitzt.
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-leise">
            Sprich beim Aufmass ein, was gemacht wird. Baustift erkennt die
            Positionen, rechnet mit <strong className="text-text">deiner</strong>{" "}
            Preisliste und macht ein sauberes PDF daraus. Du prüfst es und
            schickst es los — per E-Mail oder WhatsApp.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="inline-flex min-h-12 items-center justify-center rounded-gross bg-akzent px-7 font-semibold text-text-invers transition-colors hover:bg-akzent-hover"
            >
              <span className="zahl mr-1.5">{KONTINGENT.trial}</span> Angebote
              kostenlos
            </Link>
            <a
              href="#ablauf"
              className="inline-flex min-h-12 items-center justify-center rounded-gross border border-linie bg-flaeche px-7 font-semibold text-text transition-colors hover:bg-papier"
            >
              So läuft es ab
            </a>
          </div>

          <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm text-text-leise">
            <li>Ohne Kreditkarte</li>
            <li aria-hidden="true">·</li>
            <li>Monatlich kündbar</li>
            <li aria-hidden="true">·</li>
            <li>Server in der EU</li>
          </ul>
        </div>

        <Handy
          bild="/bilder/aufnahme.png"
          alt="Baustift auf dem Handy: der Aufnahmeknopf für ein neues Angebot"
          gross
          prioritaet
        />
      </div>
    </section>
  );
}

/**
 * Ein Screenshot im Handyrahmen.
 *
 * Der Rahmen ist kein Schmuck: ohne ihn sieht ein 390px breiter Screenshot
 * auf dem Rechner aus wie eine kaputte Webseite. Mit ihm ist sofort klar,
 * dass das Produkt aufs Telefon gehört — und genau das ist die Aussage.
 */
function Handy({
  bild,
  alt,
  gross = false,
  prioritaet = false,
}: {
  bild: string;
  alt: string;
  gross?: boolean;
  prioritaet?: boolean;
}) {
  return (
    <div className={`mx-auto w-full ${gross ? "max-w-[320px]" : "max-w-[300px]"}`}>
      {/* Die Bilder zeigen den oberen Ausschnitt des Bildschirms; unten läuft
          der Rahmen offen aus, statt ein Telefon vorzutäuschen, das es in
          dieser Höhe nicht gibt. */}
      <div className="rounded-t-[2.2rem] border-[10px] border-b-0 border-tief bg-tief shadow-schwebend">
        <Image
          src={bild}
          alt={alt}
          width={780}
          height={1180}
          priority={prioritaet}
          className="h-auto w-full rounded-t-[1.5rem]"
        />
      </div>
    </div>
  );
}

/* ========================================================================= */

function Problem() {
  const punkte = [
    {
      titel: "Abends am Küchentisch",
      text: "Der Tag ist um, und dann fängt die Schreibarbeit erst an. Angebote entstehen zwischen halb neun und zehn — wenn überhaupt.",
    },
    {
      titel: "Der Zettel mit den Massen",
      text: "Aufgeschrieben auf der Rückseite eines Lieferscheins. Bis zum Abend ist er im Auto, in der Hose oder weg.",
    },
    {
      titel: "Drei Tage Funkstille",
      text: "Der Kunde wartet. Wer zuerst ein Angebot schickt, bekommt den Auftrag — nicht wer das schönste schreibt.",
    },
  ];

  return (
    <section className="border-y border-linie bg-flaeche py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl leading-tight sm:text-4xl">
          Angebote schreiben kostet den Feierabend.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {punkte.map((p) => (
            <div key={p.titel} className="rounded-karte bg-papier p-6">
              <h3 className="font-titel text-lg font-bold tracking-tight text-text">
                {p.titel}
              </h3>
              <p className="mt-2 leading-relaxed text-text-leise">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Ablauf() {
  const schritte = [
    {
      nummer: "1",
      titel: "Einsprechen",
      text: "„Bad komplett, acht Quadratmeter. Alte Fliesen raus, neue 60 × 60. Dusche bodengleich, WC tauschen, Entsorgung mit rein.“ Eine Minute, im Stehen.",
      bild: "/bilder/aufnahme.png",
      alt: "Aufnahmebildschirm mit grossem Mikrofonknopf",
    },
    {
      nummer: "2",
      titel: "Prüfen",
      text: "Baustift ordnet jeder Position einen Preis aus deiner Preisliste zu. Was es nicht sicher zuordnen kann, steht gelb markiert da — du setzt den Preis in zwei Sekunden.",
      bild: "/bilder/angebot.png",
      alt: "Angebot mit Positionen, Mengen und Preisen zum Prüfen",
    },
    {
      nummer: "3",
      titel: "Senden",
      text: "Fertiges PDF mit deinem Logo, deiner Anschrift und allen Pflichtangaben. Per E-Mail oder direkt in den WhatsApp-Verlauf, in dem der Kunde ohnehin schreibt.",
      bild: "/bilder/liste.png",
      alt: "Übersicht der Angebote mit Kennzahlen",
    },
  ];

  return (
    <section id="ablauf" className="scroll-mt-20 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl leading-tight sm:text-4xl">
          Einsprechen. Prüfen. Senden.
        </h2>
        <p className="mt-3 max-w-xl text-lg text-text-leise">
          Drei Schritte, ungefähr zwei Minuten — auf der Baustelle, nicht zu
          Hause.
        </p>

        {/* Drei Spalten statt drei breiter Reihen: nebeneinander sind die
            Schritte in einem Blick zu erfassen, und es entstehen nicht drei
            fast leere Bildschirmhöhen auf dem Rechner. */}
        <div className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {schritte.map((s) => (
            <div key={s.nummer} className="flex flex-col">
              <span className="zahl flex h-11 w-11 items-center justify-center rounded-full bg-tief text-lg font-semibold text-text-invers">
                {s.nummer}
              </span>
              <h3 className="mt-4 font-titel text-xl font-bold tracking-tight text-text">
                {s.titel}
              </h3>
              <p className="mt-2 leading-relaxed text-text-leise">{s.text}</p>
              <div className="mt-6">
                <Handy bild={s.bild} alt={s.alt} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Funktionen() {
  const gruppen = [
    {
      titel: "Aufmass per Stimme",
      text: `„Bad Wand 1: 2,40 mal 2,50.“ Jedes Mass steht sofort in der Liste, Abzüge für Fenster und Türen inklusive. Die Aufnahme läuft nicht mit — du misst in Ruhe weiter, auch wenn das Telefon zwischendurch in der Tasche steckt.`,
      bild: "/bilder/aufmass.png",
      alt: "Aufmass mit einzelnen Messungen und zusammengerechneten Flächen",
    },
    {
      titel: "Rechnungen und Erinnerungen",
      text: `Aus dem angenommenen Angebot wird mit einem Tipp die Rechnung. Überfällige stehen ganz oben, mit einem Knopf für die Zahlungserinnerung. Teilzahlungen werden einzeln gebucht — Anzahlung, Rest, offener Betrag.`,
      bild: "/bilder/rechnungen.png",
      alt: "Rechnungsübersicht mit offenen und überfälligen Beträgen",
    },
    {
      titel: "Kunden mit Geschichte",
      text: `Wer anruft, fragt: „Was haben wir denn bei Ihnen offen?“ In der Kundenakte stehen alle Angebote und Rechnungen auf einer Seite. Die Telefonnummer ist ein Link — antippen und anrufen.`,
      bild: "/bilder/kunde.png",
      alt: "Kundenakte mit offenen Angeboten und Rechnungen",
    },
  ];

  const kurz = [
    {
      titel: "Deine Preisliste",
      text: "Einmal angelegt oder aus Excel importiert. Preise kommen immer von dir, nie aus der KI.",
    },
    {
      titel: "PDF nach DIN 5008",
      text: "Mit Logo, Steuernummer und allen Pflichtangaben nach § 14 UStG. Auch für Kleinunternehmer.",
    },
    {
      titel: "E-Rechnung (EN 16931)",
      text: "Die maschinenlesbare Datei für die Buchhaltung deiner Auftraggeber — Pflicht im B2B.",
    },
    {
      titel: "Nachfassen",
      text: `Angebote ohne Antwort stehen nach ${NACHFASSEN_NACH_TAGEN} Tagen auf einer Liste. Ein Knopf fragt höflich nach.`,
    },
    {
      titel: "Aufs Handy installierbar",
      text: "Baustift läuft im Browser und lässt sich auf den Startbildschirm legen wie eine App.",
    },
    {
      titel: "Alles exportierbar",
      text: "Kunden, Preise, Angebote und Rechnungen als CSV für Excel oder den Steuerberater.",
    },
  ];

  return (
    <section className="border-t border-linie bg-flaeche py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl leading-tight sm:text-4xl">
          Was sonst noch auf der Baustelle hilft.
        </h2>

        <div className="mt-12 flex flex-col gap-16">
          {gruppen.map((g, i) => (
            <div
              key={g.titel}
              className={`grid items-center gap-8 lg:grid-cols-2 lg:gap-14 ${
                i % 2 === 0 ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              <div>
                <h3 className="font-titel text-2xl font-bold tracking-tight text-text">
                  {g.titel}
                </h3>
                <p className="mt-3 max-w-lg text-lg leading-relaxed text-text-leise">
                  {g.text}
                </p>
              </div>
              <Handy bild={g.bild} alt={g.alt} />
            </div>
          ))}
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {kurz.map((k) => (
            <div key={k.titel} className="rounded-karte bg-papier p-5">
              <h3 className="font-titel text-base font-bold tracking-tight text-text">
                {k.titel}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-text-leise">
                {k.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Muster() {
  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="grid items-center gap-8 rounded-tafel bg-tief p-8 text-text-invers lg:grid-cols-[1.1fr_.9fr] lg:p-12">
          <div>
            <h2 className="text-3xl leading-tight text-text-invers sm:text-4xl">
              Sieh dir an, was beim Kunden ankommt.
            </h2>
            <p className="mt-4 max-w-lg text-lg leading-relaxed text-text-invers/70">
              Kein Bild eines PDFs, sondern das PDF selbst — genau so, wie
              Baustift es erzeugt. Mit Positionen, Mengen, Netto, Mehrwertsteuer
              und Pflichtangaben.
            </p>
            <a
              href="/muster-angebot.pdf"
              target="_blank"
              rel="noopener"
              className="mt-7 inline-flex min-h-12 items-center justify-center rounded-gross bg-akzent px-7 font-semibold text-text-invers transition-colors hover:bg-akzent-hover"
            >
              Muster-Angebot öffnen (PDF)
            </a>
          </div>
          <div className="rounded-karte bg-papier p-1.5 shadow-schwebend">
            <Image
              src="/bilder/desktop.png"
              alt="Baustift am Rechner: die Angebotsübersicht mit Seitenleiste"
              width={1800}
              height={1125}
              className="h-auto w-full rounded-[0.8rem]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Preis() {
  const enthalten = [
    `${KONTINGENT.aktiv} Angebote im Monat`,
    "Unbegrenzt Kunden, Preise und Aufmasse",
    "Rechnungen, Storno und E-Rechnung",
    "PDF-Versand per E-Mail",
    "Zahlungserinnerungen und Teilzahlungen",
    "Alle Daten jederzeit exportierbar",
  ];

  return (
    <section id="preis" className="scroll-mt-20 border-y border-linie bg-flaeche py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-3xl leading-tight sm:text-4xl">Ein Preis, keine Stufen.</h2>
        <p className="mt-3 max-w-xl text-lg text-text-leise">
          Ein einziger Auftrag mehr im Jahr zahlt das Abo mehrfach.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <div className="rounded-karte border border-linie bg-papier p-7">
            <p className="font-titel text-lg font-bold tracking-tight text-text">
              Testen
            </p>
            <p className="zahl mt-3 text-4xl font-semibold text-text">0 €</p>
            <p className="mt-2 text-text-leise">
              <span className="zahl">{KONTINGENT.trial}</span> Angebote, ohne
              Kreditkarte. Läuft von selbst aus — es wird nichts abgebucht.
            </p>
            <Link
              href="/signup"
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-gross border border-linie bg-flaeche px-6 font-semibold text-text transition-colors hover:bg-papier"
            >
              Konto anlegen
            </Link>
          </div>

          <div className="rounded-karte bg-tief p-7 text-text-invers shadow-schwebend">
            <p className="font-titel text-lg font-bold tracking-tight text-text-invers">
              Baustift Pro
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="zahl text-5xl font-semibold">
                {PREIS_MONATLICH_EUR} €
              </span>
              <span className="text-text-invers/70">pro Monat, zzgl. MwSt.</span>
            </p>
            <p className="mt-2 text-text-invers/70">
              Monatlich kündbar, mit einem Klick im Kundenportal.
            </p>

            <ul className="mt-6 flex flex-col gap-2.5">
              {enthalten.map((e) => (
                <li key={e} className="flex gap-2.5 text-text-invers/90">
                  <span aria-hidden="true" className="text-akzent">
                    ✓
                  </span>
                  {e}
                </li>
              ))}
            </ul>

            <Link
              href="/signup"
              className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-gross bg-akzent px-6 font-semibold text-text-invers transition-colors hover:bg-akzent-hover"
            >
              Jetzt kostenlos anfangen
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Vertrauen() {
  const punkte = [
    {
      titel: "Server in der EU",
      text: "Datenbank und Anmeldung laufen in Frankfurt. Mit allen Dienstleistern bestehen Verträge zur Auftragsverarbeitung.",
    },
    {
      titel: "Keine Aufnahmen gespeichert",
      text: "Das Diktat wird in Text umgewandelt und verworfen. Für Audiodateien gibt es in Baustift gar keinen Speicherort.",
    },
    {
      titel: "Deine Kundendaten bleiben deine",
      text: "Du bekommst den Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO — das brauchst du, wenn du Kundendaten erfasst.",
    },
    {
      titel: "Export und Löschung eingebaut",
      text: "Alle Daten herunterladen oder das Konto samt Inhalt löschen: beides im Konto, ohne Anfrage bei uns.",
    },
  ];

  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="max-w-2xl text-3xl leading-tight sm:text-4xl">
          Kundendaten sind kein Nebenthema.
        </h2>
        <p className="mt-3 max-w-2xl text-lg text-text-leise">
          In deinen Angeboten stehen Namen und Anschriften deiner Auftraggeber.
          Dafür bist du verantwortlich — wir liefern, was du dafür brauchst.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {punkte.map((p) => (
            <div key={p.titel} className="rounded-karte border border-linie p-6">
              <h3 className="font-titel text-lg font-bold tracking-tight text-text">
                {p.titel}
              </h3>
              <p className="mt-2 leading-relaxed text-text-leise">{p.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Fragen() {
  const fragen = [
    {
      frage: "Versteht das auch Dialekt und Baustellenlärm?",
      antwort:
        "Die Spracherkennung ist auf Deutsch eingestellt und kennt die Fachbegriffe — Vorwandinstallation, Estrich, Silikonfugen. Laut ist es fast immer; wichtiger ist, nah am Mikrofon zu sprechen. Und wenn es doch daneben liegt, korrigierst du die Zeile in zwei Sekunden. Tippen geht auch, wenn der Presslufthammer nebenan läuft.",
    },
    {
      frage: "Kann die KI meine Preise verändern?",
      antwort:
        "Nein. Die KI ordnet zu, sie rechnet nicht. Jeder Preis kommt aus deiner Preisliste. Was sie nicht sicher zuordnen kann, wird gelb markiert und wartet auf dich — lieber einmal nachfragen als still einen falschen Preis ins Angebot schreiben.",
    },
    {
      frage: "Muss ich etwas installieren?",
      antwort:
        "Nein. Baustift läuft im Browser. Auf dem Handy kannst du es auf den Startbildschirm legen, dann verhält es sich wie eine App — mit eigenem Symbol und ohne Adresszeile.",
    },
    {
      frage: "Was ist, wenn ich auf der Baustelle kein Netz habe?",
      antwort:
        "Die Aufnahme bleibt erhalten. Sobald du wieder Empfang hast, schickst du sie mit einem Knopf ab. Was Baustift nicht kann: ohne Netz ein Angebot erzeugen — dafür muss die Sprache verarbeitet werden.",
    },
    {
      frage: "Ich bin Kleinunternehmer. Geht das?",
      antwort:
        "Ja. Trag es in den Firmendaten ein, dann weist Baustift keine Umsatzsteuer aus und setzt den Hinweis nach § 19 UStG auf Angebot und Rechnung — auch in der E-Rechnung.",
    },
    {
      frage: "Wie komme ich wieder raus?",
      antwort:
        "Monatlich kündbar im Kundenportal, ohne Begründung. Vorher lädst du alle Daten als CSV und JSON herunter. Das Konto samt allem löschst du selbst, ohne uns zu fragen.",
    },
  ];

  return (
    <section className="border-t border-linie bg-flaeche py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-5">
        <h2 className="text-3xl leading-tight sm:text-4xl">Fragen, die oft kommen.</h2>

        <div className="mt-10 flex flex-col gap-3">
          {fragen.map((f) => (
            <details
              key={f.frage}
              className="group rounded-karte bg-papier p-5 [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 font-titel text-lg font-bold tracking-tight text-text">
                {f.frage}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-2xl leading-none text-text-leise transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 leading-relaxed text-text-leise">{f.antwort}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Schluss() {
  return (
    <section className="py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-5 text-center">
        <h2 className="text-3xl leading-tight sm:text-4xl">
          Das nächste Angebot schreibt sich unterwegs.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-text-leise">
          <span className="zahl">{KONTINGENT.trial}</span> Angebote zum
          Ausprobieren, ohne Kreditkarte. Wenn es nichts für dich ist, hörst du
          nie wieder von uns.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-gross bg-akzent px-8 font-semibold text-text-invers transition-colors hover:bg-akzent-hover"
        >
          Kostenlos anfangen
        </Link>
      </div>
    </section>
  );
}

/* ========================================================================= */

function Fusszeile() {
  return (
    <footer className="border-t border-linie bg-tief py-12 text-text-invers">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Wortmarke hell />
          <p className="text-sm text-text-invers/60">
            Angebote und Rechnungen für Handwerksbetriebe.
          </p>
        </div>

        <nav className="flex flex-wrap gap-x-6 gap-y-3 border-t border-text-invers/10 pt-6 text-sm">
          <Link href="/rechtliches/impressum" className="text-text-invers/70 hover:text-text-invers">
            Impressum
          </Link>
          <Link href="/rechtliches/datenschutz" className="text-text-invers/70 hover:text-text-invers">
            Datenschutz
          </Link>
          <Link href="/rechtliches/agb" className="text-text-invers/70 hover:text-text-invers">
            AGB
          </Link>
          <Link href="/rechtliches/av-vertrag" className="text-text-invers/70 hover:text-text-invers">
            Auftragsverarbeitung
          </Link>
          <Link href="/login" className="ml-auto text-text-invers/70 hover:text-text-invers">
            Anmelden
          </Link>
        </nav>
      </div>
    </footer>
  );
}
