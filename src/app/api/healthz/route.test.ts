import { describe, expect, it } from "vitest";

import { GET } from "./route";

/**
 * Der Endpunkt, an dem Render erkennt, ob die Instanz lebt. Antwortet er
 * nicht, nimmt Render sie aus dem Verkehr — ein Fehler hier schaltet also
 * die ganze Anwendung ab.
 */
describe("Lebenszeichen", () => {
  it("antwortet mit 200 und ok", async () => {
    const antwort = GET();

    expect(antwort.status).toBe(200);
    expect(await antwort.json()).toEqual({ status: "ok" });
  });

  it("wird nicht zwischengespeichert", () => {
    // Eine gecachte 200 würde eine tote Instanz als gesund melden.
    expect(GET().headers.get("Cache-Control")).toContain("no-store");
  });

  it("verrät nichts über den Betrieb", async () => {
    // Der Pfad ist öffentlich: kein Versionsstand, keine Umgebung, keine
    // Variablennamen.
    const rumpf = await GET().json();
    expect(Object.keys(rumpf)).toEqual(["status"]);
  });
});
