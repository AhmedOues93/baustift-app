import { forwardRef } from "react";

/**
 * Eingabefelder für die Baustelle.
 *
 * - min-h-11 (44px) wie bei den Buttons.
 * - `text-base` (16px) ist Pflicht: bei kleinerer Schrift zoomt iOS Safari beim
 *   Fokussieren automatisch ins Feld hinein und das Layout springt.
 * - Label immer sichtbar (kein Placeholder-als-Label): im Sonnenlicht und beim
 *   schnellen Ausfüllen ist ein verschwindendes Label unbrauchbar.
 */

const FELD_KLASSEN = [
  "w-full min-h-11 rounded-xl border border-slate-300 bg-white px-3 py-2",
  "text-base text-slate-900 placeholder:text-slate-400",
  "focus:border-brand-600 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-brand-600/30",
  "disabled:bg-slate-100",
].join(" ");

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hinweis?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hinweis, id, className = "", ...props },
  ref,
) {
  const feldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={feldId} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        ref={ref}
        id={feldId}
        className={`${FELD_KLASSEN} ${className}`}
        {...props}
      />
      {hinweis ? <p className="text-xs text-slate-500">{hinweis}</p> : null}
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
        <label htmlFor={feldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
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
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, id, className = "", ...props }, ref) {
    const feldId = id ?? props.name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={feldId} className="text-sm font-medium text-slate-700">
          {label}
        </label>
        <textarea
          ref={ref}
          id={feldId}
          className={`${FELD_KLASSEN} min-h-24 ${className}`}
          {...props}
        />
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
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-green-200 bg-green-50 text-green-800";
  return (
    <p
      role={art === "fehler" ? "alert" : "status"}
      className={`rounded-xl border px-3 py-2 text-sm ${stil}`}
    >
      {children}
    </p>
  );
}
