import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";

import { RechnungPdf } from "./rechnung-pdf";
import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

/**
 * Eine Rechnung ohne die Pflichtangaben aus §14 UStG ist für den Kunden nicht
 * zum Vorsteuerabzug zu gebrauchen — und für den Handwerker ein Problem beim
 * nächsten Prüfer. Deshalb wird hier wirklich gerendert und der Text wieder
 * ausgelesen, statt ein Bild zu vergleichen.
 */
async function pdfText(puffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(puffer) });
  try {
    const ergebnis = await parser.getText();
    return ergebnis.text.replace(/\s+/g, " ");
  } finally {
    await parser.destroy();
  }
}

const firma: Profile = {
  id: "u1", firma_name: "Schulz Sanitär GmbH", inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8", plz: "50667", ort: "Köln", telefon: "0221 123456",
  email: "info@schulz-sanitaer.de", website: "schulz-sanitaer.de",
  steuernummer: "215/5721/0341", ust_id: "DE123456789",
  iban: "DE02 3705 0198 0000 1234 56", bic: "COLSDE33", bank_name: "Sparkasse Köln",
  logo_url: null, kleinunternehmer: false, mwst_satz: 19, angebot_gueltig_tage: 30,
  stripe_customer_id: null, stripe_subscription_id: null, subscription_status: "aktiv",
  onboarding_am: null, av_zugestimmt_am: null, agb_zugestimmt_am: null,
  created_at: "", updated_at: "",
};

const kunde: Kunde = {
  id: "k1", user_id: "u1", name: "Familie Becker", ansprechpartner: null,
  strasse: "Lindenstr. 12", plz: "50667", ort: "Köln", email: null, telefon: null,
  notizen: null, created_at: "", updated_at: "",
};

const rechnung: Rechnung = {
  id: "r1", user_id: "u1", kunde_id: "k1", angebot_id: "a1",
  nummer: "RE-2026-0007", titel: "Badsanierung Lindenstr. 12", status: "gestellt",
  datum: "2026-09-23", leistung_von: "2026-09-10", leistung_bis: "2026-09-18",
  zahlungsziel_tage: 14, faellig_am: "2026-10-07",
  netto: 2754, mwst_satz: 19, mwst_betrag: 523.26, brutto: 3277.26,
  notiz: null, festgeschrieben_am: "2026-09-23T10:00:00Z", bezahlt_am: null,
  storniert_am: null, storniert_durch: null,
  gemahnt_am: null, mahnungen: 0,
  created_at: "", updated_at: "",
};

const positionen: RechnungPosition[] = [
  { id: "p1", rechnung_id: "r1", pos_nr: 1, bezeichnung: "Fliesen verlegen 60x60", beschreibung: null, menge: 8, einheit: "m2", einzelpreis: 65, gesamtpreis: 520, created_at: "", updated_at: "" },
  { id: "p2", rechnung_id: "r1", pos_nr: 2, bezeichnung: "Bodengleiche Dusche inkl. Rinne", beschreibung: null, menge: 1, einheit: "pauschal", einzelpreis: 1450, gesamtpreis: 1450, created_at: "", updated_at: "" },
];

describe("Rechnungs-PDF", () => {
  it("enthält alle Pflichtangaben nach §14 UStG", async () => {
    const puffer = await renderToBuffer(
      RechnungPdf({ rechnung, positionen, kunde, firma, logoDataUrl: null }),
    );
    const text = await pdfText(puffer);

    expect(text).toContain("Rechnung");
    // Vollständiger Name und Anschrift beider Seiten
    expect(text).toContain("Schulz Sanitär GmbH");
    expect(text).toContain("Familie Becker");
    expect(text).toContain("Lindenstr. 12");
    // Steuernummer oder USt-IdNr.
    expect(text).toContain("215/5721/0341");
    expect(text).toContain("DE123456789");
    // Fortlaufende Rechnungsnummer und Ausstellungsdatum
    expect(text).toContain("RE-2026-0007");
    expect(text).toContain("23.09.2026");
    // Zeitpunkt der Leistung
    expect(text).toContain("10.09.2026");
    expect(text).toContain("18.09.2026");
    // Entgelt, Steuersatz und Steuerbetrag getrennt
    expect(text).toContain("2.754,00");
    expect(text).toContain("19 %");
    expect(text).toContain("523,26");
    expect(text).toContain("3.277,26");
    // Zahlungsziel und Bankverbindung
    expect(text).toContain("07.10.2026");
    expect(text).toContain("DE02 3705 0198 0000 1234 56");
  });

  it("nennt bei einem einzigen Leistungstag kein Von-Bis", async () => {
    const puffer = await renderToBuffer(
      RechnungPdf({
        rechnung: { ...rechnung, leistung_von: "2026-09-18", leistung_bis: "2026-09-18" },
        positionen, kunde, firma, logoDataUrl: null,
      }),
    );
    const text = await pdfText(puffer);
    expect(text).toContain("Leistungsdatum 18.09.2026");
  });

  it("weist bei Kleinunternehmern keine Umsatzsteuer aus", async () => {
    const puffer = await renderToBuffer(
      RechnungPdf({
        rechnung: { ...rechnung, mwst_satz: 0, mwst_betrag: 0, brutto: 2754 },
        positionen, kunde,
        firma: { ...firma, kleinunternehmer: true },
        logoDataUrl: null,
      }),
    );
    const text = await pdfText(puffer);
    expect(text).toContain("19 UStG");
    expect(text).not.toContain("MwSt");
  });

  it("kennzeichnet eine Stornorechnung als solche", async () => {
    const puffer = await renderToBuffer(
      RechnungPdf({
        rechnung: { ...rechnung, status: "storniert" },
        positionen, kunde, firma, logoDataUrl: null,
      }),
    );
    const text = await pdfText(puffer);
    expect(text).toContain("Stornorechnung");
    expect(text).toContain("hebt die ursprüngliche Rechnung auf");
  });
});
