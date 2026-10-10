"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Der Mitschnitt der laufenden Anwendung.
 *
 * Aufgenommen von scripts/bilder/film.mjs gegen die echte, gebaute App mit
 * denselben Beispieldaten wie der Rauchtest. Kein Animationsfilm: wer das
 * sieht, sieht das Produkt.
 *
 * Entscheidungen, die man dem Video nicht ansieht:
 *
 *  - **Stumm und von selbst laufend.** Ton auf einer Startseite ist
 *    übergriffig, und ohne Ton darf das Video automatisch starten. Deshalb
 *    auch `playsInline`: ohne das reisst iOS das Video in den Vollbildmodus.
 *  - **`preload="metadata"`.** Geladen werden erst die Kopfdaten, nicht die
 *    400 KB Bilddaten; die holt der Browser, wenn er zu spielen anfängt.
 *  - **Standbild als Rückfallebene.** Das Format ist webm. Safari kann das
 *    erst ab Version 17.4 — ältere iPhones zeigen das Standbild, und das ist
 *    ein echter Bildschirmausschnitt, kein leerer Kasten. Dort verschwindet
 *    auch der Abspielknopf, statt auf einen Druck hin nichts zu tun. Ein MP4
 *    daneben wäre die bessere Lösung; der hier verfügbare ffmpeg kann aber
 *    kein H.264 erzeugen.
 */
export function Film() {
  const [laeuft, setLaeuft] = useState(false);
  const [abspielbar, setAbspielbar] = useState(true);
  const ref = useRef<HTMLVideoElement>(null);

  // Kann dieser Browser webm überhaupt? Erst im Effekt, damit Server und
  // erster Client-Durchlauf dasselbe ausgeben.
  useEffect(() => {
    const video = ref.current;
    if (video && video.canPlayType("video/webm") === "") setAbspielbar(false);
  }, []);

  return (
    <div className="relative">
      <video
        ref={ref}
        className="h-full w-full rounded-[1.6rem] object-cover"
        poster="/bilder/film-standbild.png"
        preload="metadata"
        muted
        loop
        playsInline
        autoPlay
        onPlaying={() => setLaeuft(true)}
        onPause={() => setLaeuft(false)}
        aria-label="Mitschnitt: ein Angebot einsprechen, prüfen und beim Kunden freigeben"
      >
        <source src="/bilder/baustift-demo.webm" type="video/webm" />
      </video>

      {/*
        Der Knopf erscheint nur, wenn das Video nicht von selbst läuft — etwa
        weil der Browser das Starten unterbindet oder Energiesparen aktiv ist.
        Ein Abspielknopf über einem laufenden Video ist nur im Weg.
      */}
      {laeuft || !abspielbar ? null : (
        <button
          type="button"
          onClick={() => void ref.current?.play()}
          aria-label="Mitschnitt abspielen"
          className="absolute inset-0 flex items-center justify-center rounded-[1.6rem] bg-tief/20 transition-colors hover:bg-tief/30"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-flaeche/95 shadow-schwebend">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7 fill-text" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
    </div>
  );
}
