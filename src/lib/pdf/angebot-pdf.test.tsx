import { renderToBuffer } from "@react-pdf/renderer";
import { PDFParse } from "pdf-parse";
import { describe, expect, it } from "vitest";

import { AngebotPdf } from "./angebot-pdf";
import type { Angebot, Kunde, Position, Profile } from "@/types/database";

/**
 * Das PDF ist das Produkt, das beim Kunden ankommt. Ein Renderfehler darf
 * nicht erst dort auffallen — deshalb wird es hier wirklich gebaut und der
 * Text anschliessend wieder ausgelesen. Geprüft wird, was drinstehen MUSS
 * (Pflichtangaben, Beträge), nicht wie es aussieht.
 */

/** Liest den sichtbaren Text aus einem gerenderten PDF zurück. */
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
  id: "u1",
  firma_name: "Schulz Sanitär GmbH",
  inhaber_name: "Michael Schulz",
  strasse: "Handwerkerweg 8",
  plz: "50667",
  ort: "Köln",
  telefon: "0221 123456",
  email: "info@schulz-sanitaer.de",
  website: "schulz-sanitaer.de",
  steuernummer: "215/5721/0341",
  ust_id: "DE123456789",
  iban: "DE89 3704 0044 0532 0130 00",
  bic: "COLSDE33",
  bank_name: "Sparkasse Köln",
  logo_url: null,
  kleinunternehmer: false,
  mwst_satz: 19,
  angebot_gueltig_tage: 30,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  subscription_status: "aktiv", stripe_ereignis_am: null,
  onboarding_am: null,
  av_zugestimmt_am: null,
  agb_zugestimmt_am: null,
  created_at: "",
  updated_at: "",
};

const kunde: Kunde = {
  id: "k1",
  user_id: "u1",
  name: "Familie Becker",
  ansprechpartner: null,
  strasse: "Lindenstr. 12",
  plz: "50667",
  ort: "Köln",
  email: null,
  telefon: null,
  notizen: null,
  created_at: "",
  updated_at: "",
};

const angebot: Angebot = {
  id: "a1",
  user_id: "u1",
  kunde_id: "k1",
  nummer: "AN-2026-0041",
  titel: "Badsanierung Lindenstr. 12",
  status: "entwurf",
  datum: "2026-09-23",
  gueltig_bis: "2026-10-23",
  audio_path: null,
  transkript: "Bad komplett, acht Quadratmeter …",
  ki_hinweis: null,
  netto: 2754,
  mwst_satz: 19,
  mwst_betrag: 523.26,
  brutto: 3277.26,
  notiz: "Angebot gültig 30 Tage.",
  pdf_path: null,
  gesendet_am: null,
  entschieden_am: null,
  nachgefasst_am: null,
  nachfassungen: 0,
  eingabe_art: null,
  aufnahme_sekunden: null,
  freigabe_token: "tok-test",
  freigabe_geoeffnet_am: null,
  entschieden_durch: null,
  kunden_anmerkung: null,
  created_at: "",
  updated_at: "",
};

function position(
  nr: number,
  bezeichnung: string,
  menge: number,
  einzelpreis: number,
): Position {
  return {
    id: `p${nr}`,
    angebot_id: "a1",
    pos_nr: nr,
    bezeichnung,
    beschreibung: null,
    menge,
    einheit: "m2",
    einzelpreis,
    gesamtpreis: Math.round(menge * einzelpreis * 100) / 100,
    preisliste_id: null,
    zu_pruefen: false,
    ki_konfidenz: null,
    created_at: "",
    updated_at: "",
  };
}

const positionen = [
  position(1, "Demontage alte Fliesen", 8, 28),
  position(2, "Fliesen verlegen 60x60", 8, 65),
  position(3, "Bodengleiche Dusche inkl. Rinne", 1, 1450),
  position(4, "WC tauschen inkl. Montage", 1, 380),
  position(5, "Entsorgung Bauschutt", 1, 180),
];

describe("Angebots-PDF", () => {
  it("rendert ein gültiges PDF", async () => {
    const puffer = await renderToBuffer(
      AngebotPdf({ angebot, positionen, kunde, firma, logoDataUrl: null }),
    );

    // %PDF- ist die Signatur jeder PDF-Datei.
    expect(puffer.subarray(0, 5).toString()).toBe("%PDF-");

    const text = await pdfText(puffer);

    // Pflichtangaben auf einem deutschen Geschäftsdokument.
    expect(text).toContain("Schulz Sanitär GmbH");
    expect(text).toContain("215/5721/0341");
    expect(text).toContain("DE123456789");
    expect(text).toContain("DE89 3704 0044 0532 0130 00");

    // Empfänger, Nummer, Frist.
    expect(text).toContain("Familie Becker");
    expect(text).toContain("AN-2026-0041");
    expect(text).toContain("23.09.2026");
    expect(text).toContain("23.10.2026");

    // Positionen und Beträge in deutscher Schreibweise.
    expect(text).toContain("Bodengleiche Dusche inkl. Rinne");
    expect(text).toContain("1.450,00");
    expect(text).toContain("2.754,00");
    expect(text).toContain("523,26");
    expect(text).toContain("3.277,26");
  });

  it("kommt ohne Kunde und ohne Firmendaten aus", async () => {
    // Ein frisch registrierter Betrieb hat nichts ausgefüllt. Das PDF muss
    // trotzdem entstehen — sonst ist das erste Erlebnis ein Absturz.
    const leer: Profile = { ...firma, firma_name: "", strasse: null, plz: null, ort: null, iban: null, steuernummer: null };
    const puffer = await renderToBuffer(
      AngebotPdf({
        angebot: { ...angebot, titel: "", notiz: null },
        positionen: [],
        kunde: null,
        firma: leer,
        logoDataUrl: null,
      }),
    );
    expect(puffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("weist bei Kleinunternehmern keine Umsatzsteuer aus", async () => {
    const puffer = await renderToBuffer(
      AngebotPdf({
        angebot: { ...angebot, mwst_satz: 0, mwst_betrag: 0, brutto: 2754 },
        positionen,
        kunde,
        firma: { ...firma, kleinunternehmer: true },
        logoDataUrl: null,
      }),
    );
    const text = await pdfText(puffer);
    // Der §19-Hinweis ist gesetzlich vorgeschrieben.
    expect(text).toContain("19 UStG");
    // …und eine MwSt-Zeile darf dann gerade NICHT auftauchen.
    expect(text).not.toContain("MwSt");
  });
});

/**
 * =============================================================================
 * Mehrseitige Angebote
 * =============================================================================
 * Ein Bad mit vierzig Positionen passt nicht auf eine Seite. Was auf Seite 2
 * fehlt, fehlt im verbindlichen Dokument beim Kunden — und niemand prüft das,
 * bevor er es abschickt.
 */
describe("über mehrere Seiten", () => {
  const viele = Array.from({ length: 45 }, (_, i) =>
    position(i + 1, `Leistung ${i + 1}`, 1, 100),
  );

  async function seitenUndText() {
    const puffer = await renderToBuffer(
      AngebotPdf({
        angebot: { ...angebot, netto: 4500, mwst_betrag: 855, brutto: 5355 },
        positionen: viele,
        kunde,
        firma,
        logoDataUrl: null,
      }) as never,
    );
    const parser = new PDFParse({ data: new Uint8Array(puffer) });
    try {
      const r = await parser.getText();
      return { seiten: r.pages?.length ?? 0, text: r.text };
    } finally {
      await parser.destroy();
    }
  }

  it("wiederholt den Tabellenkopf auf jeder Seite", async () => {
    const { seiten, text } = await seitenUndText();

    expect(seiten).toBeGreaterThan(1);
    // Ohne den wiederholten Kopf stehen auf Seite 2 vier Spalten mit Zahlen,
    // und der Kunde muss raten, welche der Einzelpreis ist.
    expect(text.split("EINZELPREIS").length - 1).toBe(seiten);
  });

  it("zeigt die Pflichtangaben auf jeder Seite", async () => {
    const { seiten, text } = await seitenUndText();
    expect(text.split("St.-Nr.").length - 1).toBe(seiten);
  });

  it("nennt die Angebotsnummer auf jeder Seite", async () => {
    const { seiten, text } = await seitenUndText();

    // Damit einer einzelnen Seite anzusehen ist, wozu sie gehört — und ob
    // eine fehlt.
    expect(text.split("Angebot AN-2026-0041").length - 1).toBe(seiten);
  });

  it("bricht eine Position nicht über den Seitenrand", async () => {
    const { text } = await seitenUndText();
    // Jede der 45 Zeilen steht genau einmal vollständig da.
    for (let i = 1; i <= 45; i++) {
      expect(text, `Leistung ${i}`).toContain(`Leistung ${i} `);
    }
  });
});

describe("ohne zugeordneten Kunden", () => {
  it("lässt das Anschriftenfeld leer, statt eine Meldung abzudrucken", async () => {
    const puffer = await renderToBuffer(
      AngebotPdf({ angebot, positionen: [position(1, "Fliesen", 1, 100)], kunde: null, firma, logoDataUrl: null }) as never,
    );
    const parser = new PDFParse({ data: new Uint8Array(puffer) });
    const text = (await parser.getText()).text;
    await parser.destroy();

    // "— kein Kunde zugeordnet —" ist eine Meldung aus der Anwendung. Im
    // Anschriftenfeld eines ausgedruckten Angebots hat sie nichts verloren.
    expect(text).not.toContain("kein Kunde");
    expect(text).toContain("AN-2026-0041");
  });
});
