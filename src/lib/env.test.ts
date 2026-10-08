import { afterEach, describe, expect, it, vi } from "vitest";
import { istKonfigurationsFehler, publicEnv, serverEnv } from "./env";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe("serverEnv", () => {
  it("isoliert die Konfiguration der einzelnen Integrationen", () => {
    for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_ID"]) vi.stubEnv(key, "");
    vi.stubEnv("OPENAI_API_KEY", "audio-test-key");
    expect(serverEnv().openaiApiKey).toBe("audio-test-key");
    expect(() => serverEnv().stripeSecretKey).toThrow("STRIPE_SECRET_KEY");
    vi.stubEnv("ANTHROPIC_API_KEY", "ai-test-key");
    expect(serverEnv().anthropicApiKey).toBe("ai-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "db-test-key");
    expect(serverEnv().supabaseServiceRoleKey).toBe("db-test-key");
  });
  it("verweigert Zugriff im Browser", () => {
    vi.stubGlobal("window", {});
    expect(() => serverEnv()).toThrow("niemals im Browser");
  });
});

describe("eigene Adresse", () => {
  const alt = { ...process.env };
  afterEach(() => {
    process.env = { ...alt };
  });

  it("nimmt die eingetragene Adresse ohne Schrägstrich am Ende", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://baustift.de/";
    expect(publicEnv.siteUrl).toBe("https://baustift.de");
  });

  it("fällt in der Entwicklung auf localhost zurück", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    expect(publicEnv.siteUrl).toBe("http://localhost:3000");
  });

  it("nimmt die Adresse, die Render selbst kennt", () => {
    // Render setzt RENDER_EXTERNAL_URL zur Laufzeit — vollständig, mit
    // Schema. Hilft bei den serverseitig entstehenden Links, ersetzt aber
    // NEXT_PUBLIC_SITE_URL nicht: die wird beim Bauen gebraucht.
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.RENDER_EXTERNAL_URL = "https://baustift.onrender.com/";
    expect(publicEnv.siteUrl).toBe("https://baustift.onrender.com");
    delete process.env.RENDER_EXTERNAL_URL;
  });

  it("nimmt sonst die Adresse von Vercel", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    process.env.NEXT_PUBLIC_VERCEL_URL = "baustift-abc123.vercel.app";
    expect(publicEnv.siteUrl).toBe("https://baustift-abc123.vercel.app");
  });

  it("scheitert in Produktion laut, statt auf localhost zu verlinken", () => {
    // Sonst geht der Bestätigungslink jeder Registrierung ins Leere.
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.NEXT_PUBLIC_VERCEL_URL;
    delete process.env.RENDER_EXTERNAL_URL;
    vi.stubEnv("NODE_ENV", "production");
    expect(() => publicEnv.siteUrl).toThrow("NEXT_PUBLIC_SITE_URL");
    vi.unstubAllEnvs();
  });
});

describe("fehlende Einstellungen", () => {
  it("nennt die Variable und wo sie hingehört", () => {
    expect(() => serverEnv().anthropicApiKey).toThrow("ANTHROPIC_API_KEY");
  });

  it("ist als Einrichtungsfehler erkennbar", () => {
    // Der Unterschied zählt: ein ausgefallener Dienst geht von selbst
    // wieder, eine fehlende Variable nicht. Die Routen zeigen deshalb
    // eine andere Meldung.
    let gefangen: unknown;
    try {
      serverEnv().stripeSecretKey;
    } catch (fehler) {
      gefangen = fehler;
    }
    expect(istKonfigurationsFehler(gefangen)).toBe(true);
    expect(istKonfigurationsFehler(new Error("irgendwas anderes"))).toBe(false);
  });
});
