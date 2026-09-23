import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-8 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">
          Baustift
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Angebot diktieren. PDF bekommen.
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Beschreibe deine Leistung per Sprachnachricht — Baustift erkennt die
          Positionen, rechnet mit deiner Preisliste und erstellt ein
          professionelles Angebot als PDF.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/signup"
          className="rounded-lg bg-brand-600 px-5 py-3 font-medium text-white transition hover:bg-brand-700"
        >
          Kostenlos starten
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium transition hover:bg-slate-50"
        >
          Anmelden
        </Link>
      </div>
    </main>
  );
}
