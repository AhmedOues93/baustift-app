import Link from "next/link";

import { IconMikrofon } from "@/components/ui/icons";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-5 py-16">
      <div>
        <p className="font-titel text-xl font-extrabold tracking-tight text-text">
          Baustift
        </p>

        <h1 className="mt-8 text-4xl leading-[1.05] sm:text-5xl">
          Angebot diktieren.
          <br />
          PDF bekommen.
        </h1>

        <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-leise">
          Beschreibe deine Leistung per Sprachnachricht — Baustift erkennt die
          Positionen, rechnet mit deiner Preisliste und erstellt ein
          professionelles Angebot als PDF.
        </p>
      </div>

      {/* Dunkle Tafel als Blickfang: dieselbe Sprache wie die Aufnahmekarte
          in der App, damit der Einstieg vertraut aussieht. */}
      <div className="rounded-tafel bg-tief p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-akzent text-text-invers">
            <IconMikrofon className="h-6 w-6" />
          </span>
          <div>
            <p className="font-titel text-lg font-bold tracking-tight text-text-invers">
              Einfach einsprechen
            </p>
            <p className="text-sm text-text-invers/70">
              Fertig in unter einer Minute.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="inline-flex min-h-11 items-center justify-center rounded-gross bg-akzent px-5 font-medium text-text-invers transition-colors hover:bg-akzent-hover"
          >
            Kostenlos starten
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-gross px-5 font-medium text-text-invers/80 transition-colors hover:text-text-invers"
          >
            Anmelden
          </Link>
        </div>
      </div>
    </main>
  );
}
