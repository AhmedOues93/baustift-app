/**
 * Zentraler, geprüfter Zugriff auf die Umgebungsvariablen.
 *
 * Warum nicht einfach `process.env.X` überall?
 *  - Ein Tippfehler fällt erst zur Laufzeit auf (`undefined` im API-Call).
 *  - Hier knallt es sofort mit einer klaren Meldung, welcher Key fehlt.
 *
 * WICHTIG: Nur `NEXT_PUBLIC_*` darf im Browser landen. Alle anderen Keys
 * (Anthropic, OpenAI, Stripe, Service-Role) werden ausschliesslich in Server
 * Components, Route Handlers oder Server Actions gelesen.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Fehlende Umgebungsvariable: ${name}. Siehe .env.example und trage sie in .env.local ein.`,
    );
  }
  return value;
}

/** Im Browser UND auf dem Server verfügbar. */
export const publicEnv = {
  supabaseUrl: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  supabaseAnonKey: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};

/**
 * Nur auf dem Server. Als Funktion (nicht als Objekt-Konstante), damit der
 * Zugriff — und damit die Pflichtprüfung — erst beim tatsächlichen Aufruf
 * passiert und nicht schon beim Import im Build.
 */
export function serverEnv() {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() darf niemals im Browser aufgerufen werden.");
  }

  return {
    anthropicApiKey: required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY),
    openaiApiKey: required("OPENAI_API_KEY", process.env.OPENAI_API_KEY),
    supabaseServiceRoleKey: required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    stripeSecretKey: required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
    stripeWebhookSecret: required(
      "STRIPE_WEBHOOK_SECRET",
      process.env.STRIPE_WEBHOOK_SECRET,
    ),
    stripePriceId: required("STRIPE_PRICE_ID", process.env.STRIPE_PRICE_ID),
  };
}
