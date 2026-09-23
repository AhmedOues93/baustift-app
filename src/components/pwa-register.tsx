"use client";

import { useEffect } from "react";

/**
 * Registriert den Service Worker.
 *
 * Nur in Produktion: im Dev-Modus würde ein Service Worker das Hot Reloading
 * von Next stören und veraltete Dateien ausliefern.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const registrieren = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registrierung kann scheitern (privates Fenster, blockierte Cookies).
        // Die App funktioniert dann ganz normal, nur ohne Offline-Seite.
      });
    };

    // Erst nach dem Laden registrieren, damit der Worker nicht mit dem
    // ersten Rendern um Bandbreite konkurriert.
    if (document.readyState === "complete") registrieren();
    else window.addEventListener("load", registrieren, { once: true });
  }, []);

  return null;
}
