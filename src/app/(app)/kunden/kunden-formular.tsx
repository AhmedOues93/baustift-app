"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { kundeAendern, kundeAnlegen, kundeLoeschen, type KundeState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung, Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import type { Kunde } from "@/types/database";

export function KundenFormular({
  kunde,
  onSchliessen,
  onAngelegt,
}: {
  kunde?: Kunde;
  onSchliessen: () => void;
  /** Wird beim Anlegen aus dem Angebotsdialog heraus gebraucht. */
  onAngelegt?: (kunde: Kunde) => void;
}) {
  const bearbeiten = Boolean(kunde);
  const [state, action] = useFormState<KundeState, FormData>(
    bearbeiten ? kundeAendern : kundeAnlegen,
    {},
  );

  useEffect(() => {
    if (!state.erfolg) return;
    if (state.kunde && onAngelegt) onAngelegt(state.kunde);
    onSchliessen();
  }, [state.erfolg, state.kunde, onAngelegt, onSchliessen]);

  return (
    <Sheet
      titel={bearbeiten ? "Kunde bearbeiten" : "Neuer Kunde"}
      onSchliessen={onSchliessen}
      fuss={
        kunde ? (
          <form
            action={kundeLoeschen}
            onSubmit={(e) => {
              if (!confirm(`„${kunde.name}" wirklich löschen?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={kunde.id} />
            <button
              type="submit"
              className="min-h-11 w-full rounded-feld text-sm font-medium text-warnung transition-colors active:bg-warnung-flaeche"
            >
              Diesen Kunden löschen
            </button>
          </form>
        ) : null
      }
    >
      <form action={action} className="mt-4 flex flex-col gap-4">
        {kunde ? <input type="hidden" name="id" value={kunde.id} /> : null}

        <Input
          label="Name"
          name="name"
          required
          defaultValue={kunde?.name}
          placeholder="Familie Becker"
          hinweis="Firma oder Privatperson — so steht es später im Angebot."
        />
        <Input
          label="Ansprechpartner"
          name="ansprechpartner"
          defaultValue={kunde?.ansprechpartner ?? ""}
        />
        <Input
          label="Strasse und Nr."
          name="strasse"
          defaultValue={kunde?.strasse ?? ""}
          placeholder="Lindenstr. 12"
        />
        <div className="grid grid-cols-[7rem_1fr] gap-3">
          <Input label="PLZ" name="plz" zahl inputMode="numeric" defaultValue={kunde?.plz ?? ""} />
          <Input label="Ort" name="ort" defaultValue={kunde?.ort ?? ""} />
        </div>
        <Input
          label="E-Mail"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          defaultValue={kunde?.email ?? ""}
          hinweis="Zum Versenden des Angebots."
        />
        <Input
          label="Telefon"
          name="telefon"
          type="tel"
          inputMode="tel"
          defaultValue={kunde?.telefon ?? ""}
        />
        <Textarea label="Notizen" name="notizen" defaultValue={kunde?.notizen ?? ""} />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

        <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variante="sekundaer" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <SpeichernButton bearbeiten={bearbeiten} />
        </div>
      </form>
    </Sheet>
  );
}

function SpeichernButton({ bearbeiten }: { bearbeiten: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Speichern…" : bearbeiten ? "Speichern" : "Anlegen"}
    </Button>
  );
}
