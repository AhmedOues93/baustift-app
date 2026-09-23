"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import { GoogleButton } from "../google-button";
import { Trenner } from "../login/login-form";
import { registrieren, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";

export function SignupForm() {
  const [state, action] = useFormState<AuthState, FormData>(registrieren, {});

  // Nach erfolgreicher Registrierung mit E-Mail-Bestätigung gibt es keine
  // Session — dann nur den Hinweis zeigen, nicht das Formular.
  if (state.hinweis) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">E-Mail bestätigen</h1>
        <Meldung art="erfolg">{state.hinweis}</Meldung>
        <Link href="/login" className="text-sm font-medium text-brand-700 underline">
          Zurück zur Anmeldung
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Konto anlegen</h1>
        <p className="mt-1 text-slate-600">
          In zwei Minuten zum ersten Angebot.
        </p>
      </div>

      <form action={action} className="flex flex-col gap-4">
        <Input
          label="Betrieb"
          name="firma_name"
          autoComplete="organization"
          placeholder="Mustermann Sanitär GmbH"
          hinweis="Steht später im Briefkopf deiner Angebote. Kannst du jederzeit ändern."
        />
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
          autoComplete="new-password"
          required
          minLength={8}
          hinweis="Mindestens 8 Zeichen."
        />

        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}

        <AbsendenButton />
      </form>

      <Trenner />
      <GoogleButton />

      <p className="text-center text-sm text-slate-600">
        Schon registriert?{" "}
        <Link href="/login" className="font-medium text-brand-700 underline">
          Anmelden
        </Link>
      </p>
    </div>
  );
}

function AbsendenButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" vollbreit disabled={pending}>
      {pending ? "Konto wird angelegt…" : "Kostenlos starten"}
    </Button>
  );
}
