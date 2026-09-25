"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-Server-Actions.
 *
 * Warum Server Actions und nicht der Browser-Client? Beim Login auf dem Server
 * setzt Supabase die Session direkt als httpOnly-Cookie. Damit ist die Session
 * für JavaScript unerreichbar (kein XSS-Diebstahl) und die Middleware kann
 * geschützte Seiten sofort beim ersten Request prüfen.
 *
 * Rückgabewert-Konvention: `{ fehler }` für Formularfehler (useActionState im
 * Client zeigt sie an). Bei Erfolg wird umgeleitet — `redirect()` wirft
 * intern, danach läuft nichts mehr.
 */

export interface AuthState {
  fehler?: string;
  hinweis?: string;
}

/** Fehlermeldungen von Supabase auf verständliches Deutsch bringen. */
function uebersetzeFehler(nachricht: string): string {
  const m = nachricht.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "E-Mail oder Passwort stimmt nicht.";
  if (m.includes("email not confirmed"))
    return "Bitte bestätige zuerst den Link in deiner E-Mail.";
  if (m.includes("user already registered"))
    return "Für diese E-Mail gibt es schon ein Konto. Melde dich einfach an.";
  if (m.includes("password should be at least"))
    return "Das Passwort muss mindestens 8 Zeichen haben.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Zu viele Versuche. Bitte warte einen Moment.";
  return "Das hat nicht geklappt. Bitte versuche es noch einmal.";
}

export async function anmelden(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const passwort = String(formData.get("passwort") ?? "");
  const weiter = String(formData.get("weiter") ?? "/angebote");

  if (!email || !passwort) {
    return { fehler: "Bitte E-Mail und Passwort eingeben." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: passwort,
  });

  if (error) return { fehler: uebersetzeFehler(error.message) };

  // Layout neu rendern, damit der eingeloggte Zustand überall greift.
  revalidatePath("/", "layout");
  // Offene Weiterleitung verhindern: nur app-interne Pfade zulassen.
  redirect(weiter.startsWith("/") ? weiter : "/angebote");
}

export async function registrieren(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const passwort = String(formData.get("passwort") ?? "");
  const firma = String(formData.get("firma_name") ?? "").trim();

  if (!email || !passwort) {
    return { fehler: "Bitte E-Mail und Passwort eingeben." };
  }
  if (passwort.length < 8) {
    return { fehler: "Das Passwort muss mindestens 8 Zeichen haben." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: passwort,
    options: {
      // Landet in auth.users.raw_user_meta_data und wird vom DB-Trigger
      // handle_new_user() ins Profil übernommen (siehe 0001_init.sql).
      data: { firma_name: firma },
      emailRedirectTo: `${publicEnv.siteUrl}/auth/callback`,
    },
  });

  if (error) return { fehler: uebersetzeFehler(error.message) };

  // Ist "Confirm email" im Supabase-Projekt aktiv, gibt es noch keine Session:
  // der Nutzer muss erst den Link in der Mail klicken.
  if (!data.session) {
    return {
      hinweis:
        "Fast geschafft: Wir haben dir einen Bestätigungslink geschickt. Öffne ihn, dann geht es weiter.",
    };
  }

  revalidatePath("/", "layout");
  // Frisch registriert: erst einrichten, dann arbeiten.
  redirect("/willkommen");
}

export async function passwortZuruecksetzen(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) return { fehler: "Bitte deine E-Mail-Adresse eingeben." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${publicEnv.siteUrl}/auth/callback?weiter=/passwort-neu`,
  });

  if (error) return { fehler: uebersetzeFehler(error.message) };

  return {
    hinweis:
      "Wir haben dir einen Link zum Zuruecksetzen geschickt. Bitte pruefe dein E-Mail-Postfach.",
  };
}

export async function passwortAktualisieren(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const passwort = String(formData.get("passwort") ?? "");
  const bestaetigung = String(formData.get("passwort_bestaetigen") ?? "");

  if (passwort.length < 8)
    return { fehler: "Das Passwort muss mindestens 8 Zeichen haben." };
  if (passwort !== bestaetigung)
    return { fehler: "Die beiden Passwoerter stimmen nicht ueberein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: passwort });
  if (error) return { fehler: uebersetzeFehler(error.message) };

  revalidatePath("/", "layout");
  redirect("/angebote");
}

export async function abmelden() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Passwort im laufenden Betrieb ändern.
 *
 * Unterscheidet sich von `passwortAktualisieren` in einem Punkt, und der ist
 * der wichtige: hier wird das ALTE Passwort verlangt. Sonst könnte jeder, der
 * ein offenes Telefon in die Hand bekommt — auf einer Baustelle keine
 * Seltenheit —, in zehn Sekunden das Konto übernehmen.
 *
 * Geprüft wird es, indem wir uns damit anmelden. Supabase hat dafür keinen
 * eigenen Aufruf; ein fehlgeschlagener Anmeldeversuch ist die ehrlichste
 * Prüfung und ändert an der laufenden Sitzung nichts.
 */
export async function passwortAendern(
  _state: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const alt = String(formData.get("passwort_alt") ?? "");
  const neu = String(formData.get("passwort") ?? "");
  const bestaetigung = String(formData.get("passwort_bestaetigen") ?? "");

  if (neu.length < 8)
    return { fehler: "Das neue Passwort muss mindestens 8 Zeichen haben." };
  if (neu !== bestaetigung)
    return { fehler: "Die beiden Passwörter stimmen nicht überein." };
  if (neu === alt)
    return { fehler: "Das neue Passwort ist dasselbe wie das alte." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { fehler: "Bitte neu anmelden." };

  const { error: pruefung } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: alt,
  });
  if (pruefung) return { fehler: "Das bisherige Passwort stimmt nicht." };

  const { error } = await supabase.auth.updateUser({ password: neu });
  if (error) return { fehler: uebersetzeFehler(error.message) };

  revalidatePath("/einstellungen");
  return { hinweis: "Passwort geändert." };
}
