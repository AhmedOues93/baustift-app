import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

/**
 * =============================================================================
 * Passen die React-Fassungen zusammen?
 * =============================================================================
 * Diese Datei gibt es wegen eines Fehlers, der wochenlang unbemerkt blieb und
 * ausgerechnet das kaputt machte, wofür Kunden zahlen: das PDF.
 *
 * WAS PASSIERT WAR: Next wurde auf 15 gehoben, React blieb auf 18. Next 15
 * bringt für den Server sein eigenes React 19 mit und übersetzt damit auch
 * unseren Code. @react-pdf/renderer dagegen lädt React aus node_modules —
 * also 18. Die beiden Fassungen bauen Elemente unterschiedlich: React 19 legt
 * kein `ref` mehr ins Element. Der Renderer von React 18 erkannte die
 * Elemente deshalb nicht als Elemente und brach mit "Objects are not valid as
 * a React child" ab. Jedes PDF: 500.
 *
 * WARUM DIE TESTS DAS NICHT GEMERKT HABEN: in vitest wird alles gegen dasselbe
 * React aus node_modules aufgelöst. Dort passte es zusammen, die PDF-Tests
 * waren grün — und der Weg durch die echte Anwendung war trotzdem kaputt. Ein
 * Test kann eben nur prüfen, was er auch wirklich durchläuft.
 *
 * Diese Prüfung ist billig und hätte gereicht: sie vergleicht die installierte
 * Fassung mit dem, was die Pakete verlangen.
 */

const require = createRequire(import.meta.url);

function version(paket: string): string {
  return JSON.parse(
    readFileSync(require.resolve(`${paket}/package.json`), "utf8"),
  ).version;
}

function peerReact(paket: string): string | undefined {
  return JSON.parse(
    readFileSync(require.resolve(`${paket}/package.json`), "utf8"),
  ).peerDependencies?.react;
}

/** Nur die Hauptnummer — darauf kommt es an. */
function haupt(v: string): number {
  return Number(v.split(".")[0]);
}

describe("React-Fassungen", () => {
  it("installiert React und React-DOM in derselben Hauptversion", () => {
    expect(haupt(version("react-dom"))).toBe(haupt(version("react")));
  });

  it("passt zu dem React, das Next für den Server mitbringt", () => {
    /**
     * Die Prüfung, auf die es ankommt — und die einzige, die den echten
     * Fehler gefunden hätte.
     *
     * Die Paketangabe von Next hilft hier nicht: sie erlaubt weiterhin
     * "^18.2.0 || ^19.0.0", obwohl Next 15 den Servercode tatsächlich mit
     * seinem mitgelieferten React 19 übersetzt. Genau das war die Falle —
     * die Installation sah zulässig aus und war es nicht.
     *
     * Also fragen wir nicht, was Next verlangt, sondern was es benutzt.
     */
    const nextsReact = (
      require("next/dist/compiled/react/index.js") as { version: string }
    ).version;

    expect(
      haupt(version("react")),
      `Next übersetzt den Servercode mit React ${nextsReact}; ` +
        `installiert ist ${version("react")}. Unterschiedliche Hauptversionen ` +
        `bauen Elemente unterschiedlich — das PDF bricht dann bei jedem Abruf ab.`,
    ).toBe(haupt(nextsReact));
  });

  it("erfüllt, was @react-pdf/renderer verlangt", () => {
    // Der Renderer läuft ausserhalb des Next-Bündels und nimmt React aus
    // node_modules. Passt das nicht zu Next, bricht jedes PDF ab.
    const verlangt = peerReact("@react-pdf/renderer") ?? "";
    const installiert = haupt(version("react"));
    const erlaubt = [...verlangt.matchAll(/\^?(\d+)\./g)].map((m) => Number(m[1]));

    expect(erlaubt, `@react-pdf/renderer verlangt "${verlangt}"`).toContain(
      installiert,
    );
  });

  it("hat React nur einmal installiert", () => {
    // Zwei Kopien im Baum wären derselbe Fehler in anderer Gestalt.
    const ausSicht = (von: string) =>
      version(von) &&
      JSON.parse(
        readFileSync(require.resolve("react/package.json"), "utf8"),
      ).version;

    expect(ausSicht("@react-pdf/renderer")).toBe(version("react"));
  });
});
