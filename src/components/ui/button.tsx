import { forwardRef } from "react";

type Variante = "primaer" | "akzent" | "sekundaer" | "gefahr" | "leise";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /** Auf Mobile volle Breite — Daumen trifft immer. */
  vollbreit?: boolean;
}

/**
 * Nur gefüllte Flächen, keine umrandeten "Systembuttons".
 *
 *  primaer   schwarz — die ruhige Standardaktion (Speichern, Anlegen)
 *  akzent    Terrakotta — die eine Aktion, die Aufmerksamkeit ziehen soll
 *            (Aufnehmen, Senden). Pro Bildschirm höchstens eine.
 *  sekundaer weisse Fläche mit 1px Linie — Abbrechen, Nebenwege
 *  gefahr    Terrakotta-Fläche mit dunklem Text — Löschen
 *  leise     ohne Fläche — Tertiäraktionen
 */
const VARIANTEN: Record<Variante, string> = {
  primaer: "bg-tief text-text-invers hover:bg-text active:bg-text",
  akzent: "bg-akzent text-text-invers hover:bg-akzent-hover active:bg-akzent-hover",
  sekundaer:
    "border border-linie bg-flaeche text-text hover:bg-papier active:bg-papier",
  gefahr: "bg-warnung-flaeche text-warnung hover:bg-akzent hover:text-text-invers",
  leise: "text-text-leise hover:bg-papier active:bg-papier",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variante = "primaer", vollbreit, className = "", ...props },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={[
          // min-h-11 = 44px: Mindestgrösse für Touch-Ziele. Auf der Baustelle
          // wird die App mit Arbeitshandschuhen bedient.
          "inline-flex min-h-11 items-center justify-center gap-2 rounded-gross px-5",
          "text-base font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-50",
          VARIANTEN[variante],
          vollbreit ? "w-full" : "",
          className,
        ].join(" ")}
        {...props}
      />
    );
  },
);
