import { describe, expect, it } from "vitest";

import { rechnungEn16931Xml } from "./en16931";
import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

/**
 * Die maschinenlesbare Rechnung.
 *
 * Anders als beim PDF liest das hier kein Mensch: die Datei geht in die
 * Buchhaltungssoftware des Kunden, und die prüft streng. Was die Prüfung
 * nicht besteht, wird abgelehnt — und der Handwerker erfährt es erst, wenn
 * das Geld ausbleibt. Deshalb sind die Regeln der Norm hier als Tests
 * festgehalten und nicht als gute Absicht.
 */

const firma: Profile = {
  id: "u1", firma_name: "Schulz Sanitär GmbH", inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8", plz: "50667", ort: "Köln", telefon: "0221 123456",
  email: "info@schulz.de", website: null, steuernummer: "215/5721/0341",
  ust_id: "DE123456789", iban: "DE02 3705 0198 0000 1234 56", bic: "COLSDE33",
  bank_name: "Sparkasse", logo_url: null, kleinunternehmer: false, mwst_satz: 19,
  angebot_gueltig_tage: 30, stripe_customer_id: null, stripe_subscription_id: null,
  subscription_status: "aktiv", onboarding_am: null, av_zugestimmt_am: null,
  agb_zugestimmt_am: null, created_at: "", updated_at: "",
};

const kunde: Kunde = {
  id: "k1", user_id: "u1", name: "Hausverwaltung Nord", ansprechpartner: "Frau Dietrich",
  strasse: "Ringstr. 40", plz: "50733", ort: "Köln", email: null, telefon: null,
  notizen: null, created_at: "", updated_at: "",
};

const rechnung: Rechnung = {
  id: "r1", user_id: "u1", kunde_id: "k1", angebot_id: null, nummer: "RE-2026-0016",
  titel: "Wartung Heizung", status: "gestellt", datum: "2026-08-26",
  leistung_von: "2026-08-20", leistung_bis: "2026-08-24", zahlungsziel_tage: 14,
  faellig_am: "2026-09-08", netto: 420, mwst_satz: 19, mwst_betrag: 79.8,
  brutto: 499.8, notiz: null, festgeschrieben_am: "2026-08-26T10:00:00Z",
  bezahlt_am: null, storniert_am: null, storniert_durch: null,
  gemahnt_am: null, mahnungen: 0, created_at: "", updated_at: "",
};

const positionen: RechnungPosition[] = [
  {
    id: "p1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Wartung Gastherme",
    beschreibung: null, menge: 1, einheit: "pauschal", einzelpreis: 320,
    gesamtpreis: 320, created_at: "", updated_at: "",
  },
  {
    id: "p2", rechnung_id: "r1", pos_nr: 2, bezeichnung: "Monteurstunde",
    beschreibung: null, menge: 1, einheit: "h", einzelpreis: 100,
    gesamtpreis: 100, created_at: "", updated_at: "",
  },
];

function xmlFuer(teil: Partial<Rechnung> = {}, pos = positionen) {
  return rechnungEn16931Xml({
    rechnung: { ...rechnung, ...teil },
    positionen: pos,
    kunde,
    firma,
  });
}

describe("Grundgerüst", () => {
  const xml = xmlFuer();

  it("nennt die Norm, nach der geprüft wird", () => {
    expect(xml).toContain("urn:cen.eu:en16931:2017");
  });

  it("trägt Nummer, Datum und Rechnungsart ein", () => {
    expect(xml).toContain("<ram:ID>RE-2026-0016</ram:ID>");
    // Format 102 heisst CCYYMMDD — ohne Bindestriche.
    expect(xml).toContain(">20260826<");
    expect(xml).toContain("<ram:TypeCode>380</ram:TypeCode>");
  });

  it("führt beide Seiten mit vollständiger Anschrift", () => {
    expect(xml).toContain("Schulz Sanitär GmbH");
    expect(xml).toContain("Hausverwaltung Nord");
    expect(xml).toContain("<ram:CountryID>DE</ram:CountryID>");
  });

  it("nennt die USt-IdNr. mit dem richtigen Schema", () => {
    expect(xml).toContain('schemeID="VA">DE123456789');
  });

  it("weicht auf die Steuernummer aus, wenn keine USt-IdNr. da ist", () => {
    const ohne = rechnungEn16931Xml({
      rechnung, positionen, kunde, firma: { ...firma, ust_id: null },
    });
    expect(ohne).toContain('schemeID="FC">215/5721/0341');
  });

  it("nennt Summen und IBAN", () => {
    expect(xml).toContain("<ram:GrandTotalAmount>499.80</ram:GrandTotalAmount>");
    expect(xml).toContain("<ram:TaxBasisTotalAmount>420.00</ram:TaxBasisTotalAmount>");
    // Ohne Leerzeichen, sonst weisen manche Prüfer die IBAN ab.
    expect(xml).toContain("DE02370501980000123456");
  });

  it("gibt jeder Position eine Nummer und die richtige Mengeneinheit", () => {
    expect(xml).toContain("<ram:LineID>1</ram:LineID>");
    expect(xml).toContain("<ram:LineID>2</ram:LineID>");
    // HUR = Stunde nach UN/ECE Recommendation 20.
    expect(xml).toContain('unitCode="HUR"');
  });

  it("maskiert Sonderzeichen, statt das Dokument zu zerlegen", () => {
    const mit = rechnungEn16931Xml({
      rechnung, positionen, kunde: { ...kunde, name: 'Meier & Söhne "Bau"' }, firma,
    });
    expect(mit).toContain("Meier &amp; Söhne &quot;Bau&quot;");
    expect(mit).not.toContain('Söhne "Bau"');
  });
});

describe("Kleinunternehmer (§19 UStG)", () => {
  const xml = xmlFuer({ mwst_satz: 0, mwst_betrag: 0, brutto: 420 });

  it("kennzeichnet die Rechnung als steuerbefreit", () => {
    expect(xml).toContain("<ram:CategoryCode>E</ram:CategoryCode>");
  });

  it("nennt den Grund der Steuerbefreiung", () => {
    // Die Norm verlangt bei Kategorie E zwingend einen Grund (BR-E-10).
    // Ohne ihn weist jede ordentliche Prüfung die Rechnung ab — und ein
    // Kleinunternehmer könnte gar keine E-Rechnung stellen.
    expect(xml).toMatch(/<ram:ExemptionReason>[^<]+<\/ram:ExemptionReason>/);
    expect(xml).toContain("19 UStG");
  });
});

describe("Stornorechnung", () => {
  const storno = xmlFuer(
    {
      nummer: "RE-2026-0017", status: "storniert", netto: -420,
      mwst_betrag: -79.8, brutto: -499.8,
    },
    positionen.map((p) => ({
      ...p, einzelpreis: -p.einzelpreis, gesamtpreis: -p.gesamtpreis,
    })),
  );

  it("ist eine Gutschrift, keine Rechnung", () => {
    // 381 = Gutschrift. Als 380 wäre es eine Rechnung über einen negativen
    // Betrag — die Norm verbietet negative Einzelpreise, die Datei würde
    // abgelehnt.
    expect(storno).toContain("<ram:TypeCode>381</ram:TypeCode>");
    expect(storno).not.toContain("<ram:TypeCode>380</ram:TypeCode>");
  });

  it("nennt die Beträge positiv", () => {
    expect(storno).not.toMatch(/>-\d/);
    expect(storno).toContain("<ram:GrandTotalAmount>499.80</ram:GrandTotalAmount>");
  });
});

describe("Unvollständige Daten", () => {
  it("nennt alles, was fehlt, auf einmal", () => {
    expect(() =>
      rechnungEn16931Xml({
        rechnung: { ...rechnung, leistung_von: null },
        positionen: [],
        kunde: { ...kunde, strasse: null },
        firma: { ...firma, ust_id: null, steuernummer: null },
      }),
    ).toThrow(/Kundenstrasse[\s\S]*Leistungsdatum[\s\S]*Rechnungspositionen/);
  });

  it("erzeugt nichts Halbes, sondern bricht ab", () => {
    expect(() =>
      rechnungEn16931Xml({ rechnung, positionen: [], kunde, firma }),
    ).toThrow(/unvollstaendig/i);
  });
});
