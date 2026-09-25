import "server-only";

import { Resend } from "resend";

import { protokolliereFehler } from "@/lib/protokoll";

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
    protokolliereFehler({ vorgang: "email.versand" }, error);
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

/**
 * Die Nachfrage zu einem Angebot, auf das keine Antwort kam.
 *
 * Der schwierigste Text im Produkt. Er darf nicht drängen — der Kunde hat
 * nichts falsch gemacht, er hat sich noch nicht entschieden, und ein
 * Handwerksbetrieb im Ort kann es sich nicht leisten, aufdringlich zu wirken.
 * Er darf aber auch nicht so zurückhaltend sein, dass er keine Antwort
 * auslöst; dann hätte man ihn sich sparen können.
 *
 * Der Ausweg ist, eine Frage zu stellen statt zu erinnern: offene Punkte,
 * Termin, Preis. Darauf antwortet man. Auf "wir erlauben uns, höflich
 * nachzufragen" antwortet niemand.
 */
export function nachfassNachricht(args: {
  firmaName: string;
  nummer: string;
  titel: string;
  gueltigBis: string | null;
  ansprechpartner: string | null;
  telefon: string | null;
  /** Die wievielte Nachfrage das ist (1 = die erste). */
  stufe: number;
}): { betreff: string; text: string } {
  const anrede = args.ansprechpartner
    ? `Guten Tag ${args.ansprechpartner},`
    : "Guten Tag,";

  const gueltig = args.gueltigBis
    ? `\n\nDas Angebot gilt noch bis zum ${formatDatum(args.gueltigBis)}.`
    : "";

  const einleitung =
    args.stufe <= 1
      ? `vor einiger Zeit haben wir Ihnen unser Angebot${args.titel ? ` für ${args.titel}` : ""} geschickt.`
      : `wir hatten uns zu unserem Angebot${args.titel ? ` für ${args.titel}` : ""} schon einmal gemeldet.`;

  const rueckfragen = args.telefon
    ? `\n\nAm schnellsten geht es telefonisch: ${args.telefon}.`
    : "";

  return {
    betreff:
      args.stufe <= 1
        ? `Nachfrage zu unserem Angebot ${args.nummer}`
        : `Noch einmal: unser Angebot ${args.nummer}`,
    text:
      `${anrede}\n\n` +
      einleitung +
      ` Ich wollte kurz nachfragen, ob dazu noch etwas offen ist — ` +
      `beim Umfang, beim Termin oder beim Preis. Wenn etwas nicht passt, ` +
      `lässt sich das meistens einrichten.` +
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

/**
 * Der Text einer Zahlungserinnerung.
 *
 * Bewusst freundlich und ohne Drohkulisse: beim ersten Mal ist die Rechnung
 * meistens schlicht untergegangen, und der Kunde soll wiederkommen. Es ist
 * eine Erinnerung, keine Mahnung im Sinne des Verzugs — Mahngebühren oder
 * Verzugszinsen setzen wir hier nicht an, das ist eine Entscheidung des
 * Betriebs und keine, die eine Software nebenbei trifft.
 *
 * Ab der zweiten Erinnerung wird der Ton deutlicher, aber nicht unhöflich.
 */
export function mahnungNachricht(args: {
  firmaName: string;
  nummer: string;
  titel: string;
  faelligAm: string | null;
  betrag: string;
  ansprechpartner: string | null;
  telefon: string | null;
  /** Die wievielte Erinnerung das ist (1 = die erste). */
  stufe: number;
}): { betreff: string; text: string } {
  const anrede = args.ansprechpartner
    ? `Guten Tag ${args.ansprechpartner},`
    : "Guten Tag,";

  const faellig = args.faelligAm
    ? ` war am ${formatDatum(args.faelligAm)} fällig`
    : " ist fällig";

  const einleitung =
    args.stufe <= 1
      ? `unsere Rechnung ${args.nummer} über ${args.betrag}${faellig} und ist bei uns noch offen. ` +
        `Vermutlich ist sie im Alltag untergegangen.`
      : `wir kommen auf unsere Rechnung ${args.nummer} über ${args.betrag} zurück. ` +
        `Sie${faellig} und ist weiterhin offen.`;

  const schluss =
    args.stufe <= 1
      ? `Wir bitten Sie, den Betrag in den nächsten Tagen zu überweisen.`
      : `Wir bitten Sie, den Betrag jetzt kurzfristig zu überweisen.`;

  const rueckfragen = args.telefon
    ? `\n\nSollte etwas nicht stimmen oder haben Sie Fragen zur Rechnung, rufen Sie uns gern an: ${args.telefon}.`
    : `\n\nSollte etwas nicht stimmen oder haben Sie Fragen zur Rechnung, melden Sie sich gern.`;

  return {
    betreff:
      args.stufe <= 1
        ? `Zahlungserinnerung zu Rechnung ${args.nummer}`
        : `2. Zahlungserinnerung zu Rechnung ${args.nummer}`,
    text:
      `${anrede}\n\n` +
      einleitung +
      `\n\n${schluss}` +
      `\n\nDie Rechnung${args.titel ? ` für ${args.titel}` : ""} liegt zur Sicherheit noch einmal bei.` +
      rueckfragen +
      `\n\nHat sich die Zahlung mit dieser Nachricht überschnitten, betrachten Sie sie bitte als gegenstandslos.` +
      `\n\nMit freundlichen Grüssen\n${args.firmaName}`,
  };
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}
