import { BelegPdf } from "@/lib/pdf/beleg-pdf";
import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

/**
 * Rechnungs-PDF.
 *
 * Wie beim Angebot nur die Übersetzung in den gemeinsamen Beleg-Bauplan.
 * Die rechnungsspezifischen Pflichtangaben — Leistungszeitpunkt, Zahlungsziel,
 * Bankverbindung, Hinweis bei Storno — setzt die Vorlage daraus automatisch.
 */
export interface RechnungPdfDaten {
  rechnung: Rechnung;
  positionen: RechnungPosition[];
  kunde: Kunde | null;
  firma: Profile;
  logoDataUrl: string | null;
}

export function RechnungPdf({
  rechnung,
  positionen,
  kunde,
  firma,
  logoDataUrl,
}: RechnungPdfDaten) {
  return BelegPdf({
    beleg: {
      art: "rechnung",
      nummer: rechnung.nummer,
      titel: rechnung.titel,
      datum: rechnung.datum,
      netto: rechnung.netto,
      mwstSatz: rechnung.mwst_satz,
      mwstBetrag: rechnung.mwst_betrag,
      brutto: rechnung.brutto,
      notiz: rechnung.notiz,
      leistungVon: rechnung.leistung_von,
      leistungBis: rechnung.leistung_bis,
      faelligAm: rechnung.faellig_am,
      storniert: rechnung.status === "storniert",
    },
    positionen,
    kunde,
    firma,
    logoDataUrl,
  });
}
