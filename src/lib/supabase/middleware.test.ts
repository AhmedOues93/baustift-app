import { describe, expect, it } from "vitest";

import { istOeffentlicherPfad } from "./middleware";

/**
 * Welche Seiten ohne Anmeldung erreichbar sind.
 *
 * Diese Liste sieht harmlos aus und ist es nicht: ein fehlender Eintrag
 * schickt genau die Nutzer auf /login, die dort nicht weiterkommen. Bei der
 * Passwort-Wiederherstellung war die Folge, dass die Funktion vollständig
 * gebaut, aber für niemanden erreichbar war.
 */
describe("istOeffentlicherPfad", () => {
  it("lässt die Anmeldung und die Registrierung durch", () => {
    expect(istOeffentlicherPfad("/")).toBe(true);
    expect(istOeffentlicherPfad("/login")).toBe(true);
    expect(istOeffentlicherPfad("/signup")).toBe(true);
  });

  it("lässt die Passwort-Wiederherstellung durch", () => {
    // Wer sein Passwort vergessen hat, ist per Definition nicht angemeldet.
    expect(istOeffentlicherPfad("/passwort-vergessen")).toBe(true);
    expect(istOeffentlicherPfad("/passwort-neu")).toBe(true);
  });

  it("lässt den Rücksprung von Google und aus E-Mail-Links durch", () => {
    expect(istOeffentlicherPfad("/auth/callback")).toBe(true);
  });

  it("lässt die Rechtstexte durch", () => {
    // Ein Impressum hinter einer Anmeldung erfüllt seinen Zweck nicht.
    expect(istOeffentlicherPfad("/rechtliches/impressum")).toBe(true);
    expect(istOeffentlicherPfad("/rechtliches/datenschutz")).toBe(true);
  });

  it("lässt den Stripe-Webhook durch", () => {
    // Stripe hat keine Session und weist sich mit einer Signatur aus.
    expect(istOeffentlicherPfad("/api/stripe/webhook")).toBe(true);
  });

  it("schützt alles andere", () => {
    expect(istOeffentlicherPfad("/angebote")).toBe(false);
    expect(istOeffentlicherPfad("/angebote/neu")).toBe(false);
    expect(istOeffentlicherPfad("/rechnungen")).toBe(false);
    expect(istOeffentlicherPfad("/kunden")).toBe(false);
    expect(istOeffentlicherPfad("/preisliste")).toBe(false);
    expect(istOeffentlicherPfad("/einstellungen")).toBe(false);
    expect(istOeffentlicherPfad("/pilot")).toBe(false);
    expect(istOeffentlicherPfad("/api/angebote/neu")).toBe(false);
  });

  it("lässt sich nicht mit einem ähnlichen Namen austricksen", () => {
    // "/loginXYZ" ist nicht "/login" — sonst wäre die Prüfung ein Sieb.
    expect(istOeffentlicherPfad("/loginversuch")).toBe(false);
    expect(istOeffentlicherPfad("/rechtlicheszeug")).toBe(false);
  });
});
