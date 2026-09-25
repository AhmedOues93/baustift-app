"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { passwortAendern } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Meldung } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useState } from "react";

/**
 * Passwort ändern.
 *
 * Bisher ging das nur über "Passwort vergessen" und eine E-Mail — also über
 * einen Umweg, der ein Postfach und Netz voraussetzt. Wer sein Passwort
 * wechseln will, weil er es jemandem gezeigt hat, will das sofort tun.
 */
export function PasswortBereich() {
  const [offen, setOffen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOffen(true)}
        className="flex min-h-14 w-full items-center justify-between gap-3 rounded-karte bg-flaeche p-4 text-left shadow-karte transition-colors active:bg-papier"
      >
        <span>
          <span className="block font-medium text-text">Passwort ändern</span>
          <span className="block text-sm text-text-leise">
            Bisheriges Passwort wird abgefragt
          </span>
        </span>
      </button>

      {offen ? <PasswortSheet onSchliessen={() => setOffen(false)} /> : null}
    </>
  );
}

function PasswortSheet({ onSchliessen }: { onSchliessen: () => void }) {
  const [state, action] = useActionState(passwortAendern, {});

  return (
    <Sheet titel="Passwort ändern" onSchliessen={onSchliessen}>
      <form action={action} className="mt-4 flex flex-col gap-3">
        <Feld
          label="Bisheriges Passwort"
          name="passwort_alt"
          autoComplete="current-password"
        />
        <Feld
          label="Neues Passwort"
          name="passwort"
          autoComplete="new-password"
          hinweis="Mindestens 8 Zeichen"
        />
        <Feld
          label="Neues Passwort wiederholen"
          name="passwort_bestaetigen"
          autoComplete="new-password"
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
        {state.hinweis ? <Meldung art="erfolg">{state.hinweis}</Meldung> : null}

        <div className="mt-2 flex flex-col gap-2">
          <Speichern />
          <Button variante="sekundaer" type="button" onClick={onSchliessen}>
            {state.hinweis ? "Schliessen" : "Abbrechen"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function Feld({
  label,
  name,
  autoComplete,
  hinweis,
}: {
  label: string;
  name: string;
  autoComplete: string;
  hinweis?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-text-leise">{label}</span>
      <input
        type="password"
        name={name}
        autoComplete={autoComplete}
        className="min-h-11 w-full rounded-feld border border-linie bg-flaeche px-3 text-base text-text focus:border-text focus:outline-none"
      />
      {hinweis ? <span className="text-xs text-text-leise">{hinweis}</span> : null}
    </label>
  );
}

function Speichern() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" vollbreit disabled={pending}>
      {pending ? "Wird geändert…" : "Passwort ändern"}
    </Button>
  );
}
