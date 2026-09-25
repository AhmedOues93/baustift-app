import "server-only";

import type { Kunde, Profile, Rechnung, RechnungPosition } from "@/types/database";

function xml(v: unknown): string {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function datum(iso: string | null): string {
  return (iso ?? "").slice(0, 10).replaceAll("-", "");
}

function zahl(n: number): string {
  return Number(n || 0).toFixed(2);
}

function einheit(e: string): string {
  const codes: Record<string, string> = {
    stk: "C62", m: "MTR", m2: "MTK", m3: "MTQ", h: "HUR",
    tag: "DAY", pauschal: "C62", kg: "KGM", l: "LTR",
  };
  return codes[e] ?? "C62";
}

/**
 * Maschinenlesbare Rechnungsdaten nach EN-16931/Factur-X (ZUGFeRD EN16931).
 * Die XML-Datei ist bewusst separat erzeugbar. Fuer eine vollwertige hybride
 * ZUGFeRD-PDF/A-3 muss sie anschliessend als factur-x.xml in PDF/A-3 eingebettet
 * und mit einem externen EN-16931-Validator geprueft werden.
 */
export function rechnungEn16931Xml(args: {
  rechnung: Rechnung;
  positionen: RechnungPosition[];
  kunde: Kunde;
  firma: Profile;
}): string {
  const { rechnung: r, positionen, kunde: k, firma: f } = args;
  const fehlt: string[] = [];
  if (!f.firma_name) fehlt.push("Firmenname");
  if (!f.strasse) fehlt.push("Firmenstrasse");
  if (!f.plz) fehlt.push("Firmen-PLZ");
  if (!f.ort) fehlt.push("Firmenort");
  if (!f.ust_id && !f.steuernummer) fehlt.push("USt-IdNr. oder Steuernummer");
  if (!k.name) fehlt.push("Kundenname");
  if (!k.strasse) fehlt.push("Kundenstrasse");
  if (!k.plz) fehlt.push("Kunden-PLZ");
  if (!k.ort) fehlt.push("Kundenort");
  if (!r.leistung_von) fehlt.push("Leistungsdatum");
  if (!positionen.length) fehlt.push("Rechnungspositionen");
  if (fehlt.length) throw new Error(`E-Rechnung unvollstaendig: ${fehlt.join(", ")}.`);

  const sellerTax = f.ust_id
    ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${xml(f.ust_id)}</ram:ID></ram:SpecifiedTaxRegistration>`
    : `<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">${xml(f.steuernummer)}</ram:ID></ram:SpecifiedTaxRegistration>`;

  const lines = positionen.map((p, i) => `
    <ram:IncludedSupplyChainTradeLineItem>
      <ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>
      <ram:SpecifiedTradeProduct><ram:Name>${xml(p.bezeichnung)}</ram:Name>${p.beschreibung ? `<ram:Description>${xml(p.beschreibung)}</ram:Description>` : ""}</ram:SpecifiedTradeProduct>
      <ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${zahl(p.einzelpreis)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>
      <ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${einheit(p.einheit)}">${zahl(p.menge)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>
      <ram:SpecifiedLineTradeSettlement>
        <ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${r.mwst_satz > 0 ? "S" : "E"}</ram:CategoryCode><ram:RateApplicablePercent>${zahl(r.mwst_satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
        <ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${zahl(p.gesamtpreis)}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>
      </ram:SpecifiedLineTradeSettlement>
    </ram:IncludedSupplyChainTradeLineItem>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument><ram:ID>${xml(r.nummer)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${datum(r.datum)}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    ${lines}
    <ram:ApplicableHeaderTradeAgreement>
      <ram:SellerTradeParty><ram:Name>${xml(f.firma_name)}</ram:Name><ram:PostalTradeAddress><ram:PostcodeCode>${xml(f.plz)}</ram:PostcodeCode><ram:LineOne>${xml(f.strasse)}</ram:LineOne><ram:CityName>${xml(f.ort)}</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>${sellerTax}</ram:SellerTradeParty>
      <ram:BuyerTradeParty><ram:Name>${xml(k.name)}</ram:Name><ram:PostalTradeAddress><ram:PostcodeCode>${xml(k.plz)}</ram:PostcodeCode><ram:LineOne>${xml(k.strasse)}</ram:LineOne><ram:CityName>${xml(k.ort)}</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress></ram:BuyerTradeParty>
    </ram:ApplicableHeaderTradeAgreement>
    <ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${datum(r.leistung_von)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>
    <ram:ApplicableHeaderTradeSettlement>
      <ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>
      <ram:ApplicableTradeTax><ram:CalculatedAmount>${zahl(r.mwst_betrag)}</ram:CalculatedAmount><ram:TypeCode>VAT</ram:TypeCode><ram:BasisAmount>${zahl(r.netto)}</ram:BasisAmount><ram:CategoryCode>${r.mwst_satz > 0 ? "S" : "E"}</ram:CategoryCode><ram:RateApplicablePercent>${zahl(r.mwst_satz)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>
      ${f.iban ? `<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>${xml(f.iban.replaceAll(" ", ""))}</ram:IBANID></ram:PayeePartyCreditorFinancialAccount></ram:SpecifiedTradeSettlementPaymentMeans>` : ""}
      ${r.faellig_am ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${datum(r.faellig_am)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : ""}
      <ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>${zahl(r.netto)}</ram:LineTotalAmount><ram:TaxBasisTotalAmount>${zahl(r.netto)}</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">${zahl(r.mwst_betrag)}</ram:TaxTotalAmount><ram:GrandTotalAmount>${zahl(r.brutto)}</ram:GrandTotalAmount><ram:DuePayableAmount>${zahl(r.brutto)}</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>
    </ram:ApplicableHeaderTradeSettlement>
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>`;
}
