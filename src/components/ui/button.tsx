import { forwardRef } from "react";

type Variante = "primaer" | "sekundaer" | "gefahr" | "leise";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Auf Mobile volle Breite — Daumen trifft immer. */
  vollbreit?: boolean;
}

const VARIANTEN: Record<Variante, string> = {
  primaer: "bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-900",
  sekundaer:
    "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50 active:bg-slate-100",
  gefahr: "bg-red-600 text-white hover:bg-red-700 active:bg-red-800",
  leise: "text-slate-600 hover:bg-slate-100 active:bg-slate-200",
};

/**
 * Basis-Button.
 *
 * `min-h-11` = 44px: das ist die Mindestgrösse für Touch-Ziele (Apple HIG /
 * Material). Auf der Baustelle wird die App mit Arbeitshandschuhen bedient —
 * darunter trifft man nicht zuverlässig.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variante = "primaer", vollbreit, className = "", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={[
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4",
          "text-base font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
          VARIANTEN[variante],
          vollbreit ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);
