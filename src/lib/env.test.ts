import { afterEach, describe, expect, it, vi } from "vitest";
import { serverEnv } from "./env";

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
