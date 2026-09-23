"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { KundenFormular } from "@/app/(app)/kunden/kunden-formular";
import { Button } from "@/components/ui/button";
import { Meldung, Textarea } from "@/components/ui/field";
import { IconMikrofon, IconPlus, IconStopp } from "@/components/ui/icons";
import type { Kunde } from "@/types/database";

type Zustand = "bereit" | "aufnahme" | "verarbeitung";

/** Harte Grenze, passend zu AUDIO_MAX_SEKUNDEN auf dem Server. */
const MAX_SEKUNDEN = 10 * 60;

/**
 * Aufnahme-Bildschirm.
 *
 * Drei Dinge, die in der Praxis über Erfolg oder Frust entscheiden:
 *
 *  1. Der Aufnahmeknopf ist 88px gross und sitzt unten — er wird mit dem
 *     Daumen getroffen, im Stehen, mit Handschuh.
 *  2. Es gibt IMMER den Weg über die Tastatur. Mikrofonrechte werden
 *     abgelehnt, das Handy hängt am Autoradio, auf der Baustelle ist es zu
 *     laut — ohne Ausweichweg ist das Produkt in diesen Fällen tot.
 *  3. Der Pegel wird sichtbar angezeigt. Eine stumme Aufnahme merkt man sonst
 *     erst, wenn nach 40 Sekunden "da war nichts zu hören" kommt.
 */
export function Aufnahme({ kunden }: { kunden: Kunde[] }) {
  const router = useRouter();

  const [zustand, setZustand] = useState<Zustand>("bereit");
  const [sekunden, setSekunden] = useState(0);
  const [pegel, setPegel] = useState<number[]>(() => new Array(28).fill(0.05));
  const [fehler, setFehler] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [tippen, setTippen] = useState(false);
  const [kundeId, setKundeId] = useState<string>("");
  const [kundenListe, setKundenListe] = useState(kunden);
  const [kundeSheet, setKundeSheet] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const teileRef = useRef<Blob[]>([]);

  /** Alles freigeben: Mikrofon-LED aus, kein Timer, kein AudioContext mehr. */
  const aufraeumen = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  useEffect(() => aufraeumen, [aufraeumen]);

  // Timer läuft nur während der Aufnahme.
  useEffect(() => {
    if (zustand !== "aufnahme") return;
    const id = setInterval(() => setSekunden((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [zustand]);

  // Sicherheitsnetz gegen den vergessenen Aufnahmeknopf in der Hosentasche.
  useEffect(() => {
    if (zustand === "aufnahme" && sekunden >= MAX_SEKUNDEN) stoppen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sekunden, zustand]);

  async function starten() {
    setFehler(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Auf der Baustelle ist es laut — die Browser-Filter helfen spürbar.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Pegelanzeige
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const daten = new Uint8Array(analyser.frequencyBinCount);

      const zeichnen = () => {
        analyser.getByteFrequencyData(daten);
        const schnitt = daten.reduce((a, b) => a + b, 0) / daten.length / 255;
        setPegel((alt) => [...alt.slice(1), Math.max(0.05, Math.min(1, schnitt * 2.2))]);
        rafRef.current = requestAnimationFrame(zeichnen);
      };
      rafRef.current = requestAnimationFrame(zeichnen);

      teileRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: waehleFormat() });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) teileRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(teileRef.current, { type: recorder.mimeType });
        aufraeumen();
        void absenden(blob);
      };
      recorder.start();
      recorderRef.current = recorder;

      setSekunden(0);
      setZustand("aufnahme");
    } catch {
      setFehler(
        "Kein Zugriff aufs Mikrofon. Erlaube es in den Browser-Einstellungen — oder tippe die Beschreibung ein.",
      );
      setTippen(true);
    }
  }

  function stoppen() {
    if (recorderRef.current?.state === "recording") {
      setZustand("verarbeitung");
      recorderRef.current.stop();
    }
  }

  async function absenden(audio?: Blob) {
    setZustand("verarbeitung");
    setFehler(null);

    const formData = new FormData();
    if (kundeId) formData.set("kunde_id", kundeId);
    if (audio) {
      formData.set("audio", audio, `aufnahme.${endung(audio.type)}`);
    } else {
      formData.set("text", text);
    }

    try {
      const antwort = await fetch("/api/angebote/neu", {
        method: "POST",
        body: formData,
      });
      const ergebnis = await antwort.json();

      if (!antwort.ok) {
        setFehler(ergebnis.fehler ?? "Das hat nicht geklappt.");
        setZustand("bereit");
        return;
      }

      // Direkt in die Prüfung — das ist der Moment, in dem der Handwerker
      // sieht, dass es funktioniert hat.
      router.push(`/angebote/${ergebnis.angebotId}`);
    } catch {
      setFehler("Keine Verbindung. Sobald du wieder Netz hast, nochmal probieren.");
      setZustand("bereit");
    }
  }

  const laeuft = zustand === "aufnahme";
  const arbeitet = zustand === "verarbeitung";

  return (
    <div className="flex flex-col gap-5">
      {/* Kunde --------------------------------------------------------------- */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="kunde" className="text-sm font-medium text-text-leise">
          Kunde
        </label>
        <div className="flex gap-2">
          <select
            id="kunde"
            value={kundeId}
            onChange={(e) => setKundeId(e.target.value)}
            disabled={laeuft || arbeitet}
            className="min-h-11 flex-1 rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
          >
            <option value="">Ohne Kunde (später zuordnen)</option>
            {kundenListe.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
                {k.ort ? ` · ${k.ort}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setKundeSheet(true)}
            aria-label="Neuen Kunden anlegen"
            className="flex min-h-11 w-11 items-center justify-center rounded-feld border border-linie bg-flaeche transition-colors active:bg-papier"
          >
            <IconPlus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Aufnahme ------------------------------------------------------------ */}
      <div className="rounded-tafel bg-tief p-6 text-text-invers">
        <p className="font-titel text-lg font-bold tracking-tight">
          {arbeitet
            ? "Angebot wird erstellt…"
            : laeuft
              ? "Ich höre zu"
              : "Leistung einsprechen"}
        </p>
        <p className="mt-1 text-sm text-text-invers/70">
          {arbeitet
            ? "Transkribieren, Positionen erkennen, Preise zuordnen."
            : laeuft
              ? "Masse, Material und Besonderheiten nennen."
              : "Zum Beispiel: Bad komplett, acht Quadratmeter, alte Fliesen raus."}
        </p>

        {/* Pegel: zeigt, dass wirklich etwas ankommt. */}
        <div
          aria-hidden="true"
          className="mt-6 flex h-14 items-center justify-center gap-[3px]"
        >
          {pegel.map((p, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full transition-[height] duration-75 ${
                laeuft ? "bg-akzent" : "bg-text-invers/20"
              }`}
              style={{ height: `${Math.round((laeuft ? p : 0.08) * 100)}%` }}
            />
          ))}
        </div>

        <p className="zahl mt-2 text-center text-sm text-text-invers/70">
          {formatDauer(sekunden)}
        </p>

        <div className="mt-5 flex justify-center">
          {arbeitet ? (
            <span className="flex h-[88px] w-[88px] items-center justify-center rounded-full bg-text-invers/10">
              <span className="h-7 w-7 animate-spin rounded-full border-2 border-text-invers/30 border-t-text-invers" />
            </span>
          ) : (
            <button
              type="button"
              onClick={laeuft ? stoppen : starten}
              aria-label={laeuft ? "Aufnahme beenden" : "Aufnahme starten"}
              className={[
                "flex h-[88px] w-[88px] items-center justify-center rounded-full transition-colors",
                "bg-akzent text-text-invers active:bg-akzent-hover",
                laeuft ? "ring-8 ring-akzent/25" : "",
              ].join(" ")}
            >
              {laeuft ? (
                <IconStopp className="h-8 w-8" />
              ) : (
                <IconMikrofon className="h-9 w-9" />
              )}
            </button>
          )}
        </div>
      </div>

      {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}

      {/* Tastatur-Weg --------------------------------------------------------- */}
      {tippen ? (
        <div className="flex flex-col gap-3">
          <Textarea
            label="Oder eintippen"
            name="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={arbeitet}
            placeholder="Bad komplett, ca. 8 m². Alte Fliesen raus, neue 60x60. Dusche bodengleich mit Rinne. WC tauschen, Entsorgung mit rein."
            className="min-h-32"
            hinweis="Genauso gut wie die Aufnahme — die KI liest beides gleich."
          />
          <Button
            variante="primaer"
            vollbreit
            disabled={arbeitet || text.trim().length < 10}
            onClick={() => absenden()}
          >
            {arbeitet ? "Angebot wird erstellt…" : "Angebot erstellen"}
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setTippen(true)}
          disabled={laeuft || arbeitet}
          className="min-h-11 text-sm font-medium text-akzent underline underline-offset-2"
        >
          Lieber eintippen
        </button>
      )}

      {kundeSheet ? (
        <KundenFormular
          onSchliessen={() => setKundeSheet(false)}
          onAngelegt={(k) => {
            setKundenListe((alt) => [...alt, k]);
            setKundeId(k.id);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Safari kann kein WebM. Wir fragen den Browser, was er wirklich kann, statt
 * ein Format zu erzwingen — sonst nimmt jedes iPhone stumm nichts auf.
 */
function waehleFormat(): string {
  const kandidaten = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const typ of kandidaten) {
    if (MediaRecorder.isTypeSupported(typ)) return typ;
  }
  return "";
}

function endung(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

function formatDauer(sekunden: number): string {
  const m = Math.floor(sekunden / 60);
  const s = sekunden % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
