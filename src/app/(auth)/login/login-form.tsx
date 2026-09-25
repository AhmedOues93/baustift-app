"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { GoogleButton } from "../google-button";
import { anmelden, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";

export function LoginForm({ weiter }: { weiter: string }) {
  // useActionState hält das Ergebnis der Server Action zwischen den Aufrufen.
  const [state, action] = useActionState<AuthState, FormData>(anmelden, {});

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">Anmelden</h1>
        <p className="mt-1 text-text-leise">Weiter zu deinen Angeboten.</p>
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

        <div className="flex justify-end">
          <Link
            href="/passwort-vergessen"
            className="min-h-11 py-3 text-sm font-medium text-akzent underline underline-offset-2"
          >
            Passwort vergessen?
          </Link>
        </div>

        <AbsendenButton />
      </form>

      <Trenner />
      <GoogleButton weiter={weiter} />

      <p className="text-center text-sm text-text-leise">
        Noch kein Konto?{" "}
        <Link
          href="/signup"
          // inline-block + py: der Link erreicht 44px Tapp-Höhe, ohne den Satz zu sprengen
          className="inline-block py-3.5 font-medium text-akzent underline underline-offset-2"
        >
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
      <span className="h-px flex-1 bg-linie" />
      <span className="text-xs uppercase tracking-wide text-text-leise">
        oder
      </span>
      <span className="h-px flex-1 bg-linie" />
    </div>
  );
}
