/** @type {import('next').NextConfig} */

/**
 * Sicherheits-Kopfzeilen.
 *
 * Bis hierher hat der Browser bei jedem Aufruf ungeschützt geliefert, was er
 * bekam. Für ein Produkt, in dem Kundendaten und Bankverbindungen stehen, ist
 * das zu wenig — und keiner dieser Header kostet etwas ausser einmal
 * Nachdenken.
 *
 * ZUM INHALT DER EINZELNEN ZEILEN:
 *
 *  - Permissions-Policy erlaubt das Mikrofon AUSDRÜCKLICH für die eigene
 *    Seite. Ohne diese Ausnahme wäre das halbe Produkt tot: Diktat und
 *    Aufmass laufen über getUserMedia. Kamera und Standort bleiben zu, weil
 *    Baustift beides nicht braucht.
 *  - frame-ancestors 'none' und X-Frame-Options verhindern, dass jemand die
 *    Anwendung in einen Rahmen setzt und Klicks abfängt.
 *  - HSTS gilt erst, wenn die Seite unter https läuft; lokal schadet es
 *    nicht, weil Browser es für localhost ignorieren.
 *
 * ZUR CSP, EHRLICH: 'unsafe-inline' für Skripte steht darin, weil Next seine
 * Daten als Inline-Skript übergibt. Eine strenge Fassung bräuchte Nonces und
 * damit einen Umbau der Middleware. Was die Regel trotzdem leistet: ein
 * fremdes Skript von einem fremden Host kommt nicht durch, und das ist der
 * Weg, den eine eingeschleppte Abhängigkeit nehmen würde.
 */
function inhaltsRegeln() {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  // Supabase spricht auch über WebSocket; beides muss erlaubt sein.
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    // data: für das Firmenlogo im PDF-Vorschau-Pfad, blob: für die Aufnahme.
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabase} ${supabaseWs} https://api.stripe.com`.trim(),
    "worker-src 'self'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const KOPFZEILEN = [
  { key: "Content-Security-Policy", value: inhaltsRegeln() },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig = {
  reactStrictMode: true,

  // Verrät sonst in jeder Antwort, womit die Seite gebaut ist.
  poweredByHeader: false,

  // @react-pdf/renderer und die Server-SDKs (Anthropic/OpenAI) müssen im
  // Node-Runtime laufen und dürfen nicht ins Client-Bundle gebündelt werden.
  // Seit Next 15 heisst der Schalter so; unter experimental wird er ignoriert.
  serverExternalPackages: ["@react-pdf/renderer"],

  async headers() {
    return [{ source: "/:pfad*", headers: KOPFZEILEN }];
  },
};

export default nextConfig;
