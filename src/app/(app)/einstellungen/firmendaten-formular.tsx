"use client";

import Image from "next/image";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { firmendatenSpeichern, logoEntfernen, type FirmaState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { Schritte } from "@/components/ui/schritte";
import { parsePreis } from "@/lib/format";
import type { Profile } from "@/types/database";

/**
 * Firmendaten in drei Schritten statt als lange Rolle.
 *
 * Fünfzehn Felder am Stück sind auf dem Handy fast drei Bildschirme; in der
 * Reihenfolge des PDF gruppiert — Briefkopf, Logo, Steuer und Bank — passt
 * jeder Schritt auf einen Bildschirm, und man sieht, wie weit man ist.
 */
export function FirmendatenFormular({
  profil,
  logoUrl,
}: {
  profil: Profile;
  /** Signierte URL fürs aktuelle Logo, falls vorhanden. */
  logoUrl: string | null;
}) {
  const [state, action] = useActionState<FirmaState, FormData>(
    firmendatenSpeichern,
    {},
  );

  return (
    <form action={action} className="rounded-karte bg-flaeche p-4 shadow-karte sm:p-5">
      <Schritte
        abschluss={<SpeichernButton />}
        schritte={[
          {
            titel: "Briefkopf",
            hinweis: "Steht oben auf jedem Angebot.",
            pruefen: (fd) =>
              String(fd.get("firma_name") ?? "").trim()
                ? null
                : "Bitte den Namen des Betriebs eintragen.",
            inhalt: (
              <>
                <Input label="Betrieb" name="firma_name" defaultValue={profil.firma_name} />
                <Input label="Inhaber" name="inhaber_name" defaultValue={profil.inhaber_name ?? ""} />
                <Input label="Strasse und Nr." name="strasse" defaultValue={profil.strasse ?? ""} />
                <div className="grid grid-cols-[7rem_1fr] gap-3">
                  <Input label="PLZ" name="plz" inputMode="numeric" zahl defaultValue={profil.plz ?? ""} />
                  <Input label="Ort" name="ort" defaultValue={profil.ort ?? ""} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Telefon" name="telefon" type="tel" inputMode="tel" defaultValue={profil.telefon ?? ""} />
                  <Input label="E-Mail" name="email" type="email" inputMode="email" autoCapitalize="none" defaultValue={profil.email ?? ""} />
                </div>
                <Input label="Website" name="website" defaultValue={profil.website ?? ""} />
              </>
            ),
          },
          {
            titel: "Logo",
            hinweis: "PNG, JPG oder WebP, höchstens 2 MB. Erscheint oben rechts im PDF.",
            inhalt: (
              <>
                {logoUrl ? (
                  <div className="flex items-center gap-4">
                    <span className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-feld border border-linie bg-flaeche">
                      {/* unoptimized: die signierte URL läuft ab, Next darf sie
                          nicht in seinen Bild-Cache legen. */}
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
                  hinweis="Ohne Logo steht stattdessen der Name des Betriebs im Briefkopf."
                />
              </>
            ),
          },
          {
            titel: "Steuer und Bank",
            hinweis: "Pflichtangaben auf Angeboten und Rechnungen in Deutschland.",
            pruefen: (fd) => {
              const satz = parsePreis(String(fd.get("mwst_satz") ?? ""));
              if (satz === null || satz > 100) {
                return "Der MwSt-Satz muss eine Zahl zwischen 0 und 100 sein.";
              }
              return null;
            },
            inhalt: (
              <>
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
                      Dann wird keine Umsatzsteuer ausgewiesen und der
                      gesetzliche Hinweis erscheint automatisch im PDF.
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

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Steuernummer" name="steuernummer" defaultValue={profil.steuernummer ?? ""} />
                  <Input label="USt-IdNr." name="ust_id" defaultValue={profil.ust_id ?? ""} />
                </div>
                <Input label="IBAN" name="iban" zahl defaultValue={profil.iban ?? ""} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="BIC" name="bic" zahl defaultValue={profil.bic ?? ""} />
                  <Input label="Bank" name="bank_name" defaultValue={profil.bank_name ?? ""} />
                </div>

                {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
                {state.erfolg ? <Meldung art="erfolg">{state.erfolg}</Meldung> : null}
              </>
            ),
          },
        ]}
      />
    </form>
  );
}

function SpeichernButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Speichern…" : "Speichern"}
    </Button>
  );
}
