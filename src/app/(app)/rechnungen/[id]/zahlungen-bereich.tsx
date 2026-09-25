"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { rechnungTeilzahlungErfassen } from "../actions";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { formatEuro, parsePreis } from "@/lib/format";
import type { RechnungZahlung } from "@/types/database";

/**
 * Zahlungseingänge.
 *
 * Im Handwerk ist die Teilzahlung der Normalfall, nicht die Ausnahme: ein
 * Drittel bei Auftrag, der Rest nach Abnahme, und dann bleiben 200 € offen,
 * weil eine Kleinigkeit nachzubessern ist. Eine Rechnung, die nur "offen"
 * oder "bezahlt" kennt, zwingt den Betrieb zurück auf den Zettel — und dort
 * geht das Nachfassen verloren.
 *
 * Die einzelnen Zahlungen bleiben stehen und werden nicht verrechnet. Wer
 * wissen will, wann welcher Betrag kam, findet es hier; und beim Storno
 * bleibt nachvollziehbar, was zurückzuzahlen ist.
 */
export function ZahlungenBereich({
  rechnungId,
  brutto,
  zahlungen,
  gesperrt,
}: {
  rechnungId: string;
  brutto: number;
  zahlungen: RechnungZahlung[];
  /** Storniert: dann wird nichts mehr verbucht. */
  gesperrt: boolean;
}) {
  const router = useRouter();
  const [offenesSheet, setOffenesSheet] = useState(false);

  const bezahlt = zahlungen.reduce((s, z) => s + Number(z.betrag), 0);
  const offen = Math.max(0, Math.round((brutto - bezahlt) * 100) / 100);
  const teilweise = bezahlt > 0 && offen > 0;

  return (
    <section className="flex flex-col gap-3 rounded-karte bg-flaeche p-4 shadow-karte">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-titel text-base font-bold tracking-tight text-text">
          Zahlungen
        </h2>
        {teilweise ? (
          <span className="rounded-full bg-info-flaeche px-2.5 py-1 text-xs font-medium text-info">
            Teilweise bezahlt
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Zeile label="Rechnungsbetrag" wert={formatEuro(brutto)} />
        <Zeile label="Eingegangen" wert={formatEuro(bezahlt)} />
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-linie pt-2">
          <span className="font-medium text-text">Noch offen</span>
          <span
            className={`zahl text-lg font-semibold ${offen > 0 ? "text-text" : "text-erfolg"}`}
          >
            {formatEuro(offen)}
          </span>
        </div>
      </div>

      {zahlungen.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-linie pt-2">
          {zahlungen.map((z) => (
            <li key={z.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm text-text-leise">
                <span className="zahl">{formatDatum(z.bezahlt_am)}</span>
                {z.notiz ? ` · ${z.notiz}` : ""}
              </span>
              <span className="zahl shrink-0 text-sm font-medium">
                {formatEuro(Number(z.betrag))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {!gesperrt && offen > 0 ? (
        <Button variante="primaer" vollbreit onClick={() => setOffenesSheet(true)}>
          Zahlung erfassen
        </Button>
      ) : null}

      {offenesSheet ? (
        <ZahlungSheet
          rechnungId={rechnungId}
          offen={offen}
          onFertig={() => {
            setOffenesSheet(false);
            router.refresh();
          }}
          onSchliessen={() => setOffenesSheet(false)}
        />
      ) : null}
    </section>
  );
}

function ZahlungSheet({
  rechnungId,
  offen,
  onFertig,
  onSchliessen,
}: {
  rechnungId: string;
  offen: number;
  onFertig: () => void;
  onSchliessen: () => void;
}) {
  // Vorbelegt mit dem offenen Betrag: der häufigste Fall ist, dass genau er
  // überwiesen wurde. Wer weniger bekommen hat, ändert eine Zahl.
  const [betrag, setBetrag] = useState(offen.toFixed(2).replace(".", ","));
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, starten] = useTransition();

  function speichern() {
    starten(async () => {
      const wert = parsePreis(betrag);
      if (wert === null || wert <= 0) {
        setFehler("Bitte einen Betrag eingeben.");
        return;
      }

      const ergebnis = await rechnungTeilzahlungErfassen({
        rechnungId,
        betrag: wert,
        bezahltAm: datum,
        notiz: notiz || null,
      });
      if (ergebnis.fehler) setFehler(ergebnis.fehler);
      else onFertig();
    });
  }

  return (
    <Sheet titel="Zahlung erfassen" onSchliessen={onSchliessen}>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-leise">Betrag</span>
          <input
            value={betrag}
            onChange={(e) => setBetrag(e.target.value)}
            inputMode="decimal"
            aria-label="Betrag"
            className="zahl min-h-12 w-full rounded-feld border border-linie bg-flaeche px-3 text-lg text-text focus:border-text focus:outline-none"
          />
          <span className="text-xs text-text-leise">
            Offen sind {formatEuro(offen)}
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-leise">Eingegangen am</span>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-text-leise">
            Notiz (optional)
          </span>
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            placeholder="Anzahlung, Überweisung, bar…"
            className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text placeholder:text-text-leise/60 focus:border-text focus:outline-none"
          />
        </label>

        {fehler ? <Meldung art="fehler">{fehler}</Meldung> : null}

        <div className="mt-2 flex flex-col gap-2">
          <Button variante="akzent" vollbreit disabled={pending} onClick={speichern}>
            {pending ? "Einen Moment…" : "Zahlung buchen"}
          </Button>
          <Button variante="sekundaer" onClick={onSchliessen}>
            Abbrechen
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-text-leise">{label}</span>
      <span className="zahl text-sm font-medium">{wert}</span>
    </div>
  );
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
