import { defineConfig } from "vitest/config";

/**
 * Testaufbau.
 *
 * Getestet wird die Logik, die still falsch sein kann: Preis-Matching,
 * Zahlenformate, Kontingente, PDF-Aufbau. Für Klick-Wege gibt es keine
 * Tests — die kosten mehr Pflege, als sie hier einbringen; dafür ist die
 * Datenbankschicht mit scripts/db-test.sh abgedeckt.
 */
export default defineConfig({
  resolve: {
    // "@/..." auflösen wie in Next.
    tsconfigPaths: true,
    alias: {
      // Siehe src/test/server-only-stub.ts.
      "server-only": new URL("./src/test/server-only-stub.ts", import.meta.url)
        .pathname,
    },
  },
  // tsconfig.json steht auf "preserve", weil Next das so braucht. Für die
  // Tests muss JSX dagegen wirklich übersetzt werden — esbuild liest die
  // Einstellung hier statt aus der tsconfig.
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
