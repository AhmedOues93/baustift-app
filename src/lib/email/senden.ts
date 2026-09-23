import "server-only";

import { Resend } from "resend";

/**
 * E-Mail-Versand.
 *
 * Bewusst optional: ohne RESEND_API_KEY läuft die App vollständig weiter, der
 * Versandknopf verschwindet einfach und man lädt das PDF herunter. So lässt
 * sich das Produkt betreiben, bevor eine Domain verifiziert ist — und eine
 * fehlende Umgebungsvariable legt nicht die Angebotserstellung lahm.
 */

export function emailVerfuegbar(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_ABSENDER);
}

export interface EmailAnhang {
  dateiname: string;
  inhalt: Buffer;
}

export async function sendeEmail(args: {
  an: string;
  betreff: string;
  text: string;
  antwortAn?: string;
  anhaenge?: EmailAnhang[];
}): Promise<{ fehler?: string }> {
  if (!emailVerfuegbar()) {
    return { fehler: "Der E-Mail-Versand ist nicht eingerichtet." };
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: process.env.RESEND_ABSENDER!,
    to: args.an,
    subject: args.betreff,
    text: args.text,
    // Antworten sollen beim Handwerker landen, nicht bei uns. Ohne replyTo
    // schreibt der Kunde an eine Adresse, die niemand liest.
    replyTo: args.antwortAn,
    attachments: args.anhaenge?.map((a) => ({
      filename: a.dateiname,
      content: a.inhalt,
    })),
  });

  if (error) {
    console.error("[email] Versand fehlgeschlagen", error);
    return { fehler: "Die E-Mail konnte nicht zugestellt werden." };
  }

  return {};
}

/**
 * Der Text, mit dem ein Angebot beim Kunden ankommt.
 *
 * Kurz und ohne Marketing: das ist Post von einem Handwerksbetrieb, nicht von
 * uns. Baustift taucht in der Nachricht bewusst nicht auf.
 */
export function angebotNachricht(args: {
  firmaName: string;
  nummer: string;
  titel: string;
  gueltigBis: string | null;
  ansprechpartner: string | null;
  telefon: string | null;
}): { betreff: string; text: string } {
  const anrede = args.ansprechpartner
    ? `Guten Tag ${args.ansprechpartner},`
    : "Guten Tag,";

  const gueltig = args.gueltigBis
    ? `\n\nDas Angebot ist gültig bis zum ${formatDatum(args.gueltigBis)}.`
    : "";

  const rueckfragen = args.telefon
    ? `\n\nBei Rückfragen erreichen Sie uns unter ${args.telefon}.`
    : "\n\nBei Rückfragen melden Sie sich gern.";

  return {
    betreff: `Angebot ${args.nummer}${args.titel ? ` — ${args.titel}` : ""}`,
    text:
      `${anrede}\n\n` +
      `anbei erhalten Sie unser Angebot${args.titel ? ` für ${args.titel}` : ""} als PDF.` +
      gueltig +
      rueckfragen +
      `\n\nMit freundlichen Grüssen\n${args.firmaName}`,
  };
}

/** Der Text zu einer Rechnung. */
export function rechnungNachricht(args: {
  firmaName: string;
  nummer: string;
  titel: string;
  faelligAm: string | null;
  ansprechpartner: string | null;
}): { betreff: string; text: string } {
  const anrede = args.ansprechpartner
    ? `Guten Tag ${args.ansprechpartner},`
    : "Guten Tag,";

  const faellig = args.faelligAm
    ? `\n\nWir bitten um Überweisung bis zum ${formatDatum(args.faelligAm)}.`
    : "";

  return {
    betreff: `Rechnung ${args.nummer}${args.titel ? ` — ${args.titel}` : ""}`,
    text:
      `${anrede}\n\n` +
      `anbei erhalten Sie unsere Rechnung${args.titel ? ` für ${args.titel}` : ""} als PDF.` +
      faellig +
      `\n\nVielen Dank für den Auftrag.\n\nMit freundlichen Grüssen\n${args.firmaName}`,
  };
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
