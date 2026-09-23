"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { GoogleButton } from "../google-button";
import { anmelden, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";

export function LoginForm({ weiter }: { weiter: string }) {
  // useFormState (React 18 / Next 14) hält das Ergebnis der Server Action.
  const [state, action] = useFormState<AuthState, FormData>(anmelden, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Anmelden</h1>
        <p className="mt-1 text-slate-600">Weiter zu deinen Angeboten.</p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="weiter" value={weiter} />

        <Input
          label="E-Mail"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          placeholder="name@betrieb.de"
        />
        <Input
          label="Passwort"
          name="passwort"
          type="password"
          autoComplete="current-password"
          required
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

        <AbsendenButton />
      </form>

      <Trenner />
      <GoogleButton weiter={weiter} />

      <p className="text-center text-sm text-slate-600">
        Noch kein Konto?{" "}
        <Link href="/signup" className="font-medium text-brand-700 underline">
          Jetzt registrieren
        </Link>
      </p>
    </div>
  );
}

function AbsendenButton() {
  // useFormStatus kennt den Zustand des umgebenden <form> — deshalb muss es in
  // einer eigenen Komponente stehen, nicht im Formular selbst.
  const { pending } = useFormStatus();
  return (
    <Button type="submit" vollbreit disabled={pending}>
      {pending ? "Anmelden…" : "Anmelden"}
    </Button>
  );
}

export function Trenner() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-slate-200" />
      <span className="text-xs uppercase tracking-wide text-slate-500">
        oder
      </span>
      <span className="h-px flex-1 bg-slate-200" />
    </div>
  );
}
