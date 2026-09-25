"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Kurze Sprachaufnahme, ein Antippen lang.
 *
 * Gebaut für das Aufmass: tippen, ein Mass sprechen, tippen. Drei Sekunden,
 * zwanzigmal hintereinander. Deshalb hier bewusst ohne Pegelanzeige und ohne
 * Timer — beides braucht eine Aufnahme, die man beobachtet, und genau das tut
 * man beim Messen nicht.
 *
 * Der Angebotsbildschirm hat seine eigene, ausführlichere Aufnahme. Sie wird
 * hier nicht mitbenutzt: sie funktioniert, sie ist erprobt, und sie umzubauen
 * hätte den einen Weg gefährdet, der das Produkt trägt. Wenn dieser Hook sich
 * bewährt, kann der andere Bildschirm später darauf umziehen — nicht
 * umgekehrt.
 */

type Zustand = "bereit" | "aufnahme" | "verarbeitung";

export function useAufnahme(opts: {
  /** Wird mit der fertigen Aufnahme gerufen. */
  onFertig: (audio: Blob) => Promise<void> | void;
  /** Sicherheitsnetz gegen den vergessenen Knopf. */
  maxSekunden?: number;
}) {
  const { onFertig, maxSekunden = 30 } = opts;

  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [fehler, setFehler] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const teileRef = useRef<Blob[]>([]);
  const stoppUhrRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Der Rückruf darf sich ändern, ohne die laufende Aufnahme zu stören.
  const fertigRef = useRef(onFertig);
  fertigRef.current = onFertig;

  const aufraeumen = useCallback(() => {
    if (stoppUhrRef.current) clearTimeout(stoppUhrRef.current);
    stoppUhrRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  // Mikrofon freigeben, wenn der Bildschirm verlassen wird — sonst bleibt die
  // Aufnahme-LED an und das Telefon wirkt, als höre die App weiter zu.
  useEffect(() => aufraeumen, [aufraeumen]);

  const stoppen = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      setZustand("verarbeitung");
      recorderRef.current.stop();
    }
  }, []);

  const starten = useCallback(async () => {
    setFehler(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Auf der Baustelle ist es laut.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      teileRef.current = [];

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) teileRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const audio = new Blob(teileRef.current, { type: recorder.mimeType });
        aufraeumen();
        try {
          await fertigRef.current(audio);
        } finally {
          setZustand("bereit");
        }
      };

      recorder.start();
      setZustand("aufnahme");

      // Vergessener Knopf: nach der Höchstdauer von selbst beenden.
      stoppUhrRef.current = setTimeout(stoppen, maxSekunden * 1000);
    } catch {
      setFehler(
        "Kein Zugriff aufs Mikrofon. Im Browser die Erlaubnis erteilen — oder das Mass eintippen.",
      );
      setZustand("bereit");
    }
  }, [aufraeumen, maxSekunden, stoppen]);

  return {
    zustand,
    fehler,
    setFehler,
    laeuft: zustand === "aufnahme",
    arbeitet: zustand === "verarbeitung",
    umschalten: () => (zustand === "aufnahme" ? stoppen() : starten()),
  };
}

/** Dateiendung passend zum vom Browser gewählten Format. */
export function endung(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
