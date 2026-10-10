"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Ein Abschnitt, der beim Scrollen erscheint.
 *
 * Warum nicht in CSS: `animation-timeline: view()` wäre eleganter, kann aber
 * noch kein Safari — und ein grosser Teil der Handwerker hat ein iPhone. Also
 * ein Beobachter, der einmal auslöst und sich danach abmeldet.
 *
 * Zwei Dinge sind hier wichtiger als der Effekt selbst:
 *
 *  1. **Ohne JavaScript ist alles da.** Der versteckte Anfangszustand wird
 *     erst im Browser gesetzt; wer kein JavaScript ausführt — oder wessen
 *     Verbindung im Funkloch abbricht —, sieht die fertige Seite statt einer
 *     leeren.
 *  2. **Wer keine Bewegung will, bekommt keine.** `prefers-reduced-motion`
 *     schaltet den Effekt ganz ab, nicht nur langsamer.
 */
export function Erscheinen({
  children,
  verzug = 0,
  className = "",
}: {
  children: ReactNode;
  /** Millisekunden Versatz — für Karten, die nacheinander hereinkommen. */
  verzug?: number;
  className?: string;
}) {
  const [sichtbar, setSichtbar] = useState(true);
  const [bereit, setBereit] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Erst jetzt verstecken: bis hierher war der Inhalt sichtbar und bleibt
    // es auch, wenn dieser Code nie läuft.
    setSichtbar(false);
    setBereit(true);

    const el = ref.current;
    if (!el) return;

    const beobachter = new IntersectionObserver(
      ([eintrag]) => {
        if (!eintrag.isIntersecting) return;
        setSichtbar(true);
        beobachter.disconnect();
      },
      // Etwas früher auslösen, damit der Abschnitt schon dasteht, wenn man
      // ihn erreicht — statt dann erst anzufangen.
      { rootMargin: "0px 0px -12% 0px" },
    );
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${verzug}ms` }}
      className={[
        className,
        bereit ? "transition-[opacity,transform] duration-700 ease-out" : "",
        sichtbar ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
