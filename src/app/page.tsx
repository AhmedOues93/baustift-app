import Link from "next/link";

import { IconMikrofon } from "@/components/ui/icons";

export default function HomePage() {
  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col justify-center overflow-hidden px-5 py-16">
      <div aria-hidden="true" className="absolute inset-0 opacity-[0.08]">
        <span className="absolute left-[7%] top-[13%] rotate-[-12deg] text-7xl">✎</span>
        <span className="absolute right-[8%] top-[20%] rotate-12 text-6xl">⌁</span>
        <span className="absolute bottom-[12%] left-[10%] rotate-6 text-7xl">⌂</span>
      </div>
      <div className="relative z-10 grid items-center gap-10 md:grid-cols-[1.15fr_.85fr]">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-feld bg-tief font-titel text-xl font-black text-text-invers">B</span>
            <p className="font-titel text-xl font-extrabold tracking-[0.14em] text-text">BAUSTIFT</p>
          </div>
          <h1 className="mt-9 text-4xl leading-[1.02] sm:text-6xl">Vom Auftrag zum Angebot. Ohne Papierchaos.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-text-leise">
            Sprich deine Leistung ein. BAUSTIFT erkennt Positionen, nutzt deine Preisliste und erstellt ein professionelles Angebot als PDF.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className="inline-flex min-h-12 items-center justify-center rounded-gross bg-akzent px-6 font-semibold text-text-invers transition-colors hover:bg-akzent-hover">Kostenlos starten</Link>
            <Link href="/login" className="inline-flex min-h-12 items-center justify-center rounded-gross border border-linie bg-flaeche px-6 font-semibold text-text">Anmelden</Link>
          </div>
        </div>
        <div className="rounded-tafel bg-tief p-7 shadow-schwebend sm:p-9">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-akzent text-text-invers"><IconMikrofon className="h-7 w-7" /></span>
          <p className="mt-7 font-titel text-2xl font-bold text-text-invers">Einsprechen. Prüfen. Senden.</p>
          <p className="mt-3 leading-relaxed text-text-invers/70">Dein digitaler Baustift für Angebote und Rechnungen im Handwerk.</p>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs font-medium text-text-invers/70">
            <span className="rounded-feld border border-text-invers/10 p-3">Sprache</span>
            <span className="rounded-feld border border-text-invers/10 p-3">Preise</span>
            <span className="rounded-feld border border-text-invers/10 p-3">PDF</span>
          </div>
        </div>
      </div>
    </main>
  );
}
