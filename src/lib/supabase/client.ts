"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase-Client für Client Components (Browser).
 * Nutzt den anon key — der ist öffentlich und ungefährlich, weil RLS in der
 * Datenbank den Zugriff regelt.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
