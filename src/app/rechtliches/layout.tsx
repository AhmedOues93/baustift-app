import Link from "next/link";

/**
 * Rechtliche Seiten.
 *
 * WICHTIG FÜR DEN BETRIEB DIESER APP:
 * Die Texte hier sind vorbereitete Entwürfe mit Platzhaltern in eckigen
 * Klammern. Sie ersetzen KEINE Rechtsberatung. Vor dem Verkauf müssen sie
 * ausgefüllt und von einer Anwältin oder einem Anwalt geprüft werden —
 * Impressumspflicht (§5 DDG), DSGVO-Informationspflichten (Art. 13),
 * Widerrufsrecht und AGB-Recht sind in Deutschland abmahnfähig.
 *
 * Sie stehen trotzdem schon im Repo, weil die Struktur (welche Angaben
 * gebraucht werden, welche Dienstleister genannt werden müssen) aus der
 * Architektur folgt und nicht vom Anwalt kommt.
 *
 * Öffentlich erreichbar, ohne Login: ein Impressum hinter einer Anmeldung
 * erfüllt seinen Zweck nicht.
 */
export default function RechtlichesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-5 py-8 lg:py-16">
      <Link
        href="/"
        className="inline-block py-2 font-titel text-xl font-extrabold tracking-tight text-text"
      >
        Baustift
      </Link>

      {/* prose-artige Abstände von Hand: eine Typografie-Erweiterung nur für
          vier Textseiten lohnt das zusätzliche Paket nicht. */}
      <article
        className={[
          "flex flex-col gap-4 text-[15px] leading-relaxed text-text",
          "[&_h1]:text-[26px] [&_h1]:leading-tight",
          "[&_h2]:mt-6 [&_h2]:text-lg",
          "[&_h3]:mt-4 [&_h3]:font-titel [&_h3]:font-bold",
          "[&_p]:text-text-leise",
          "[&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5 [&_ul]:text-text-leise",
          "[&_a]:text-akzent [&_a]:underline [&_a]:underline-offset-2",
          // Die Tabelle der Auftragsverarbeiter passt auf 390px nicht in drei
          // Spalten. Statt sie umzubauen darf sie seitlich scrollen — der
          // Rest der Seite bleibt damit umbruchfrei.
          "[&_table]:w-full [&_table]:min-w-[26rem] [&_table]:text-left [&_table]:text-sm",
          "[&_th]:border-b [&_th]:border-linie [&_th]:py-2 [&_th]:align-top [&_th]:font-medium",
          "[&_td]:border-b [&_td]:border-linie [&_td]:py-2 [&_td]:align-top [&_td]:text-text-leise [&_td]:pr-4",
        ].join(" ")}
      >
        {children}
      </article>

      <nav className="flex flex-wrap gap-x-4 gap-y-2 border-t border-linie pt-6 text-sm text-text-leise">
        <Link href="/rechtliches/impressum" className="underline underline-offset-2">
          Impressum
        </Link>
        <Link href="/rechtliches/datenschutz" className="underline underline-offset-2">
          Datenschutz
        </Link>
        <Link href="/rechtliches/agb" className="underline underline-offset-2">
          AGB
        </Link>
        <Link href="/rechtliches/av-vertrag" className="underline underline-offset-2">
          Auftragsverarbeitung
        </Link>
      </nav>
    </div>
  );
}
