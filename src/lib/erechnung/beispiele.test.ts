/**
 * Beispielrechnungen fuer die Pruefung mit dem offiziellen Validator.
 *
 * Eigene Tests pruefen nur, was wir selbst fuer richtig halten. Ob die Datei
 * die Norm erfuellt, entscheidet der EN-16931-Pruefer der EU-Kommission und
 * das CII-Schema. Deshalb schreibt dieser Test die drei relevanten Faelle als
 * Dateien heraus; scripts/erechnung-pruefen.sh schickt sie durch Schema und
 * Schematron. Ohne DUMP_ZIEL wird nur geprueft, dass alle drei erzeugt werden.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rechnungEn16931Xml } from "./en16931";
import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

const firma: Profile = {
  id: "u1", firma_name: "Schulz Sanitär GmbH", inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8", plz: "50667", ort: "Köln", telefon: "0221 123456",
  email: "info@schulz.de", website: null, steuernummer: "215/5721/0341",
  ust_id: "DE123456789", iban: "DE89 3704 0044 0532 0130 00", bic: "COLSDE33",
  bank_name: "Sparkasse", logo_url: null, kleinunternehmer: false, mwst_satz: 19,
  angebot_gueltig_tage: 30, stripe_customer_id: null, stripe_subscription_id: null,
  subscription_status: "aktiv", stripe_ereignis_am: null, onboarding_am: null, av_zugestimmt_am: null,
  agb_zugestimmt_am: null, created_at: "", updated_at: "",
} as Profile;
const kunde: Kunde = {
  id: "k1", user_id: "u1", name: "Hausverwaltung Nord", ansprechpartner: "Frau Dietrich",
  strasse: "Ringstr. 40", plz: "50733", ort: "Köln", email: null, telefon: null,
  notizen: null, created_at: "", updated_at: "",
} as Kunde;
const rechnung: Rechnung = {
  id: "r1", user_id: "u1", kunde_id: "k1", angebot_id: null, nummer: "RE-2026-0016",
  titel: "Wartung Heizung", status: "gestellt", datum: "2026-08-26",
  leistung_von: "2026-08-20", leistung_bis: "2026-08-24", zahlungsziel_tage: 14,
  faellig_am: "2026-09-08", netto: 420, mwst_satz: 19, mwst_betrag: 79.8,
  brutto: 499.8, notiz: null, festgeschrieben_am: "2026-08-26T10:00:00Z",
  bezahlt_am: null, storniert_am: null, storniert_durch: null,
  gemahnt_am: null, mahnungen: 0, created_at: "", updated_at: "",
} as Rechnung;
const positionen: RechnungPosition[] = [
  { id: "p1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Wartung Gastherme", beschreibung: null, menge: 1, einheit: "pauschal", einzelpreis: 320, gesamtpreis: 320, created_at: "", updated_at: "" },
  { id: "p2", rechnung_id: "r1", pos_nr: 2, bezeichnung: "Monteurstunde", beschreibung: null, menge: 1, einheit: "h", einzelpreis: 100, gesamtpreis: 100, created_at: "", updated_at: "" },
] as RechnungPosition[];

const ZIEL = process.env.DUMP_ZIEL;

const faelle: Record<string, () => string> = {
  // Regelfall: 19 % Umsatzsteuer, Ueberweisung, USt-IdNr. vorhanden.
  regelfall: () => rechnungEn16931Xml({ rechnung, positionen, kunde, firma }),
  // Kleinunternehmer: 0 %, keine USt-IdNr. — hier war BR-CO-26 verletzt.
  kleinunternehmer: () =>
    rechnungEn16931Xml({
      rechnung: { ...rechnung, mwst_satz: 0, mwst_betrag: 0, brutto: 420 },
      positionen,
      kunde,
      firma: { ...firma, kleinunternehmer: true, ust_id: null },
    }),
  // Aufmass: Menge mit drei Nachkommastellen, wie sie beim Messen entsteht.
  aufmass: () =>
    rechnungEn16931Xml({
      rechnung: { ...rechnung, netto: 58.59, mwst_betrag: 11.13, brutto: 69.72 },
      positionen: [
        {
          ...positionen[0],
          bezeichnung: "Beton C25/30 einbringen",
          menge: 1.125,
          einheit: "m3",
          einzelpreis: 52.08,
          gesamtpreis: 58.59,
        },
      ],
      kunde,
      firma,
    }),
  // Storno: laut Norm eine Gutschrift (381) mit positiven Betraegen.
  storno: () =>
    rechnungEn16931Xml({
      rechnung: {
        ...rechnung,
        status: "storniert",
        netto: -420,
        mwst_betrag: -79.8,
        brutto: -499.8,
        storniert_am: "2026-09-01T10:00:00Z",
      },
      positionen: positionen.map((p) => ({
        ...p,
        einzelpreis: -p.einzelpreis,
        gesamtpreis: -p.gesamtpreis,
      })),
      kunde,
      firma,
    }),
};

describe("Beispiele fuer den Validator", () => {
  it("erzeugt alle drei Faelle", () => {
    if (ZIEL) mkdirSync(ZIEL, { recursive: true });
    for (const [name, bauen] of Object.entries(faelle)) {
      const xml = bauen();
      expect(xml.startsWith("<?xml"), name).toBe(true);
      if (ZIEL) writeFileSync(`${ZIEL}/${name}.xml`, xml);
    }
  });
});
