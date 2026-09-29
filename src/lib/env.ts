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

/**
 * Im Browser UND auf dem Server verfügbar.
 *
 * Als Getter, nicht als feste Werte: sonst würde die Prüfung schon beim Import
 * laufen und `next build` scheitern, bevor überhaupt jemand die App startet
 * (im Build-Container gibt es keine Keys). So knallt es erst, wenn der Wert
 * wirklich gebraucht wird.
 *
 * Die `process.env.NEXT_PUBLIC_*` müssen dabei wörtlich dastehen — nur so
 * ersetzt sie der Next-Build im Browser-Bundle durch den echten Wert.
 */
export const publicEnv = {
  get supabaseUrl() {
    return required(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );
  },
  get supabaseAnonKey() {
    return required(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
  },
  /**
   * Die eigene Adresse. Klingt nebensächlich, ist es nicht: daraus baut sich
   * der Bestätigungslink in der Registrierungs-E-Mail, der Link zum
   * Passwort-Zurücksetzen und die Rücksprungadresse von Stripe.
   *
   * Steht sie in Produktion nicht, zeigen diese Links auf localhost — und
   * niemand kann sich anmelden. Vorher fiel das nicht auf, weil einfach
   * stillschweigend "http://localhost:3000" eingesetzt wurde. Also: in
   * Produktion lieber sofort und laut scheitern als leise falsch verlinken.
   */
  get siteUrl() {
    const gesetzt = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (gesetzt) return gesetzt.replace(/\/+$/, "");

    // Vercel kennt seine Adresse selbst — für Vorschau-Bereitstellungen reicht das.
    const vercel = process.env.NEXT_PUBLIC_VERCEL_URL?.trim();
    if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;

    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "Fehlende Umgebungsvariable: NEXT_PUBLIC_SITE_URL. Ohne sie zeigen " +
          "Bestätigungs- und Passwortlinks auf localhost. Eintragen als " +
          "vollständige Adresse, z. B. https://baustift.de",
      );
    }
    return "http://localhost:3000";
  },
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

  // Jede Integration prüft nur ihre eigenen Schlüssel beim Zugriff.
  return {
    get anthropicApiKey() {
      return required("ANTHROPIC_API_KEY", process.env.ANTHROPIC_API_KEY);
    },
    get openaiApiKey() {
      return required("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
    },
    get supabaseServiceRoleKey() {
      return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
    },
    get stripeSecretKey() {
      return required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY);
    },
    get stripeWebhookSecret() {
      return required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET);
    },
    get stripePriceId() {
      return required("STRIPE_PRICE_ID", process.env.STRIPE_PRICE_ID);
    },
  };
}
