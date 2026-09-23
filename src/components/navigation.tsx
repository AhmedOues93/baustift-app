"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  IconAngebote,
  IconKonto,
  IconMikrofon,
  IconPreisliste,
} from "@/components/ui/icons";

/**
 * Navigation — eine Definition, zwei Darstellungen.
 *
 * Mobil:   feste Leiste unten, wie in einer nativen App. Der Daumen erreicht
 *          den unteren Bildschirmrand, den oberen nicht.
 * Desktop: dieselben Einträge als Sidebar links (ab `lg`).
 *
 * Die Einträge stehen bewusst nur einmal hier — beide Varianten rendern aus
 * derselben Liste, damit sie nicht auseinanderlaufen.
 */

const EINTRAEGE = [
  { href: "/angebote", label: "Angebote", Icon: IconAngebote },
  { href: "/angebote/neu", label: "Neu", langLabel: "Neues Angebot", Icon: IconMikrofon },
  { href: "/preisliste", label: "Preise", Icon: IconPreisliste },
  { href: "/einstellungen", label: "Konto", Icon: IconKonto },
] as const;

function istAktiv(pfad: string, href: string) {
  // "/angebote/neu" darf nicht auch "/angebote" aktiv schalten.
  if (href === "/angebote") return pfad === "/angebote";
  return pfad === href || pfad.startsWith(`${href}/`);
}

/** Untere Tab-Leiste — nur mobil sichtbar (`lg:hidden`). */
export function BottomNav() {
  const pfad = usePathname();

  return (
    <nav
      aria-label="Hauptnavigation"
      className={[
        "fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden",
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
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2",
                  "text-xs font-medium transition-colors",
                  aktiv
                    ? "text-brand-700"
                    : "text-slate-500 active:text-slate-900",
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

/** Seitenleiste — erst ab `lg` sichtbar. */
export function Sidebar() {
  const pfad = usePathname();

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-slate-200 lg:bg-white lg:px-4 lg:py-6">
      <Link
        href="/angebote"
        className="px-2 py-2 text-lg font-bold tracking-tight text-brand-700"
      >
        Baustift
      </Link>

      <ul className="mt-8 flex flex-col gap-1">
        {EINTRAEGE.map((eintrag) => {
          const { href, label, Icon } = eintrag;
          const aktiv = istAktiv(pfad, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={aktiv ? "page" : undefined}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors",
                  aktiv
                    ? "bg-brand-50 text-brand-700"
                    : "text-slate-700 hover:bg-slate-100",
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
    </aside>
  );
}
