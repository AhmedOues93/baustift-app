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

  const supabase = createClient();
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

  const supabase = createClient();
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

export async function abmelden() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
