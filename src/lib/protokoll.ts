import "server-only";

/**
 * Fehlerprotokoll.
 *
 * Bisher standen an sechs Stellen `console.error`-Aufrufe. Die landen in den
 * Logs des Hosters, wo sie niemand liest — wenn bei einem Testbetrieb die
 * Angebotserstellung scheitert, erfährt man es frühestens beim nächsten
 * Telefonat.
 *
 * Hier gibt es dafür eine Stelle mit drei Eigenschaften:
 *
 *  1. **Strukturiert.** Eine Zeile JSON pro Ereignis statt freiem Text —
 *     damit lässt sich später filtern und zählen, egal wohin es geht.
 *  2. **Ohne Inhalte.** Protokolliert werden Vorgang, Fehlertyp und die
 *     User-ID, niemals Transkripte, Kundennamen oder Beträge. Ein Logfile
 *     ist kein Ort für die Daten Dritter — und im Zweifel liest es ein
 *     Dienstleister mit.
 *  3. **Optional weiterleitbar.** Ist SENTRY_DSN gesetzt, geht dieselbe
 *     Meldung zusätzlich dorthin. Ohne die Variable läuft alles normal
 *     weiter; eine fehlende Umgebungsvariable darf kein Feature abschalten.
 */

type Schwere = "fehler" | "warnung";

interface Ereignis {
  /** Was wurde versucht, z. B. "angebot.extraktion". */
  vorgang: string;
  schwere: Schwere;
  userId?: string;
  /** Zusatzangaben — nur Kennzahlen und IDs, niemals Inhalte. */
  details?: Record<string, string | number | boolean | null>;
}

export function protokolliereFehler(
  ereignis: Omit<Ereignis, "schwere">,
  fehler: unknown,
): void {
  schreibe({ ...ereignis, schwere: "fehler" }, fehler);
}

export function protokolliereWarnung(
  ereignis: Omit<Ereignis, "schwere">,
  fehler?: unknown,
): void {
  schreibe({ ...ereignis, schwere: "warnung" }, fehler);
}

function schreibe(ereignis: Ereignis, fehler?: unknown) {
  const zeile = {
    zeit: new Date().toISOString(),
    schwere: ereignis.schwere,
    vorgang: ereignis.vorgang,
    user: ereignis.userId ?? null,
    fehler: beschreibung(fehler),
    ...ereignis.details,
  };

  // Eine Zeile JSON: in jedem Log-Werkzeug auswertbar, auch ohne Dienst.
  const ausgabe = JSON.stringify(zeile);
  if (ereignis.schwere === "fehler") console.error(ausgabe);
  else console.warn(ausgabe);

  void anSentry(zeile);
}

/**
 * Fehlerobjekte auf das reduzieren, was zur Einordnung nötig ist.
 * Die Meldung kann Bruchstücke von Eingaben enthalten, deshalb wird sie
 * gekürzt — die Zuordnung leistet ohnehin der Vorgang.
 */
function beschreibung(fehler: unknown): string {
  if (fehler === undefined || fehler === null) return "";
  if (fehler instanceof Error) {
    return `${fehler.name}: ${fehler.message}`.slice(0, 300);
  }
  return String(fehler).slice(0, 300);
}

/**
 * Weiterleitung an Sentry über die Store-Schnittstelle.
 *
 * Bewusst ohne SDK: das offizielle Paket bringt für Next einen eigenen
 * Build-Schritt und Instrumentierung mit. Für „sag mir Bescheid, wenn etwas
 * kaputtgeht" ist das zu viel Apparat — ein POST genügt, und der Rest der
 * App weiss nichts davon.
 */
async function anSentry(zeile: Record<string, unknown>): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Aufbau: https://<key>@<host>/<projekt>
    const url = new URL(dsn);
    const projekt = url.pathname.replace("/", "");
    const ziel = `${url.protocol}//${url.host}/api/${projekt}/store/`;

    await fetch(ziel, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7, sentry_key=${url.username}`,
      },
      body: JSON.stringify({
        level: zeile.schwere === "fehler" ? "error" : "warning",
        logger: "baustift",
        platform: "node",
        environment: process.env.VERCEL_ENV ?? "development",
        message: `${zeile.vorgang}: ${zeile.fehler || "ohne Meldung"}`,
        extra: zeile,
      }),
      // Ein hängendes Monitoring darf keine Anfrage blockieren.
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Wenn das Melden scheitert, ist das kein Grund, die eigentliche
    // Anfrage scheitern zu lassen.
  }
}
