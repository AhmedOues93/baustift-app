/* eslint-disable */
// @ts-nocheck
/**
 * =============================================================================
 * Supabase-Ersatz für den Rauchtest — NICHT Teil der Anwendung
 * =============================================================================
 * scripts/rauchtest.sh schiebt diese Datei vorübergehend an die Stelle von
 * src/lib/supabase/server.ts, baut die App und ruft ihre Routen auf. So lässt
 * sich prüfen, ob die Routen im echten Next-Bündel funktionieren — ohne eine
 * Supabase-Instanz und ohne echte Kundendaten.
 *
 * WARUM DAS SEIN MUSS: Vitest löst alle Module gegen dasselbe node_modules
 * auf. Ein Bauteil kann dort einwandfrei laufen und im gebauten Next trotzdem
 * scheitern — genau so ist die PDF-Erzeugung wochenlang unbemerkt kaputt
 * gewesen, während die Tests grün waren. Getestet wird hier deshalb nicht die
 * Logik, sondern der Weg durch die gebaute Anwendung.
 *
 * Die Daten sind erfunden und bleiben es. Niemals echte Zugangsdaten oder
 * echte Kunden hier eintragen.
 */
const USER = { id: "u1", email: "michael@schulz-sanitaer.de" };
const PROFIL = { id:"u1", firma_name:"Schulz Sanitär GmbH", inhaber_name:"Michael Schulz", strasse:"Handwerkerweg 8", plz:"50667", ort:"Köln", telefon:"0221 123456", email:"info@schulz-sanitaer.de", website:"schulz-sanitaer.de", steuernummer:"215/5721/0341", ust_id:"DE123456789", iban:"DE02 3705 0198 0000 1234 56", bic:"COLSDE33", bank_name:"Sparkasse Köln", logo_url:null, kleinunternehmer:false, mwst_satz:19, angebot_gueltig_tage:30, stripe_customer_id:"cus_demo", stripe_subscription_id:"sub_demo", subscription_status:"aktiv", onboarding_am:"2026-01-02T09:00:00Z", av_zugestimmt_am:null, agb_zugestimmt_am:null, created_at:"", updated_at:"" };
const KUNDEN = [
  ["k1","Familie Becker",null,"Lindenstr. 12","50667","Köln"],
  ["k2","Hausverwaltung Nord","Frau Dietrich","Ringstr. 40","50733","Köln"],
  ["k3","Bäckerei Hof",null,"Marktplatz 3","50676","Köln"],
  ["k4","Praxis Dr. Klein","Herr Dr. Klein","Aachener Str. 210","50931","Köln"],
  ["k5","M. Yilmaz",null,"Venloer Str. 88","50823","Köln"],
  ["k6","S. Wagner",null,"Dürener Str. 5","50931","Köln"],
].map(([id,name,ansprechpartner,strasse,plz,ort]: any) => ({ id, user_id:"u1", name, ansprechpartner, strasse, plz, ort, email: id==="k1"?"becker@example.de":null, telefon: id==="k1"?"0221 998877":null, notizen: id==="k1"?"Schlüssel liegt beim Nachbarn, Klingel Meyer.":null, created_at:"", updated_at:"" }));
const PREISE = [
  ["Monteurstunde","Arbeitszeit","h",62],["Anfahrtspauschale","Arbeitszeit","pauschal",45],
  ["Fliesen verlegen 30x60","Fliesenarbeiten","m2",52],["Wandfliesen Bad","Fliesenarbeiten","m2",46.5],
  ["Demontage alte Fliesen","Fliesenarbeiten","m2",28],["Silikonfugen erneuern","Fliesenarbeiten","m",12.5],
  ["Bodengleiche Dusche inkl. Rinne","Sanitär","pauschal",1450],["Duschwanne montieren","Sanitär","stk",189],
  ["Waschtisch inkl. Armatur montieren","Sanitär","stk",240],["WC tauschen inkl. Montage","Sanitär","stk",380],
  ["Vorwandinstallation WC","Sanitär","stk",420],["Heizkörper tauschen","Heizung","stk",310],
  ["Entsorgung Bauschutt","Sonstiges","pauschal",180],
].map(([bezeichnung,kategorie,einheit,einzelpreis]: any,i) => ({ id:`p${i+1}`, user_id:"u1", bezeichnung, beschreibung:null, kategorie, einheit, einzelpreis, stichworte:[], aktiv:true, created_at:"", updated_at:"" }));
const tage = (n:number)=>new Date(Date.now()-n*86400000).toISOString();
const datum = (n:number)=>tage(n).slice(0,10);
const ANGEBOTE = [
  ["a1","k1","AN-2026-0041","Bad komplett, 8 m²","entwurf",2754,523.26,3277.26,0,null,null],
  ["a2","k2","AN-2026-0040","Heizkörper tauschen (4×)","gesendet",1798.32,341.68,2140,2,tage(2),null],
  ["a3","k5","AN-2026-0039","Wasserhahn + Siphon","angenommen",156.3,29.7,186,4,tage(4),tage(3)],
  ["a4","k4","AN-2026-0037","Gäste-WC neu","gesendet",2804.2,532.8,3337,11,tage(11),null],
  ["a5","k6","AN-2026-0035","Warmwasserspeicher","gesendet",1084.03,205.97,1290,13,tage(13),null],
  ["a6","k3","AN-2026-0034","Leitung Küche erneuern","angenommen",2067.23,392.77,2460,15,tage(15),tage(12)],
].map(([id,kunde_id,nummer,titel,status,netto,mwst_betrag,brutto,alter,gesendet,entschieden]: any) => ({
  id, user_id:"u1", kunde_id, nummer, titel, status, datum:datum(alter), gueltig_bis:datum(alter-30),
  audio_path:null, transkript:"Bad komplett, ungefähr acht Quadratmeter…",
  ki_hinweis: id==="a1" ? "Die Grösse der Duschrinne war nicht klar zu verstehen — bitte prüfen." : null,
  netto, mwst_satz:19, mwst_betrag, brutto,
  notiz:"Angebot gültig 30 Tage. Ausführung ca. 5 Arbeitstage nach Materiallieferung.",
  pdf_path:null, gesendet_am:gesendet, entschieden_am:entschieden,
  nachgefasst_am:null, nachfassungen:0, created_at:tage(alter), updated_at:tage(alter),
}));
const POSITIONEN = [
  ["Demontage alte Fliesen",8,"m2",28,false],["Fliesen verlegen 60x60",8,"m2",65,false],
  ["Bodengleiche Dusche inkl. Rinne",1,"pauschal",1450,true],["WC tauschen inkl. Montage",1,"stk",380,false],
  ["Entsorgung Bauschutt",1,"pauschal",180,false],
].map(([bezeichnung,menge,einheit,einzelpreis,pruefen]: any,i) => ({ id:`pos${i+1}`, angebot_id:"a1", pos_nr:i+1, bezeichnung, beschreibung:i<2?"Inkl. Material und Entsorgung.":null, menge, einheit, einzelpreis, gesamtpreis:menge*einzelpreis, preisliste_id:null, zu_pruefen:pruefen, ki_konfidenz:pruefen?0.42:0.95, created_at:"", updated_at:"" }));

const RECHNUNGEN = [
  ["r1","k5","RE-2026-0018","Wasserhahn + Siphon","gestellt",156.3,29.7,186,3,20,null],
  ["r2","k3","RE-2026-0017","Leitung Küche erneuern","gestellt",2067.23,392.77,2460,12,40,null],
  ["r3","k2","RE-2026-0016","Wartung Heizung","gestellt",420,79.8,499.8,30,14,null],
  ["r4","k1","RE-2026-0015","Waschtisch tauschen","bezahlt",240,45.6,285.6,45,14,20],
  ["r5","k4","RE-2026-0014","Rohrbruch Notdienst","bezahlt",380,72.2,452.2,60,14,50],
].map(([id,kunde_id,nummer,titel,status,netto,mwst_betrag,brutto,alter,ziel,bezahltVor]: any) => ({
  id, user_id:"u1", kunde_id, angebot_id:null, nummer, titel, status,
  datum:datum(alter), leistung_von:datum(alter+5), leistung_bis:datum(alter+1),
  zahlungsziel_tage:ziel, faellig_am:datum(alter-ziel),
  netto, mwst_satz:19, mwst_betrag, brutto, notiz:null,
  festgeschrieben_am:tage(alter), bezahlt_am: bezahltVor?tage(bezahltVor):null,
  storniert_am:null, storniert_durch:null,
  gemahnt_am: id==="r2"?tage(4):null, mahnungen: id==="r2"?1:0,
  created_at:tage(alter), updated_at:tage(alter),
}));
// Positionen für zwei Rechnungen: r3 braucht welche, damit der Rauchtest
// auch die E-Rechnung prüfen kann — ohne Positionen lehnt sie zu Recht ab.
const RECHNUNG_POSITIONEN = [
  ["r2","Monteurstunde",1.5,"h",62],
  ["r2","Armatur Grohe Eurosmart",1,"stk",89],
  ["r2","Anfahrtspauschale",1,"pauschal",45],
  ["r3","Wartung Gastherme",1,"pauschal",320],
  ["r3","Monteurstunde",1,"h",62],
  ["r3","Kleinmaterial",1,"pauschal",38],
].map(([rechnung_id,bezeichnung,menge,einheit,einzelpreis]: any,i) => ({ id:`rp${i+1}`, rechnung_id, pos_nr:i+1, bezeichnung, beschreibung:null, menge, einheit, einzelpreis, gesamtpreis:menge*einzelpreis, created_at:"", updated_at:"" }));

const AUFMASS = [{
  id:"auf1", user_id:"u1", kunde_id:"k1", titel:"Bad Lindenstr. 12",
  status:"offen", notiz:null, angebot_id:null, abgeschlossen_am:null,
  created_at:tage(0), updated_at:tage(0),
},{
  id:"auf2", user_id:"u1", kunde_id:"k2", titel:"Treppenhaus streichen",
  status:"abgeschlossen", notiz:null, angebot_id:null, abgeschlossen_am:tage(3),
  created_at:tage(3), updated_at:tage(3),
}];
const AUFMASS_POSITIONEN = [
  ["Bad","Wand 1","flaeche",2.40,2.50,null,1,false,12,"m2","Bad Wand 1: 2,40 mal 2,50",false],
  ["Bad","Wand 2","flaeche",1.80,2.50,null,1,false,10,"m2","Bad Wand 2: 1,80 mal 2,50",false],
  ["Bad","Fenster","flaeche",1.20,1.40,null,1,true,1.68,"m2","abzüglich Fenster 1,20 mal 1,40",false],
  ["Bad","Tür","flaeche",0.90,2.10,null,1,true,1.89,"m2","abzüglich Tür 90 mal 2,10",true],
  ["Bad","Boden","flaeche",2.40,1.80,null,1,false,4.32,"m2","Bad Boden: 2,40 auf 1,80",false],
  ["Bad","Silikonfuge","laenge",8.40,null,null,1,false,8.4,"m","Silikonfuge 8 Meter 40",false],
].map(([raum,bezeichnung,art,laenge,breite,hoehe,anzahl,abzug,wert,einheit,gesprochen,pruefen]: any,i) => ({
  id:`am${i+1}`, aufmass_id:"auf1", pos_nr:i+1, raum, bezeichnung, art,
  laenge, breite, hoehe, anzahl, abzug, wert, einheit, gesprochen,
  zu_pruefen:pruefen, created_at:"", updated_at:"",
}));
/**
 * Was in der echten Datenbank generierte Spalten sind, muss hier von Hand
 * nachgerechnet werden — sonst behauptet der Rauchtest Werte, die Postgres
 * anders ermittelt. Die Regel steht in 0012_aufmass.sql.
 */
function berechnet(tabelle:string, w:any){
  if (tabelle !== "aufmass_positionen") return {};
  const a = w.anzahl ?? 1;
  const einheit = { flaeche:"m2", volumen:"m3", laenge:"m", stueck:"stk" }[w.art as string] ?? "m2";
  const runde = (n:number)=>Math.round(n*1000)/1000;
  let wert: number|null = null;
  if (w.art === "flaeche") wert = w.laenge!=null && w.breite!=null ? runde(a*w.laenge*w.breite) : null;
  else if (w.art === "volumen") wert = w.laenge!=null && w.breite!=null && w.hoehe!=null ? runde(a*w.laenge*w.breite*w.hoehe) : null;
  else if (w.art === "laenge") wert = w.laenge!=null ? runde(a*w.laenge) : null;
  else wert = a;
  return { wert, einheit };
}

const TABELLEN: Record<string, any[]> = { profiles:[PROFIL], kunden:KUNDEN, preisliste:PREISE, angebote:ANGEBOTE, positionen:POSITIONEN, rechnungen:RECHNUNGEN, rechnung_positionen:RECHNUNG_POSITIONEN, ki_nutzung:[], feedback:[], aufmass:AUFMASS, aufmass_positionen:AUFMASS_POSITIONEN };
class Abfrage {
  private zeilen:any[]; private kopfOnly=false; private zaehlen=false;
  private tabelle:string;
  constructor(t:string){ this.tabelle=t; this.zeilen=[...(TABELLEN[t]??[])]; }
  select(_s?:string,o?:any){ if(o?.head)this.kopfOnly=true; if(o?.count)this.zaehlen=true; return this; }
  eq(s:string,w:any){ this.zeilen=this.zeilen.filter(z=>z[s]===w); return this; }
  not(){ return this; }
  is(s:string,w:any){ this.zeilen=this.zeilen.filter(z=>(z[s]??null)===w); return this; }
  in(s:string,w:any[]){ this.zeilen=this.zeilen.filter(z=>w.includes(z[s])); return this; }
  or(){ return this; }
  gte(){ return this; } lte(){ return this; }
  limit(n:number){ this.zeilen=this.zeilen.slice(0,n); return this; }
  order(s:string,o?:any){ const auf=o?.ascending!==false; this.zeilen.sort((a,b)=>{const x=a[s]??"",y=b[s]??"";return (x<y?-1:x>y?1:0)*(auf?1:-1);}); return this; }
  maybeSingle(){ return Promise.resolve({data:this.zeilen[0]??null,error:null}); }
  single(){ return Promise.resolve({data:this.zeilen[0]??null,error:null}); }
  /**
   * Schreiben muss wirklich schreiben.
   *
   * Vorher gab insert() nur sich selbst zurück — ein anschliessendes
   * .select().single() lieferte dann die ERSTE vorhandene Zeile statt der
   * eben angelegten. Ein Rauchtest über eine schreibende Route hätte damit
   * bestanden, ohne irgendetwas zu beweisen. Genau die Sorte Test, die
   * schlimmer ist als keiner.
   */
  insert(werte:any){
    const neue = (Array.isArray(werte)?werte:[werte]).map((w:any,i:number)=>({
      id: w.id ?? `neu-${Date.now()}-${i}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...w,
      ...berechnet(this.tabelle, w),
    }));
    TABELLEN[this.tabelle] = [...(TABELLEN[this.tabelle] ?? []), ...neue];
    this.zeilen = neue;
    return this;
  }
  update(werte:any){
    this.zeilen = this.zeilen.map((z:any)=>Object.assign(z, werte, berechnet(this.tabelle, {...z, ...werte})));
    return this;
  }
  delete(){
    const weg = new Set(this.zeilen.map((z:any)=>z.id));
    TABELLEN[this.tabelle] = (TABELLEN[this.tabelle] ?? []).filter((z:any)=>!weg.has(z.id));
    return this;
  }
  then(auf:any){ return Promise.resolve({ data:this.kopfOnly?null:this.zeilen, count:this.zaehlen?this.zeilen.length:null, error:null }).then(auf); }
}
export function createClient(){ return {
  auth:{ getUser: async()=>({data:{user:USER},error:null}), signOut: async()=>({error:null}) },
  from:(t:string)=>new Abfrage(t),
  rpc: async(n:string)=> n==="angebote_diesen_monat"?{data:6,error:null}:{data:null,error:null},
  storage:{ from:()=>({ createSignedUrl:async()=>({data:null,error:null}), download:async()=>({data:null,error:null}), upload:async()=>({data:null,error:null}), remove:async()=>({data:null,error:null}) }) },
} as any; }
export const createAdminClient = createClient;
