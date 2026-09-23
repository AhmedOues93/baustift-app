import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";

import { formatEuro } from "@/lib/format";
import { EINHEIT_LABEL, type Einheit, type Kunde, type Profile } from "@/types/database";

/**
 * =============================================================================
 * Geschäftsbeleg als PDF — Angebot oder Rechnung
 * =============================================================================
 * Ein Bauplan für beide Belegarten. Angebot und Rechnung unterscheiden sich in
 * Deutschland in einer Handvoll Zeilen (Überschrift, Gültigkeit gegen
 * Leistungszeitraum, Zahlungsziel, Bankverbindung) — nicht im Aufbau. Zwei
 * getrennte Vorlagen würden garantiert auseinanderlaufen, und dann sieht die
 * Rechnung desselben Betriebs anders aus als sein Angebot.
 *
 * Aufbau nach DIN 5008: Briefkopf rechts, Anschriftenfeld links,
 * Positionstabelle, Summenblock rechts, Pflichtangaben in der Fusszeile.
 *
 * Bewusste Entscheidungen:
 *
 *  - KEIN Elfenbein, kein Terrakotta. Ein Beleg wird schwarzweiss gedruckt und
 *    gefaxt (ja, immer noch). Farbe als Dekoration kostet hier nur Lesbarkeit.
 *    Die Markenfarbe erscheint einzig als dünne Linie unter dem Briefkopf.
 *  - Die Schriften sind die PDF-Standardschriften (Helvetica). Eigene Fonts
 *    müssten als Datei eingebettet werden; das verdoppelt die Dateigrösse und
 *    bringt auf einem Geschäftsbrief nichts.
 *  - Beträge rechtsbündig, damit die Spalte beim Überfliegen stimmt.
 *  - Die Pflichtangaben (§14 UStG, §19 UStG) entstehen automatisch aus den
 *    Daten — genau die Stellen, an denen ein Handwerker sonst Ärger bekommt.
 */

export interface BelegPosition {
  id: string;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
  gesamtpreis: number;
}

export interface BelegDaten {
  art: "angebot" | "rechnung";
  nummer: string;
  titel: string;
  datum: string;
  netto: number;
  mwstSatz: number;
  mwstBetrag: number;
  brutto: number;
  notiz: string | null;
  /** Nur Angebot. */
  gueltigBis?: string | null;
  /** Nur Rechnung: Leistungszeitpunkt ist Pflichtangabe nach §14 UStG. */
  leistungVon?: string | null;
  leistungBis?: string | null;
  faelligAm?: string | null;
  /** Nur Rechnung: Vermerk bei einer Stornorechnung. */
  storniert?: boolean;
}

const FARBE = {
  text: "#1B1A17",
  leise: "#5F5A50",
  linie: "#E2DCCF",
  akzent: "#C2410C",
};

const stil = StyleSheet.create({
  seite: {
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 50,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: FARBE.text,
    lineHeight: 1.45,
  },

  kopf: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  logo: { maxWidth: 130, maxHeight: 52, objectFit: "contain" },
  absender: { textAlign: "right", fontSize: 8.5, color: FARBE.leise },
  absenderName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: FARBE.text },
  trenner: { marginTop: 14, borderBottomWidth: 1.5, borderBottomColor: FARBE.akzent },

  anschriftBlock: { marginTop: 34, minHeight: 70 },
  ruecksender: {
    fontSize: 7,
    color: FARBE.leise,
    borderBottomWidth: 0.5,
    borderBottomColor: FARBE.linie,
    paddingBottom: 2,
    marginBottom: 6,
  },

  titelzeile: {
    marginTop: 26,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  titel: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  metaZeile: { fontSize: 8.5, color: FARBE.leise, textAlign: "right" },

  projekt: { marginTop: 12, fontSize: 10, fontFamily: "Helvetica-Bold" },

  tabellenKopf: {
    flexDirection: "row",
    marginTop: 18,
    paddingBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: FARBE.text,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  zeile: {
    flexDirection: "row",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: FARBE.linie,
  },

  // Summe exakt 100 %; die letzte Spalte bekommt etwas mehr Luft, damit
  // weder die Überschrift noch ein vierstelliger Betrag am Rand anstösst.
  spPos: { width: "6%" },
  spLeistung: { width: "42%", paddingRight: 10 },
  spMenge: { width: "14%", textAlign: "right", paddingRight: 6 },
  spEp: { width: "17%", textAlign: "right", paddingRight: 6 },
  spGp: { width: "21%", textAlign: "right" },

  beschreibung: { fontSize: 8.5, color: FARBE.leise, marginTop: 2 },

  summenBlock: { marginTop: 14, flexDirection: "row", justifyContent: "flex-end" },
  summen: { width: "52%" },
  summenZeile: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  summenGesamt: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 5,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: FARBE.text,
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
  },

  hinweis: { marginTop: 22, fontSize: 9 },
  paragraf19: { marginTop: 10, fontSize: 8.5, color: FARBE.leise },

  fuss: {
    position: "absolute",
    bottom: 32,
    left: 50,
    right: 50,
    borderTopWidth: 0.5,
    borderTopColor: FARBE.linie,
    paddingTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7.5,
    color: FARBE.leise,
  },
  fussSpalte: { width: "32%" },
  seitenzahl: {
    position: "absolute",
    bottom: 18,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 7.5,
    color: FARBE.leise,
  },
});

export interface BelegPdfProps {
  beleg: BelegDaten;
  positionen: BelegPosition[];
  kunde: Kunde | null;
  firma: Profile;
  /** Als Data-URL eingebettet; das PDF muss ohne Netz funktionieren. */
  logoDataUrl: string | null;
}

export function BelegPdf({
  beleg,
  positionen,
  kunde,
  firma,
  logoDataUrl,
}: BelegPdfProps) {
  const anschriftFirma = [
    firma.firma_name,
    firma.strasse,
    [firma.plz, firma.ort].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(" · ");

  const istRechnung = beleg.art === "rechnung";
  const ueberschrift = istRechnung
    ? beleg.storniert
      ? "Stornorechnung"
      : "Rechnung"
    : "Angebot";

  return (
    <Document
      title={`${ueberschrift} ${beleg.nummer}`}
      author={firma.firma_name}
      creator="Baustift"
    >
      <Page size="A4" style={stil.seite}>
        {/* --- Briefkopf --- */}
        <View style={stil.kopf}>
          <View>
            {logoDataUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={logoDataUrl} style={stil.logo} />
            ) : (
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold" }}>
                {firma.firma_name}
              </Text>
            )}
          </View>

          <View style={stil.absender}>
            <Text style={stil.absenderName}>{firma.firma_name}</Text>
            {firma.inhaber_name ? <Text>{firma.inhaber_name}</Text> : null}
            {firma.strasse ? <Text>{firma.strasse}</Text> : null}
            {firma.plz || firma.ort ? (
              <Text>{[firma.plz, firma.ort].filter(Boolean).join(" ")}</Text>
            ) : null}
            {firma.telefon ? <Text>Tel. {firma.telefon}</Text> : null}
            {firma.email ? <Text>{firma.email}</Text> : null}
          </View>
        </View>
        <View style={stil.trenner} />

        {/* --- Anschriftenfeld --- */}
        <View style={stil.anschriftBlock}>
          {anschriftFirma ? (
            <Text style={stil.ruecksender}>{anschriftFirma}</Text>
          ) : null}
          {kunde ? (
            <>
              <Text>{kunde.name}</Text>
              {kunde.ansprechpartner ? <Text>{kunde.ansprechpartner}</Text> : null}
              {kunde.strasse ? <Text>{kunde.strasse}</Text> : null}
              {kunde.plz || kunde.ort ? (
                <Text>{[kunde.plz, kunde.ort].filter(Boolean).join(" ")}</Text>
              ) : null}
            </>
          ) : (
            <Text style={{ color: FARBE.leise }}>— kein Kunde zugeordnet —</Text>
          )}
        </View>

        {/* --- Titel und Eckdaten --- */}
        <View style={stil.titelzeile}>
          <Text style={stil.titel}>{ueberschrift}</Text>
          <View style={stil.metaZeile}>
            <Text>Nr. {beleg.nummer}</Text>
            <Text>Datum {formatDatum(beleg.datum)}</Text>
            {beleg.gueltigBis ? (
              <Text>Gültig bis {formatDatum(beleg.gueltigBis)}</Text>
            ) : null}
            {/* §14 UStG: der Zeitpunkt der Leistung gehört auf die Rechnung. */}
            {istRechnung && beleg.leistungVon ? (
              <Text>
                {beleg.leistungBis && beleg.leistungBis !== beleg.leistungVon
                  ? `Leistung ${formatDatum(beleg.leistungVon)} – ${formatDatum(beleg.leistungBis)}`
                  : `Leistungsdatum ${formatDatum(beleg.leistungVon)}`}
              </Text>
            ) : null}
          </View>
        </View>

        {beleg.titel ? <Text style={stil.projekt}>{beleg.titel}</Text> : null}

        {/* --- Positionen --- */}
        <View style={stil.tabellenKopf}>
          <Text style={stil.spPos}>Pos</Text>
          <Text style={stil.spLeistung}>Leistung</Text>
          <Text style={stil.spMenge}>Menge</Text>
          <Text style={stil.spEp}>Einzelpreis</Text>
          <Text style={stil.spGp}>Gesamt</Text>
        </View>

        {positionen.map((p, i) => (
          // wrap={false}: eine Position soll nicht mitten im Text umbrechen.
          <View key={p.id} style={stil.zeile} wrap={false}>
            <Text style={stil.spPos}>{i + 1}</Text>
            <View style={stil.spLeistung}>
              <Text>{p.bezeichnung}</Text>
              {p.beschreibung ? (
                <Text style={stil.beschreibung}>{p.beschreibung}</Text>
              ) : null}
            </View>
            <Text style={stil.spMenge}>
              {formatMenge(p.menge)} {EINHEIT_LABEL[p.einheit]}
            </Text>
            <Text style={stil.spEp}>{formatEuro(p.einzelpreis)}</Text>
            <Text style={stil.spGp}>{formatEuro(p.gesamtpreis)}</Text>
          </View>
        ))}

        {/* --- Summen --- */}
        <View style={stil.summenBlock} wrap={false}>
          <View style={stil.summen}>
            <View style={stil.summenZeile}>
              <Text>Nettobetrag</Text>
              <Text>{formatEuro(beleg.netto)}</Text>
            </View>
            {beleg.mwstSatz > 0 ? (
              <View style={stil.summenZeile}>
                <Text>zzgl. {formatProzent(beleg.mwstSatz)} MwSt.</Text>
                <Text>{formatEuro(beleg.mwstBetrag)}</Text>
              </View>
            ) : null}
            <View style={stil.summenGesamt}>
              <Text>{istRechnung ? "Rechnungsbetrag" : "Gesamtbetrag"}</Text>
              <Text>{formatEuro(beleg.brutto)}</Text>
            </View>
          </View>
        </View>

        {/* --- Zahlungsbedingungen (nur Rechnung) --- */}
        {istRechnung && beleg.faelligAm ? (
          <Text style={stil.hinweis}>
            {beleg.storniert
              ? "Diese Stornorechnung hebt die ursprüngliche Rechnung auf."
              : `Zahlbar ohne Abzug bis zum ${formatDatum(beleg.faelligAm)}` +
                (firma.iban
                  ? ` auf das Konto ${firma.iban}${firma.bank_name ? ` (${firma.bank_name})` : ""}.`
                  : ".") +
                ` Bitte geben Sie bei der Überweisung die Rechnungsnummer ${beleg.nummer} an.`}
          </Text>
        ) : null}

        {/* --- Schlusstext --- */}
        {beleg.notiz ? <Text style={stil.hinweis}>{beleg.notiz}</Text> : null}

        {firma.kleinunternehmer ? (
          <Text style={stil.paragraf19}>
            Gemäss §19 UStG wird keine Umsatzsteuer berechnet.
          </Text>
        ) : null}

        {/* --- Fusszeile mit den Pflichtangaben --- */}
        <View style={stil.fuss} fixed>
          <View style={stil.fussSpalte}>
            <Text>{firma.firma_name}</Text>
            {firma.strasse ? <Text>{firma.strasse}</Text> : null}
            {firma.plz || firma.ort ? (
              <Text>{[firma.plz, firma.ort].filter(Boolean).join(" ")}</Text>
            ) : null}
          </View>
          <View style={stil.fussSpalte}>
            {firma.steuernummer ? <Text>St.-Nr. {firma.steuernummer}</Text> : null}
            {firma.ust_id ? <Text>USt-IdNr. {firma.ust_id}</Text> : null}
            {firma.website ? <Text>{firma.website}</Text> : null}
          </View>
          <View style={stil.fussSpalte}>
            {firma.bank_name ? <Text>{firma.bank_name}</Text> : null}
            {firma.iban ? <Text>IBAN {firma.iban}</Text> : null}
            {firma.bic ? <Text>BIC {firma.bic}</Text> : null}
          </View>
        </View>

        <Text
          style={stil.seitenzahl}
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? `Seite ${pageNumber} von ${totalPages}` : ""
          }
          fixed
        />
      </Page>
    </Document>
  );
}

function formatDatum(iso: string): string {
  const [jahr, monat, tag] = iso.slice(0, 10).split("-");
  return `${tag}.${monat}.${jahr}`;
}

function formatMenge(n: number): string {
  return String(n).replace(".", ",");
}

function formatProzent(n: number): string {
  return `${String(n).replace(".00", "").replace(".", ",")} %`;
}
