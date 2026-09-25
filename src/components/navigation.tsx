"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconAngebote,
  IconKonto,
  IconLineal,
  IconKunden,
  IconPreisliste,
  IconRechnung,
} from "@/components/ui/icons";

/**
 * Navigation — eine Definition, zwei Darstellungen.
 *
 * Mobil:   feste Leiste unten, wie in einer nativen App. Der Daumen erreicht
 *          den unteren Bildschirmrand, den oberen nicht. Aktiv = Terrakotta
 *          plus fettes Label; inaktiv = leises Grau.
 * Desktop: dieselben Einträge in einer dunklen Sidebar (ab `lg`). Die dunkle
 *          Fläche trennt Navigation und Inhalt ohne eine einzige Linie.
 *
 * Die Einträge stehen bewusst nur einmal hier — beide Varianten rendern aus
 * derselben Liste, damit sie nicht auseinanderlaufen.
 */

/**
 * Vier Einträge, mehr nicht: "Neues Angebot" steht bewusst NICHT hier, sondern
 * als grosse Aktionskarte auf der Angebotsseite. Die wichtigste Aktion des
 * Produkts gehört nicht in einen 90px breiten Tab.
 */
const EINTRAEGE = [
  { href: "/angebote", label: "Angebote", Icon: IconAngebote },
  { href: "/rechnungen", label: "Rechnungen", Icon: IconRechnung },
  { href: "/auftraege", label: "Aufträge", Icon: IconLineal },
  { href: "/kunden", label: "Kunden", Icon: IconKunden },
  { href: "/preisliste", label: "Preise", langLabel: "Preisliste", Icon: IconPreisliste },
  { href: "/einstellungen", label: "Konto", Icon: IconKonto },
] as const;

function istAktiv(pfad: string, href: string) {
  return pfad === href || pfad.startsWith(`${href}/`);
}

/** Untere Tab-Leiste — nur mobil sichtbar (`lg:hidden`). */
export function BottomNav() {
  const pfad = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={[
        "fixed inset-x-0 bottom-0 z-40 border-t border-linie bg-flaeche lg:hidden",
        // pb-[env(safe-area-inset-bottom)]: Platz für den Home-Indicator auf
        // iPhones ohne Home-Button — sonst liegt der Tab unter der Systemleiste.
        "pb-[env(safe-area-inset-bottom)]",
      ].join(" ")}
    >
      <ul className="flex">
        {EINTRAEGE.map(({ href, label, Icon }) => {
          const aktiv = istAktiv(pfad, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={aktiv ? "page" : undefined}
                // min-h-14 (56px) > die geforderten 44px: eine Tab-Leiste wird
                // im Vorbeigehen getroffen, da ist mehr Fläche besser.
                className={[
                  // Fünf Tabs auf 390px sind je 78px breit — immer noch weit
                  // über den 44px Mindestgrösse, aber das Label braucht
                  // etwas weniger Schrift, damit "Rechnungen" nicht umbricht.
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-0.5 py-2 text-[10px] leading-tight",
                  "transition-colors",
                  aktiv
                    ? "font-semibold text-akzent"
                    : "font-medium text-text-leise active:text-text",
                ].join(" ")}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Dunkle Seitenleiste — erst ab `lg` sichtbar. */
export function Sidebar({ firma }: { firma?: string }) {
  const pfad = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:bg-tief lg:px-3 lg:py-6">
      <Link
        href="/angebote"
        className="px-3 py-2 font-titel text-xl font-extrabold tracking-tight text-text-invers"
      >
        Baustift
      </Link>

      <ul className="mt-8 flex flex-1 flex-col gap-1">
        {EINTRAEGE.map((eintrag) => {
          const { href, label, Icon } = eintrag;
          const aktiv = istAktiv(pfad, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktiv ? "page" : undefined}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-feld px-3 text-[15px] transition-colors",
                  aktiv
                    ? "bg-flaeche/10 font-semibold text-text-invers"
                    : "font-medium text-text-invers/60 hover:bg-flaeche/5 hover:text-text-invers",
                ].join(" ")}
              >
                <Icon className="h-5 w-5" />
                {/* In der Sidebar ist Platz für die lange Beschriftung. */}
                {"langLabel" in eintrag ? eintrag.langLabel : label}
              </Link>
            </li>
          );
        })}
      </ul>

      {firma ? (
        <div className="flex items-center gap-3 border-t border-text-invers/10 px-3 pt-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-akzent font-titel text-sm font-bold text-text-invers">
            {firma.slice(0, 1).toUpperCase()}
          </span>
          <span className="min-w-0 truncate text-sm font-medium text-text-invers/80">
            {firma}
          </span>
        </div>
      ) : null}
    </aside>
  );
}
