export const metadata = { title: "Neues Angebot · Baustift" };

/** Platzhalter — Aufnahme, Transkription und KI-Extraktion folgen als Nächstes. */
export default function NeuesAngebotPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] leading-none">Neues Angebot</h1>
      <p className="rounded-karte border border-dashed border-linie p-8 text-center text-text-leise">
        Die Sprachaufnahme wird gerade gebaut. Lege solange deine Preise an —
        darauf greift die KI später zu.
      </p>
    </div>
  );
}
