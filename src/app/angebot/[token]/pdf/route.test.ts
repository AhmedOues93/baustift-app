import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * =============================================================================
 * Das Angebots-PDF für den Kunden
 * =============================================================================
 * Die einzige PDF-Ausgabe ohne Anmeldung. Die Berechtigung beantwortet die
 * Datenbank über den Schlüssel; danach lädt die Route mit dem Admin-Client.
 * Genau diese Reihenfolge wird hier geprüft — ein Admin-Client, der vor der
 * Prüfung lädt, wäre eine offene Tür.
 */

let tokenTreffer: { angebot_id: string; besitzer: string }[];
let erzeugt: { id: string; besitzer?: string }[];
let pdfFehler: string | undefined;

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    rpc: async (_name: string, _args: unknown) => ({ data: tokenTreffer, error: null }),
  }),
  createAdminClient: () => ({ marke: "admin" }),
}));

vi.mock("@/lib/pdf/erzeugen", () => ({
  angebotPdfErzeugen: async (_client: unknown, id: string, besitzer?: string) => {
    erzeugt.push({ id, besitzer });
    if (pdfFehler) return { fehler: pdfFehler };
    return {
      puffer: Buffer.from("%PDF-1.7 Testinhalt"),
      dateiname: "Angebot-AN-2026-0040.pdf",
    };
  },
}));

async function hole(token: string, abfrage = "") {
  const { GET } = await import("./route");
  return GET(new Request(`http://localhost/angebot/${token}/pdf${abfrage}`), {
    params: Promise.resolve({ token }),
  });
}

beforeEach(() => {
  vi.resetModules();
  tokenTreffer = [{ angebot_id: "a2", besitzer: "u1" }];
  erzeugt = [];
  pdfFehler = undefined;
});

describe("Berechtigung", () => {
  it("liefert das PDF, wenn der Schlüssel passt", async () => {
    const antwort = await hole("tok-a2");

    expect(antwort.status).toBe(200);
    expect(antwort.headers.get("Content-Type")).toBe("application/pdf");
    expect(erzeugt).toEqual([{ id: "a2", besitzer: "u1" }]);
  });

  it("lädt gar nichts, wenn der Schlüssel nicht passt", async () => {
    // Die Datenbank gibt nichts zurück — und der Admin-Client wird dann
    // auch nicht bemüht. Sonst wäre die Prüfung nur Zierde.
    tokenTreffer = [];

    const antwort = await hole("geraten");

    expect(antwort.status).toBe(404);
    expect(erzeugt).toEqual([]);
  });

  it("gibt dieselbe Antwort, wenn das Angebot nicht ladbar ist", async () => {
    pdfFehler = "Angebot nicht gefunden.";

    const antwort = await hole("tok-a2");

    expect(antwort.status).toBe(404);
    // Die innere Meldung erreicht den Besucher nicht.
    expect(await antwort.text()).not.toContain("nicht gefunden.");
  });
});

describe("Auslieferung", () => {
  it("zeigt es an, lädt es auf Wunsch herunter", async () => {
    expect((await hole("tok-a2")).headers.get("Content-Disposition")).toContain("inline");
    expect((await hole("tok-a2", "?download=1")).headers.get("Content-Disposition")).toContain(
      "attachment",
    );
  });

  it("hält es aus Zwischenspeichern und Suchmaschinen heraus", async () => {
    const antwort = await hole("tok-a2");

    // Ein Angebot mit Preisen gehört in keinen geteilten Zwischenspeicher
    // und in keinen Index.
    expect(antwort.headers.get("Cache-Control")).toContain("no-store");
    expect(antwort.headers.get("X-Robots-Tag")).toContain("noindex");
  });
});
