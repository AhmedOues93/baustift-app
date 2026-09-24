"use client";

import { useFormState, useFormStatus } from "react-dom";
import { passwortAktualisieren, type AuthState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input, Meldung } from "@/components/ui/field";

export function PasswortNeuForm(){
 const [state,action]=useFormState<AuthState,FormData>(passwortAktualisieren,{});
 return <div className="flex flex-col gap-6">
  <div><h1 className="text-2xl">Neues Passwort</h1><p className="mt-1 text-text-leise">Mindestens 8 Zeichen.</p></div>
  <form action={action} className="flex flex-col gap-4">
   <Input label="Neues Passwort" name="passwort" type="password" autoComplete="new-password" minLength={8} required />
   <Input label="Passwort wiederholen" name="passwort_bestaetigen" type="password" autoComplete="new-password" minLength={8} required />
   {state.fehler?<Meldung art="fehler">{state.fehler}</Meldung>:null}<Speichern/>
  </form>
 </div>
}
function Speichern(){const {pending}=useFormStatus();return <Button type="submit" vollbreit disabled={pending}>{pending?"Wird gespeichert...":"Passwort speichern"}</Button>}
