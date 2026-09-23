import { forwardRef } from "react";

/**
 * Eingabefelder für die Baustelle.
 *
 * - min-h-11 (44px) wie bei den Buttons.
 * - `text-base` (16px) ist Pflicht: bei kleinerer Schrift zoomt iOS Safari beim
 *   Fokussieren automatisch ins Feld hinein und das Layout springt.
 * - Label immer sichtbar (kein Placeholder-als-Label): im Sonnenlicht und beim
 *   schnellen Ausfüllen ist ein verschwindendes Label unbrauchbar.
 * - Rahmen genau 1px in `linie`; im Fokus wird er dunkel statt blau.
 */

const FELD_KLASSEN = [
  "w-full min-h-11 rounded-feld border border-linie bg-flaeche px-3 py-2",
  "text-base text-text placeholder:text-text-leise/60",
  "transition-colors focus:border-text focus:outline-none",
  "disabled:bg-papier disabled:text-text-leise",
].join(" ");

function Label({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-medium text-text-leise">
      {children}
    </label>
  );
}

function Hinweis({ children }: { children: React.ReactNode }) {
  return <p className="text-xs leading-snug text-text-leise">{children}</p>;
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hinweis?: string;
  /** Zahlenfeld: Monoschrift, damit Beträge und Mengen sauber stehen. */
  zahl?: boolean;
  /** Feste Einheit rechts im Feld, z. B. "€". */
  suffix?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hinweis, zahl, suffix, id, className = "", ...props },
  ref,
) {
  const feldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={feldId}>{label}</Label>
      <div className="relative">
        <input
          ref={ref}
          id={feldId}
          className={[
            FELD_KLASSEN,
            zahl ? "zahl" : "",
            suffix ? "pr-9" : "",
            className,
          ].join(" ")}
          {...props}
        />
        {suffix ? (
          <span className="zahl pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-leise">
            {suffix}
          </span>
        ) : null}
      </div>
      {hinweis ? <Hinweis>{hinweis}</Hinweis> : null}
    </div>
  );
});

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, id, className = "", children, ...props }, ref) {
    const feldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={feldId}>{label}</Label>
        <select
          ref={ref}
          id={feldId}
          className={`${FELD_KLASSEN} ${className}`}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hinweis?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hinweis, id, className = "", ...props }, ref) {
    const feldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={feldId}>{label}</Label>
        <textarea
          ref={ref}
          id={feldId}
          className={`${FELD_KLASSEN} min-h-24 ${className}`}
          {...props}
        />
        {hinweis ? <Hinweis>{hinweis}</Hinweis> : null}
      </div>
    );
  },
);

/** Fehler- bzw. Erfolgsmeldung über einem Formular. */
export function Meldung({
  art,
  children,
}: {
  art: "fehler" | "erfolg";
  children: React.ReactNode;
}) {
  const stil =
    art === "fehler"
      ? "bg-warnung-flaeche text-warnung"
      : "bg-erfolg-flaeche text-erfolg";
  return (
    <p
      role={art === "fehler" ? "alert" : "status"}
      className={`rounded-feld px-3 py-2.5 text-sm ${stil}`}
    >
      {children}
    </p>
  );
}

/**
 * Statusplakette (Entwurf, Gesendet, Angenommen, Nachfassen).
 * Eigene Komponente, damit dieselben Zustandsfarben überall gleich aussehen.
 */
export function Plakette({
  ton = "neutral",
  children,
}: {
  ton?: "neutral" | "erfolg" | "warnung" | "info";
  children: React.ReactNode;
}) {
  const toene = {
    neutral: "bg-papier text-text-leise",
    erfolg: "bg-erfolg-flaeche text-erfolg",
    warnung: "bg-warnung-flaeche text-warnung",
    info: "bg-info-flaeche text-info",
  } as const;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${toene[ton]}`}
    >
      {children}
    </span>
  );
}
