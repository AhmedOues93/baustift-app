import { describe, expect, it } from "vitest";

import { anzahlAusParameter } from "./mehr";

/**
 * Der Parameter `n` kommt aus der Adresszeile und damit von aussen. Ein
 * `?n=99999999` würde die Seite mit allem rendern, was die Abfrage hergibt —
 * auf einem Handy heisst das: nichts geht mehr.
 */
describe("anzahlAusParameter", () => {
  it("nimmt den Standard, wenn nichts angegeben ist", () => {
    expect(anzahlAusParameter(undefined)).toBe(25);
  });

  it("übernimmt einen sinnvollen Wert", () => {
    expect(anzahlAusParameter("50")).toBe(50);
  });

  it("geht nie unter den Standard", () => {
    expect(anzahlAusParameter("1")).toBe(25);
    expect(anzahlAusParameter("-10")).toBe(25);
    expect(anzahlAusParameter("0")).toBe(25);
  });

  it("deckelt masslose Werte", () => {
    expect(anzahlAusParameter("999999")).toBe(1000);
  });

  it("ignoriert Unsinn", () => {
    expect(anzahlAusParameter("viele")).toBe(25);
    expect(anzahlAusParameter("")).toBe(25);
    expect(anzahlAusParameter("NaN")).toBe(25);
    expect(anzahlAusParameter("Infinity")).toBe(25);
  });

  it("schneidet Kommawerte ab", () => {
    expect(anzahlAusParameter("30.7")).toBe(30);
  });
});
