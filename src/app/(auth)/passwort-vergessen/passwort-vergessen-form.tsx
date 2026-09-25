"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { passwortZuruecksetzen, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";

export function PasswortVergessenForm() {
  const [state, action] = useActionState<AuthState, FormData>(passwortZuruecksetzen, {});
  return <div className="flex flex-col gap-6">
    <div><h1 className="text-2xl">Passwort vergessen?</h1><p className="mt-1 text-text-leise">E-Mail eingeben und sicheren Reset-Link erhalten.</p></div>
    {state.hinweis ? <Meldung art="erfolg">{state.hinweis}</Meldung> :
      <form action={action} className="flex flex-col gap-4">
        <Input label="E-Mail" name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" required />
        {state.fehler ? <Meldung art="fehler">{state.fehler}</Meldung> : null}
        <Senden />
      </form>}
    <Link href="/login" className="text-center text-sm font-medium text-akzent underline underline-offset-2">Zurueck zur Anmeldung</Link>
  </div>;
}
function Senden(){const {pending}=useFormStatus();return <Button type="submit" vollbreit disabled={pending}>{pending?"Wird gesendet...":"Reset-Link senden"}</Button>}
