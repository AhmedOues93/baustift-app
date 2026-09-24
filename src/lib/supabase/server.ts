import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Supabase-Client für Server Components, Server Actions und Route Handlers.
 *
 * Die Session steckt in Cookies. `@supabase/ssr` liest sie hier heraus und
 * schreibt erneuerte Tokens zurück — deshalb der cookies()-Adapter.
 */
export async function createClient() {
  // Seit Next 15 ist cookies() asynchron.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // In Server Components sind Cookies read-only. Das ist ok, solange
            // die Middleware das Token-Refresh übernimmt (siehe middleware.ts).
          }
        },
      },
    },
  );
}

/**
 * Client mit Service-Role-Key: umgeht RLS komplett.
 *
 * NUR für Server-seitige Vorgänge ohne Nutzer-Session verwenden — z. B. den
 * Stripe-Webhook, der ein Abo aktualisiert. Niemals in einer Route, deren
 * user_id aus dem Request-Body kommt: damit wäre die ganze Mandantentrennung hin.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv().supabaseServiceRoleKey,
    {
      cookies: { getAll: () => [], setAll: () => {} },
    },
  );
}
