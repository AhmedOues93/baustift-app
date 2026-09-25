"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  rechnungBezahlt,
  rechnungMahnen,
  rechnungSpeichern,
  rechnungStellen,
  rechnungStornieren,
  rechnungVersenden,
  type RechnungPositionEingabe,
} from "../actions";
import { Button } from "@/components/ui/button";
import { Meldung, Plakette } from "@/components/ui/field";
import { IconKreuz, IconPdf, IconPlus, IconSenden } from "@/components/ui/icons";
import { formatEuro, formatPreisEingabe, parsePreis } from "@/lib/format";
import { TeilenKnopf } from "@/components/ui/teilen";
import { rechnungUeberfaellig, tageUeberfaellig } from "@/lib/rechnung";
import {
  EINHEIT_LABEL,
  RECHNUNG_STATUS_LABEL,
  type Einheit,
  type Kunde,
  type Rechnung,
  type RechnungPosition,
} from "@/types/database";

type Zeile = RechnungPositionEingabe & { key: string };

const SPEICHER_VERZOEGERUNG_MS = 900;

/**
 * Rechnung bearbeiten und stellen.
 *
 * Der ganze Bildschirm dreht sich um eine Grenze: solange die Rechnung ein
 * Entwurf ist, lässt sich alles ändern; ist sie gestellt, ist sie ein Beleg
 * und nur noch zu lesen. Das wird hier sichtbar gemacht — Felder werden zu
 * Text, und statt "Stellen" stehen "Bezahlt" und "Stornieren" da.
 *
 * Erzwungen wird die Grenze nicht hier, sondern in der Datenbank
 * (Trigger in 0005_rechnungen.sql). Diese Oberfläche erklärt sie nur.
 */
export function RechnungEditor({
  rechnung,
  positionen,
  kunden,
  versandMoeglich,
}: {
  rechnung: Rechnung;
  positionen: RechnungPosition[];
  kunden: Kunde[];
  versandMoeglich: boolean;
}) {
  const router = useRouter();
  const gestellt = Boolean(rechnung.festgeschrieben_am);

  const [titel, setTitel] = useState(rechnung.titel);
  const [kundeId, setKundeId] = useState(rechnung.kunde_id ?? "");
  const [notiz, setNotiz] = useState(rechnung.notiz ?? "");
  const [leistungVon, setLeistungVon] = useState(rechnung.leistung_von ?? "");
  const [leistungBis, setLeistungBis] = useState(rechnung.leistung_bis ?? "");
  const [zahlungsziel, setZahlungsziel] = useState(rechnung.zahlungsziel_tage);
  const [zeilen, setZeilen] = useState<Zeile[]>(() =>
    positionen.map((p) => ({
      key: p.id,
      id: p.id,
      bezeichnung: p.bezeichnung,
      beschreibung: p.beschreibung,
      menge: p.menge,
      einheit: p.einheit,
      einzelpreis: p.einzelpreis,
    })),
  );

  const [zustand, setZustand] = useState<"rein" | "offen" | "speichert" | "fehler">("rein");
  const [meldung, setMeldung] = useState<{ art: "fehler" | "erfolg"; text: string } | null>(null);
  const [pending, starten] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ersterLauf = useRef(true);

  const netto = zeilen.reduce((s, z) => s + runde(z.menge * z.einzelpreis), 0);
  const mwst = runde((netto * rechnung.mwst_satz) / 100);
  const brutto = runde(netto + mwst);

  const speichern = useCallback(async () => {
    if (gestellt) return;
    setZustand("speichert");
    const ergebnis = await rechnungSpeichern({
      rechnungId: rechnung.id,
      titel,
      kundeId: kundeId || null,
      notiz,
      leistungVon: leistungVon || null,
      leistungBis: leistungBis || null,
      zahlungszielTage: zahlungsziel,
      positionen: zeilen.map(({ key: _key, ...rest }) => rest),
    });

    if (ergebnis.fehler) {
      setZustand("fehler");
      return;
    }
    if (ergebnis.positionIds) {
      setZeilen((alt) =>
        alt.map((z, i) => ({ ...z, id: ergebnis.positionIds![i] ?? z.id })),
      );
    }
    setZustand("rein");
  }, [gestellt, rechnung.id, titel, kundeId, notiz, leistungVon, leistungBis, zahlungsziel, zeilen]);

  useEffect(() => {
    if (ersterLauf.current) {
      ersterLauf.current = false;
      return;
    }
    if (gestellt) return;
    setZustand("offen");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void speichern(), SPEICHER_VERZOEGERUNG_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [titel, kundeId, notiz, leistungVon, leistungBis, zahlungsziel, zeilen, gestellt, speichern]);

  function stellen() {
    // Unumkehrbar — deshalb eine Rückfrage, die den Grund nennt.
    if (
      !confirm(
        "Rechnung jetzt stellen?\n\nDanach lassen sich Betrag und Positionen nicht mehr ändern. Eine Korrektur geht nur noch über eine Stornorechnung.",
      )
    ) {
      return;
    }
    starten(async () => {
      await speichern();
      const ergebnis: { fehler?: string; erfolg?: string } = versandMoeglich
        ? await rechnungVersenden(rechnung.id)
        : await rechnungStellen(rechnung.id);
      if (ergebnis.fehler) {
        setMeldung({ art: "fehler", text: ergebnis.fehler });
      } else if (ergebnis.erfolg) {
        setMeldung({ art: "erfolg", text: ergebnis.erfolg });
      }
      router.refresh();
    });
  }

  function bezahlt() {
    starten(async () => {
      await rechnungBezahlt(rechnung.id);
      router.refresh();
    });
  }

  function mahnen() {
    starten(async () => {
      const ergebnis = await rechnungMahnen(rechnung.id);
      setMeldung(
        ergebnis.fehler
          ? { art: "fehler", text: ergebnis.fehler }
          : { art: "erfolg", text: ergebnis.erfolg ?? "Erinnerung verschickt." },
      );
      router.refresh();
    });
  }

  function stornieren() {
    if (
      !confirm(
        "Rechnung stornieren?\n\nEs entsteht eine Stornorechnung mit eigener Nummer. Die ursprüngliche Rechnung bleibt als Beleg erhalten.",
      )
    ) {
      return;
    }
    starten(async () => {
      const ergebnis = await rechnungStornieren(rechnung.id);
      if (ergebnis.fehler) {
        setMeldung({ art: "fehler", text: ergebnis.fehler });
        return;
      }
      if (ergebnis.stornoId) router.push(`/rechnungen/${ergebnis.stornoId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="zahl text-sm text-text-leise">{rechnung.nummer}</span>
          <Plakette
            ton={
              rechnung.status === "bezahlt"
                ? "erfolg"
                : rechnung.status === "storniert"
                  ? "warnung"
                  : rechnung.status === "gestellt"
                    ? "info"
                    : "neutral"
            }
          >
            {RECHNUNG_STATUS_LABEL[rechnung.status]}
          </Plakette>
          {!gestellt ? (
            <span className="text-sm text-text-leise">
              {zustand === "rein"
                ? "Gespeichert"
                : zustand === "fehler"
                  ? "Nicht gespeichert"
                  : "Speichert…"}
            </span>
          ) : null}
        </div>

        {gestellt ? (
          <h1 className="font-titel text-[26px] font-bold leading-tight tracking-tight">
            {titel || "Ohne Titel"}
          </h1>
        ) : (
          <input
            value={titel}
            onChange={(e) => setTitel(e.target.value)}
            aria-label="Titel der Rechnung"
            placeholder="Titel, z. B. Badsanierung Lindenstr. 12"
            className="min-h-11 w-full bg-transparent py-1 font-titel text-[26px] font-bold leading-tight tracking-tight text-text placeholder:text-text-leise/50 focus:outline-none"
          />
        )}
      </header>

      {/* Überfällig ---------------------------------------------------------
          Die unangenehme Aufgabe sichtbar machen, statt sie in einer Liste zu
          verstecken: hinterher zu sein entscheidet, ob das Geld kommt. */}
      {rechnungUeberfaellig(rechnung) ? (
        <section className="rounded-karte bg-warnung-flaeche p-4">
          <p className="font-medium text-warnung">
            Seit <span className="zahl">{tageUeberfaellig(rechnung.faellig_am)}</span>{" "}
            {tageUeberfaellig(rechnung.faellig_am) === 1 ? "Tag" : "Tagen"} überfällig
          </p>
          <p className="mt-1 text-sm text-warnung">
            {rechnung.mahnungen > 0 && rechnung.gemahnt_am
              ? `Zuletzt erinnert am ${formatDatum(rechnung.gemahnt_am.slice(0, 10))}` +
                (rechnung.mahnungen > 1 ? ` (${rechnung.mahnungen} Erinnerungen)` : "")
              : "Noch nicht erinnert."}
          </p>
          {versandMoeglich ? (
            <Button
              variante="akzent"
              className="mt-3 w-full sm:w-auto"
              disabled={pending}
              onClick={mahnen}
            >
              <IconSenden className="h-5 w-5" />
              {rechnung.mahnungen > 0
                ? "Noch einmal erinnern"
                : "Zahlungserinnerung senden"}
            </Button>
          ) : (
            <p className="mt-2 text-sm text-warnung">
              Für Erinnerungen per E-Mail fehlt der Versand. Das PDF kannst du
              oben öffnen und selbst schicken.
            </p>
          )}
        </section>
      ) : null}


      {gestellt ? (
        <p className="rounded-feld bg-info-flaeche px-3 py-2.5 text-sm text-info">
          Diese Rechnung ist gestellt und damit unveränderlich. Korrekturen gehen
          nur über eine Stornorechnung.
        </p>
      ) : null}

      {/* Kopfdaten ----------------------------------------------------------- */}
      <section className="flex flex-col gap-3 rounded-karte bg-flaeche p-4 shadow-karte">
        {gestellt ? (
          <Zeileninfo
            label="Kunde"
            wert={kunden.find((k) => k.id === kundeId)?.name ?? "—"}
          />
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-leise">Kunde</span>
            <select
              value={kundeId}
              onChange={(e) => setKundeId(e.target.value)}
              className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
            >
              <option value="">Kein Kunde zugeordnet</option>
              {kunden.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.ort ? ` · ${k.ort}` : ""}
                </option>
              ))}
            </select>
          </label>
        )}

        {gestellt ? (
          <>
            <Zeileninfo
              label="Leistungszeitraum"
              wert={
                leistungVon
                  ? leistungBis && leistungBis !== leistungVon
                    ? `${formatDatum(leistungVon)} – ${formatDatum(leistungBis)}`
                    : formatDatum(leistungVon)
                  : "—"
              }
            />
            <Zeileninfo
              label="Fällig"
              wert={rechnung.faellig_am ? formatDatum(rechnung.faellig_am) : "—"}
            />
          </>
        ) : (
          <>
            {/* Pflichtangabe nach §14 UStG — deshalb steht sie hier oben und
                nicht in einem Aufklappmenü. */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-leise">Leistung von</span>
                <input
                  type="date"
                  value={leistungVon}
                  onChange={(e) => setLeistungVon(e.target.value)}
                  className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-text-leise">bis</span>
                <input
                  type="date"
                  value={leistungBis}
                  onChange={(e) => setLeistungBis(e.target.value)}
                  className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-text-leise">Zahlungsziel</span>
              <select
                value={zahlungsziel}
                onChange={(e) => setZahlungsziel(Number(e.target.value))}
                className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
              >
                {[7, 14, 21, 30].map((t) => (
                  <option key={t} value={t}>
                    {t} Tage
                  </option>
                ))}
                <option value={0}>sofort</option>
              </select>
            </label>
          </>
        )}
      </section>

      {/* Positionen ---------------------------------------------------------- */}
      <section className="flex flex-col gap-2">
        {zeilen.map((z, i) =>
          gestellt ? (
            <article key={z.key} className="rounded-karte bg-flaeche p-4 shadow-karte">
              <div className="flex items-start gap-3">
                <span className="zahl w-4 shrink-0 text-sm text-text-leise">{i + 1}</span>
                <span className="flex-1 font-medium">{z.bezeichnung}</span>
                <span className="zahl shrink-0 text-[15px] font-medium">
                  {formatEuro(runde(z.menge * z.einzelpreis))}
                </span>
              </div>
              <p className="zahl mt-1 pl-7 text-sm text-text-leise">
                {formatMenge(z.menge)} {EINHEIT_LABEL[z.einheit]} ×{" "}
                {formatEuro(z.einzelpreis)}
              </p>
            </article>
          ) : (
            <PositionsKarte
              key={z.key}
              nummer={i + 1}
              zeile={z}
              onAendern={(teil) =>
                setZeilen((alt) =>
                  alt.map((x) => (x.key === z.key ? { ...x, ...teil } : x)),
                )
              }
              onEntfernen={() =>
                setZeilen((alt) => alt.filter((x) => x.key !== z.key))
              }
            />
          ),
        )}

        {!gestellt ? (
          <button
            type="button"
            onClick={() =>
              setZeilen((alt) => [
                ...alt,
                {
                  key: `neu-${Date.now()}`,
                  bezeichnung: "",
                  beschreibung: null,
                  menge: 1,
                  einheit: "stk",
                  einzelpreis: 0,
                },
              ])
            }
            className="flex min-h-14 items-center justify-center gap-2 rounded-karte border border-dashed border-linie text-sm font-medium text-akzent transition-colors active:bg-akzent-flaeche"
          >
            <IconPlus className="h-5 w-5" />
            Position hinzufügen
          </button>
        ) : null}
      </section>

      {/* Summen -------------------------------------------------------------- */}
      <section className="rounded-karte bg-flaeche p-4 shadow-karte">
        <div className="flex items-baseline justify-between py-1">
          <span className="text-text-leise">Netto</span>
          <span className="zahl">{formatEuro(gestellt ? rechnung.netto : netto)}</span>
        </div>
        {rechnung.mwst_satz > 0 ? (
          <div className="flex items-baseline justify-between py-1">
            <span className="text-text-leise">
              MwSt. {String(rechnung.mwst_satz).replace(".00", "")} %
            </span>
            <span className="zahl">
              {formatEuro(gestellt ? rechnung.mwst_betrag : mwst)}
            </span>
          </div>
        ) : (
          <p className="mt-2 text-sm text-text-leise">
            Kleinunternehmer nach §19 UStG — keine Umsatzsteuer.
          </p>
        )}
        <div className="mt-3 flex items-baseline justify-between border-t border-linie pt-3">
          <span className="font-titel text-lg font-bold tracking-tight">Gesamt</span>
          <span className="zahl text-xl font-semibold">
            {formatEuro(gestellt ? rechnung.brutto : brutto)}
          </span>
        </div>
      </section>

      {meldung ? <Meldung art={meldung.art}>{meldung.text}</Meldung> : null}

      {/* Aktionen ------------------------------------------------------------ */}
      <section className="sticky bottom-[calc(theme(spacing.navleiste)+env(safe-area-inset-bottom))] z-30 -mx-4 flex gap-2 border-t border-linie bg-papier/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:backdrop-blur-none">
        <a
          href={`/api/rechnungen/${rechnung.id}/pdf?download=1`}
          download={`${rechnung.nummer}.pdf`}
          aria-label="PDF herunterladen"
          title="PDF herunterladen"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-gross border border-linie bg-flaeche px-4 font-medium text-text transition-colors active:bg-papier"
        >
          <IconPdf className="h-5 w-5" />
        </a>

        {/* Nur für gestellte Rechnungen: ein Entwurf ist kein Beleg, den man
            aus der Hand gibt. */}
        {gestellt ? (
          <TeilenKnopf
            pfad={`/api/rechnungen/${rechnung.id}/pdf`}
            dateiname={`${rechnung.nummer}.pdf`}
            titel={`Rechnung ${rechnung.nummer}`}
            text={`Guten Tag,\n\nanbei unsere Rechnung${rechnung.titel ? ` für ${rechnung.titel}` : ""}.`}
          />
        ) : null}
        {gestellt ? (
          <a
            href={`/api/rechnungen/${rechnung.id}/erechnung`}
            download={`E-Rechnung-${rechnung.nummer}.xml`}
            className="inline-flex min-h-11 items-center justify-center rounded-gross border border-linie bg-flaeche px-4 font-medium text-text transition-colors active:bg-papier"
          >
            E-Rechnung
          </a>
        ) : null}

        {!gestellt ? (
          <Button variante="akzent" className="flex-1" disabled={pending} onClick={stellen}>
            <IconSenden className="h-5 w-5" />
            {pending
              ? "Einen Moment…"
              : versandMoeglich
                ? "Stellen und senden"
                : "Rechnung stellen"}
          </Button>
        ) : rechnung.status === "gestellt" ? (
          <>
            <Button variante="primaer" className="flex-1" disabled={pending} onClick={bezahlt}>
              Bezahlt
            </Button>
            <Button variante="sekundaer" disabled={pending} onClick={stornieren}>
              Stornieren
            </Button>
          </>
        ) : null}
      </section>
    </div>
  );
}

function Zeileninfo({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-sm text-text-leise">{label}</span>
      <span className="text-right font-medium">{wert}</span>
    </div>
  );
}

function PositionsKarte({
  nummer,
  zeile,
  onAendern,
  onEntfernen,
}: {
  nummer: number;
  zeile: Zeile;
  onAendern: (teil: Partial<Zeile>) => void;
  onEntfernen: () => void;
}) {
  const [preisText, setPreisText] = useState(formatPreisEingabe(zeile.einzelpreis));
  const [mengeText, setMengeText] = useState(formatMenge(zeile.menge));

  return (
    <article className="rounded-karte bg-flaeche p-3 shadow-karte">
      <div className="flex items-center gap-2">
        <span className="zahl w-4 shrink-0 text-sm text-text-leise">{nummer}</span>
        <input
          value={zeile.bezeichnung}
          onChange={(e) => onAendern({ bezeichnung: e.target.value })}
          aria-label={`Leistung Position ${nummer}`}
          placeholder="Leistung"
          className="min-h-11 min-w-0 flex-1 rounded-feld border border-linie bg-flaeche px-3 text-base text-text placeholder:text-text-leise/60 focus:border-text focus:outline-none"
        />
        <span className="zahl shrink-0 whitespace-nowrap text-[15px] font-medium">
          {formatEuro(runde(zeile.menge * zeile.einzelpreis))}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-[3.75rem_1fr_1fr_2.75rem] gap-2 pl-6">
        <input
          value={mengeText}
          onChange={(e) => {
            setMengeText(e.target.value);
            const wert = parsePreis(e.target.value);
            if (wert !== null) onAendern({ menge: wert });
          }}
          onBlur={() => setMengeText(formatMenge(zeile.menge))}
          inputMode="decimal"
          aria-label={`Menge Position ${nummer}`}
          className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche px-1 text-center text-base text-text focus:border-text focus:outline-none"
        />
        <select
          value={zeile.einheit}
          onChange={(e) => onAendern({ einheit: e.target.value as Einheit })}
          aria-label={`Einheit Position ${nummer}`}
          className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-1.5 text-base text-text focus:border-text focus:outline-none"
        >
          {(Object.keys(EINHEIT_LABEL) as Einheit[]).map((e) => (
            <option key={e} value={e}>
              {EINHEIT_LABEL[e]}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            value={preisText}
            onChange={(e) => {
              setPreisText(e.target.value);
              const wert = parsePreis(e.target.value);
              if (wert !== null) onAendern({ einzelpreis: wert });
            }}
            onBlur={() => setPreisText(formatPreisEingabe(zeile.einzelpreis))}
            inputMode="decimal"
            aria-label={`Einzelpreis Position ${nummer}`}
            className="zahl min-h-11 w-full rounded-feld border border-linie bg-flaeche pl-1.5 pr-5 text-right text-base text-text focus:border-text focus:outline-none"
          />
          <span className="zahl pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-sm text-text-leise">
            €
          </span>
        </div>
        <button
          type="button"
          onClick={onEntfernen}
          aria-label={`Position ${nummer} entfernen`}
          className="flex min-h-11 items-center justify-center rounded-feld text-text-leise transition-colors active:bg-warnung-flaeche active:text-warnung"
        >
          <IconKreuz className="h-5 w-5" />
        </button>
      </div>
    </article>
  );
}

function runde(n: number): number {
  return Math.round(n * 100) / 100;
}

function formatMenge(n: number): string {
  return String(n).replace(".", ",");
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
