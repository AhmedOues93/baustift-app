"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import {
  einrichtungAbschliessen,
  einrichtungUeberspringen,
  type WillkommenState,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";
import { Schritte } from "@/components/ui/schritte";
import { parsePreis } from "@/lib/format";
import type { Profile } from "@/types/database";

/**
 * Einrichtung in drei Schritten — dieselbe Mechanik wie in den anderen
 * Formularen, aber bewusst kürzer: hier stehen nur die Felder, ohne die das
 * erste Angebot nicht funktioniert. Alles Weitere findet der Nutzer später
 * unter Konto.
 */
export function Einrichtung({ profil }: { profil: Profile }) {
  const [state, action] = useActionState<WillkommenState, FormData>(
    einrichtungAbschliessen,
    {},
  );

  return (
    <form action={action} className="rounded-karte bg-flaeche p-4 shadow-karte sm:p-6">
      <Schritte
        abschluss={<FertigButton />}
        schritte={[
          {
            titel: "Dein Betrieb",
            hinweis: "Das steht später im Briefkopf jedes Angebots.",
            pruefen: (fd) =>
              String(fd.get("firma_name") ?? "").trim()
                ? null
                : "Bitte den Namen des Betriebs eintragen.",
            inhalt: (
              <>
                <Input
                  label="Betrieb"
                  name="firma_name"
                  defaultValue={profil.firma_name}
                  placeholder="Mustermann Sanitär GmbH"
                />
                <Input
                  label="Inhaber"
                  name="inhaber_name"
                  defaultValue={profil.inhaber_name ?? ""}
                />
                <Input
                  label="Strasse und Nr."
                  name="strasse"
                  defaultValue={profil.strasse ?? ""}
                />
                <div className="grid grid-cols-[7rem_1fr] gap-3">
                  <Input label="PLZ" name="plz" zahl inputMode="numeric" defaultValue={profil.plz ?? ""} />
                  <Input label="Ort" name="ort" defaultValue={profil.ort ?? ""} />
                </div>
                <Input
                  label="Telefon"
                  name="telefon"
                  type="tel"
                  inputMode="tel"
                  defaultValue={profil.telefon ?? ""}
                />
              </>
            ),
          },
          {
            titel: "Steuer",
            hinweis: "Pflichtangaben auf jedem Angebot in Deutschland.",
            pruefen: (fd) => {
              const satz = parsePreis(String(fd.get("mwst_satz") ?? ""));
              return satz === null || satz > 100
                ? "Der MwSt-Satz muss eine Zahl zwischen 0 und 100 sein."
                : null;
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
                      Dann weist Baustift keine Umsatzsteuer aus.
                    </span>
                  </span>
                </label>

                <Input
                  label="MwSt-Satz"
                  name="mwst_satz"
                  zahl
                  suffix="%"
                  inputMode="decimal"
                  defaultValue={String(profil.mwst_satz).replace(".", ",")}
                />
                <Input label="Steuernummer" name="steuernummer" defaultValue={profil.steuernummer ?? ""} />
                <Input label="IBAN" name="iban" zahl defaultValue={profil.iban ?? ""} />
              </>
            ),
          },
          {
            titel: "Deine Preise",
            hinweis: "Der wichtigste Schritt — und der einzige, der wirklich Zeit spart.",
            inhalt: (
              <>
                <div className="rounded-feld bg-papier p-3 text-sm text-text-leise">
                  <p className="font-medium text-text">Warum das jetzt zählt</p>
                  <p className="mt-1">
                    Baustift ordnet deine Sprachnachricht diesen Preisen zu.
                    Ohne Preisliste entsteht zwar ein Angebot, aber jede
                    Position steht ohne Betrag da.
                  </p>
                </div>

                <Input
                  label="Preisliste aus Excel (CSV)"
                  name="preise"
                  type="file"
                  accept=".csv,text/csv"
                  className="file:mr-3 file:rounded-full file:border-0 file:bg-papier file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text"
                  hinweis="Spalten: Bezeichnung und Preis, optional Kategorie und Einheit. Du kannst Preise auch später von Hand anlegen."
                />

                {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
              </>
            ),
          },
        ]}
      />

      {/* Überspringen: klein und unten, erreichbar aber nicht der
          vorgeschlagene Weg. Als formAction im selben Formular — ein zweites
          <form> darf hier nicht stehen, Formulare lassen sich nicht
          verschachteln. */}
      <div className="mt-4 text-center">
        <button
          type="submit"
          formAction={einrichtungUeberspringen}
          formNoValidate
          className="min-h-11 px-3 text-sm font-medium text-text-leise underline underline-offset-2"
        >
          Später einrichten
        </button>
      </div>
    </form>
  );
}

function FertigButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Wird eingerichtet…" : "Fertig — erstes Angebot"}
    </Button>
  );
}
