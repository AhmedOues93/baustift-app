"use client";

import Image from "next/image";
import { useFormState, useFormStatus } from "react-dom";

import { firmendatenSpeichern, logoEntfernen, type FirmaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import type { Profile } from "@/types/database";

/**
 * Firmendaten-Formular.
 *
 * Gegliedert in drei Blöcke statt einer langen Liste: auf 390px sieht man
 * sonst nie, wo man gerade ist. Die Reihenfolge folgt dem PDF — Briefkopf,
 * Steuer, Bank —, damit klar ist, wozu jedes Feld dient.
 */
export function FirmendatenFormular({
  profil,
  logoUrl,
}: {
  profil: Profile;
  /** Signierte URL fürs aktuelle Logo, falls vorhanden. */
  logoUrl: string | null;
}) {
  const [state, action] = useFormState<FirmaState, FormData>(
    firmendatenSpeichern,
    {},
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <Block titel="Briefkopf" hinweis="Steht oben auf jedem Angebot.">
        <Input
          label="Betrieb"
          name="firma_name"
          required
          defaultValue={profil.firma_name}
        />
        <Input
          label="Inhaber"
          name="inhaber_name"
          defaultValue={profil.inhaber_name ?? ""}
        />
        <Input label="Strasse und Nr." name="strasse" defaultValue={profil.strasse ?? ""} />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Input label="PLZ" name="plz" inputMode="numeric" zahl defaultValue={profil.plz ?? ""} />
          <Input label="Ort" name="ort" defaultValue={profil.ort ?? ""} />
        </div>
        <Input label="Telefon" name="telefon" type="tel" inputMode="tel" defaultValue={profil.telefon ?? ""} />
        <Input label="E-Mail" name="email" type="email" inputMode="email" autoCapitalize="none" defaultValue={profil.email ?? ""} />
        <Input label="Website" name="website" defaultValue={profil.website ?? ""} />
      </Block>

      <Block
        titel="Logo"
        hinweis="PNG, JPG oder WebP, höchstens 2 MB. Erscheint oben rechts im PDF."
      >
        {logoUrl ? (
          <div className="flex items-center gap-4">
            <span className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-feld border border-linie bg-flaeche">
              {/* unoptimized: die signierte URL läuft ab, Next darf sie nicht
                  in seinen Bild-Cache legen. */}
              <Image
                src={logoUrl}
                alt="Aktuelles Logo"
                width={128}
                height={80}
                unoptimized
                className="max-h-20 w-auto object-contain"
              />
            </span>
            <button
              type="button"
              onClick={() => logoEntfernen()}
              className="min-h-11 rounded-feld px-3 text-sm font-medium text-warnung transition-colors active:bg-warnung-flaeche"
            >
              Entfernen
            </button>
          </div>
        ) : null}

        <Input
          label={logoUrl ? "Logo ersetzen" : "Logo hochladen"}
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="file:mr-3 file:rounded-full file:border-0 file:bg-papier file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text"
        />
      </Block>

      <Block
        titel="Steuer und Bank"
        hinweis="Pflichtangaben auf Angeboten und Rechnungen in Deutschland."
      >
        <label className="flex min-h-11 items-start gap-3 rounded-feld bg-papier p-3">
          <input
            type="checkbox"
            name="kleinunternehmer"
            defaultChecked={profil.kleinunternehmer}
            className="mt-0.5 h-5 w-5 shrink-0 accent-akzent"
          />
          <span className="text-sm">
            <span className="font-medium">Kleinunternehmer nach §19 UStG</span>
            <span className="mt-0.5 block text-text-leise">
              Dann wird keine Umsatzsteuer ausgewiesen und der gesetzliche
              Hinweis erscheint automatisch im PDF.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="MwSt-Satz"
            name="mwst_satz"
            zahl
            suffix="%"
            inputMode="decimal"
            defaultValue={String(profil.mwst_satz).replace(".", ",")}
          />
          <Input
            label="Angebot gültig"
            name="angebot_gueltig_tage"
            zahl
            suffix="Tage"
            inputMode="numeric"
            defaultValue={String(profil.angebot_gueltig_tage)}
          />
        </div>

        <Input label="Steuernummer" name="steuernummer" defaultValue={profil.steuernummer ?? ""} />
        <Input label="USt-IdNr." name="ust_id" defaultValue={profil.ust_id ?? ""} />
        <Input label="IBAN" name="iban" zahl defaultValue={profil.iban ?? ""} />
        <Input label="BIC" name="bic" zahl defaultValue={profil.bic ?? ""} />
        <Input label="Bank" name="bank_name" defaultValue={profil.bank_name ?? ""} />
      </Block>

      {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
      {state.erfolg ? <Meldung art="erfolg">{state.erfolg}</Meldung> : null}

      <SpeichernButton />
    </form>
  );
}

function Block({
  titel,
  hinweis,
  children,
}: {
  titel: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-karte bg-flaeche p-4 shadow-karte sm:p-5">
      <h2 className="text-lg">{titel}</h2>
      {hinweis ? <p className="mt-1 text-sm text-text-leise">{hinweis}</p> : null}
      <div className="mt-4 flex flex-col gap-4">{children}</div>
    </section>
  );
}

function SpeichernButton() {
  const { pending } = useFormStatus();
  return (
    // sticky: bei 15 Feldern ist der Button sonst immer ausserhalb des Bilds.
    <div className="sticky bottom-[calc(theme(spacing.navleiste)+env(safe-area-inset-bottom))] -mx-4 bg-papier px-4 py-3 lg:static lg:mx-0 lg:bg-transparent lg:px-0">
      <Button type="submit" vollbreit disabled={pending}>
        {pending ? "Speichern…" : "Firmendaten speichern"}
      </Button>
    </div>
  );
}
