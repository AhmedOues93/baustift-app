import { BelegPdf } from "@/lib/pdf/beleg-pdf";
import type { Angebot, Kunde, Position, Profile } from "@/types/database";

/**
 * Angebots-PDF.
 *
 * Nur die Übersetzung von Angebotsdaten in den gemeinsamen Beleg-Bauplan
 * (siehe beleg-pdf.tsx) — Angebot und Rechnung teilen sich bewusst dieselbe
 * Vorlage, damit die Rechnung eines Betriebs nicht anders aussieht als sein
 * Angebot.
 */
export interface AngebotPdfDaten {
  angebot: Angebot;
  positionen: Position[];
  kunde: Kunde | null;
  firma: Profile;
  logoDataUrl: string | null;
}

export function AngebotPdf({
  angebot,
  positionen,
  kunde,
  firma,
  logoDataUrl,
}: AngebotPdfDaten) {
  return BelegPdf({
    beleg: {
      art: "angebot",
      nummer: angebot.nummer,
      titel: angebot.titel,
      datum: angebot.datum,
      netto: angebot.netto,
      mwstSatz: angebot.mwst_satz,
      mwstBetrag: angebot.mwst_betrag,
      brutto: angebot.brutto,
      notiz: angebot.notiz,
      gueltigBis: angebot.gueltig_bis,
    },
    positionen,
    kunde,
    firma,
    logoDataUrl,
  });
}
