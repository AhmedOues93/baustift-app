/**
 * Typen für das Supabase-Schema (siehe supabase/migrations/0001_init.sql).
 *
 * WICHTIG: Alle Zeilen-Typen sind `type` und nicht `interface`. supabase-js
 * verlangt, dass Row/Insert/Update auf `Record<string, unknown>` passen — und
 * genau das erfüllt ein `interface` in TypeScript nicht (es bekommt keine
 * implizite Index-Signatur). Mit `interface` werden alle Insert-/Update-Aufrufe
 * still zu `never` typisiert und jede Abfrage schlägt beim Kompilieren fehl.
 *
 * Hinweis: Diese Datei kann man später auch generieren lassen
 * (`supabase gen types typescript --project-id <id> > src/types/database.ts`).
 * Bis dahin pflegen wir sie von Hand — wichtig ist, dass sie mit dem SQL
 * synchron bleibt.
 */

export type AngebotStatus =
  | "entwurf"
  | "gesendet"
  | "angenommen"
  | "abgelehnt"
  | "nachfassen";

export type EingabeArt = "sprache" | "text" | "kopie" | "aufmass";
export type AufmassStatus = "offen" | "abgeschlossen";
/** Wie ein Mass gerechnet wird — bestimmt zugleich die Einheit (0012). */
export type MessungArt = "flaeche" | "laenge" | "volumen" | "stueck";
export type FeedbackArt = "problem" | "idee" | "lob";

export const FEEDBACK_ART_LABEL: Record<FeedbackArt, string> = {
  problem: "Etwas geht nicht",
  idee: "Idee oder Wunsch",
  lob: "Das war gut",
};

export type RechnungStatus = "entwurf" | "gestellt" | "bezahlt" | "storniert";

export const RECHNUNG_STATUS_LABEL: Record<RechnungStatus, string> = {
  entwurf: "Entwurf",
  gestellt: "Gestellt",
  bezahlt: "Bezahlt",
  storniert: "Storniert",
};

export type Einheit =
  | "stk"
  | "m"
  | "m2"
  | "m3"
  | "h"
  | "tag"
  | "pauschal"
  | "kg"
  | "l";

/** Anzeigetexte für die Einheiten (UI + PDF). */
export const EINHEIT_LABEL: Record<Einheit, string> = {
  stk: "Stk.",
  m: "m",
  m2: "m²",
  m3: "m³",
  h: "Std.",
  tag: "Tag",
  pauschal: "pauschal",
  kg: "kg",
  l: "l",
};

export const ANGEBOT_STATUS_LABEL: Record<AngebotStatus, string> = {
  entwurf: "Entwurf",
  gesendet: "Gesendet",
  angenommen: "Angenommen",
  abgelehnt: "Abgelehnt",
  nachfassen: "Nachfassen",
};

export type Profile = {
  id: string;
  firma_name: string;
  inhaber_name: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  telefon: string | null;
  email: string | null;
  website: string | null;
  steuernummer: string | null;
  ust_id: string | null;
  iban: string | null;
  bic: string | null;
  bank_name: string | null;
  logo_url: string | null;
  kleinunternehmer: boolean;
  mwst_satz: number;
  angebot_gueltig_tage: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string;
  /** Zeit des zuletzt verarbeiteten Stripe-Ereignisses (0015). */
  stripe_ereignis_am: string | null;
  onboarding_am: string | null;
  av_zugestimmt_am: string | null;
  agb_zugestimmt_am: string | null;
  created_at: string;
  updated_at: string;
};

export type Kunde = {
  id: string;
  user_id: string;
  name: string;
  ansprechpartner: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  notizen: string | null;
  created_at: string;
  updated_at: string;
};

export type PreislisteEintrag = {
  id: string;
  user_id: string;
  bezeichnung: string;
  beschreibung: string | null;
  kategorie: string | null;
  einheit: Einheit;
  einzelpreis: number;
  stichworte: string[];
  aktiv: boolean;
  created_at: string;
  updated_at: string;
};

export type Angebot = {
  id: string;
  user_id: string;
  kunde_id: string | null;
  nummer: string;
  titel: string;
  status: AngebotStatus;
  datum: string;
  gueltig_bis: string | null;
  audio_path: string | null;
  transkript: string | null;
  ki_hinweis: string | null;
  netto: number;
  mwst_satz: number;
  mwst_betrag: number;
  brutto: number;
  notiz: string | null;
  pdf_path: string | null;
  gesendet_am: string | null;
  entschieden_am: string | null;
  /** Letzte Nachfrage beim Kunden (0010_nachfassen.sql). */
  nachgefasst_am: string | null;
  /** Wie oft schon nachgehakt wurde. 0 = noch gar nicht. */
  nachfassungen: number;
  /** Nur im Piloten erhoben: Sprache oder Tastatur. */
  eingabe_art: EingabeArt | null;
  aufnahme_sekunden: number | null;
  created_at: string;
  updated_at: string;
};

export type Position = {
  id: string;
  angebot_id: string;
  pos_nr: number;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
  /** Von Postgres berechnet (generated column) — nie selbst schreiben. */
  gesamtpreis: number;
  preisliste_id: string | null;
  zu_pruefen: boolean;
  ki_konfidenz: number | null;
  created_at: string;
  updated_at: string;
};

export type Rechnung = {
  id: string;
  user_id: string;
  kunde_id: string | null;
  angebot_id: string | null;
  nummer: string;
  titel: string;
  status: RechnungStatus;
  datum: string;
  leistung_von: string | null;
  leistung_bis: string | null;
  zahlungsziel_tage: number;
  faellig_am: string | null;
  netto: number;
  mwst_satz: number;
  mwst_betrag: number;
  brutto: number;
  notiz: string | null;
  /** Gesetzt = unveränderlich (Trigger in 0005_rechnungen.sql). */
  festgeschrieben_am: string | null;
  bezahlt_am: string | null;
  storniert_am: string | null;
  storniert_durch: string | null;
  /** Letzte Zahlungserinnerung an den Kunden (0009_mahnung.sql). */
  gemahnt_am: string | null;
  /** Wie oft schon erinnert wurde. 0 = noch gar nicht. */
  mahnungen: number;
  created_at: string;
  updated_at: string;
};

/**
 * Ein Aufmass — die Session, die der Handwerker beim Messen offen lässt.
 * Langlebig: Pausen, Telefonate und Bildschirmsperren überdauern sie.
 */
export type Aufmass = {
  id: string;
  user_id: string;
  kunde_id: string | null;
  titel: string;
  status: AufmassStatus;
  notiz: string | null;
  /** Das Angebot, das daraus entstanden ist. */
  angebot_id: string | null;
  abgeschlossen_am: string | null;
  created_at: string;
  updated_at: string;
};

/** Eine einzelne Messung. `wert` und `einheit` rechnet die Datenbank (0012). */
export type AufmassPosition = {
  id: string;
  aufmass_id: string;
  pos_nr: number;
  raum: string | null;
  bezeichnung: string;
  art: MessungArt;
  laenge: number | null;
  breite: number | null;
  hoehe: number | null;
  anzahl: number;
  /** Fenster und Türen gehen von der Wandfläche ab. */
  abzug: boolean;
  /** Generiert: null, solange ein nötiges Mass fehlt. */
  wert: number | null;
  /** Generiert aus `art`. */
  einheit: Einheit;
  gesprochen: string | null;
  zu_pruefen: boolean;
  created_at: string;
  updated_at: string;
};

export type RechnungPosition = {
  id: string;
  rechnung_id: string;
  pos_nr: number;
  bezeichnung: string;
  beschreibung: string | null;
  menge: number;
  einheit: Einheit;
  einzelpreis: number;
  /** Von Postgres berechnet. */
  gesamtpreis: number;
  created_at: string;
  updated_at: string;
};

export type Feedback = {
  id: string;
  user_id: string;
  art: FeedbackArt;
  text: string;
  seite: string | null;
  erledigt: boolean;
  created_at: string;
};

/** Zahlen des Piloten, aus der Funktion pilot_auswertung. */
export type PilotAuswertung = {
  angebote_gesamt: number;
  per_sprache: number;
  per_text: number;
  positionen_gesamt: number;
  positionen_zu_pruefen: number;
  sekunden_schnitt: number;
  kosten_zehntelcent: number;
  angebote_gesendet: number;
  angebote_angenommen: number;
};

/** Ein KI-Lauf (Whisper oder Claude) — Grundlage für Kontingent und Marge. */
export type KiNutzung = {
  id: string;
  user_id: string;
  angebot_id: string | null;
  art: "transkription" | "extraktion";
  modell: string;
  eingabe_token: number;
  ausgabe_token: number;
  cache_token: number;
  audio_sekunden: number;
  /** Zehntel-Cent, damit ein Lauf für 0,04 € nicht auf 0 gerundet wird. */
  kosten_zehntelcent: number;
  created_at: string;
};

/**
 * Schema-Definition für den typisierten Supabase-Client.
 * `Insert`/`Update` lassen Felder weg, die die DB selbst setzt
 * (id, Zeitstempel, generierte Spalten).
 */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string };
        Update: Partial<Profile>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
      kunden: {
        Row: Kunde;
        Insert: Omit<Kunde, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Kunde>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
      preisliste: {
        Row: PreislisteEintrag;
        Insert: Omit<PreislisteEintrag, "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<PreislisteEintrag>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
      angebote: {
        Row: Angebot;
        // Die Nachfass-Felder haben Vorgaben in der Datenbank: beim Anlegen
        // wurde noch nie nachgehakt.
        Insert: Omit<
          Angebot,
          "id" | "created_at" | "updated_at" | "nachgefasst_am" | "nachfassungen"
        > & { id?: string; nachgefasst_am?: string | null; nachfassungen?: number };
        Update: Partial<Angebot>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
      feedback: {
        Row: Feedback;
        Insert: Omit<Feedback, "id" | "created_at" | "erledigt"> & {
          id?: string;
          erledigt?: boolean;
        };
        Update: Partial<Feedback>;
        Relationships: [];
      };
      ki_nutzung: {
        Row: KiNutzung;
        Insert: Omit<KiNutzung, "id" | "created_at"> & { id?: string };
        Update: Partial<KiNutzung>;
        Relationships: [];
      };
      aufmass: {
        Row: Aufmass;
        Insert: Omit<Aufmass, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Aufmass>;
        Relationships: [];
      };
      aufmass_positionen: {
        Row: AufmassPosition;
        // `wert` und `einheit` sind generierte Spalten: sie werden nie
        // geschrieben, sondern immer gerechnet.
        Insert: Omit<
          AufmassPosition,
          "id" | "created_at" | "updated_at" | "wert" | "einheit"
        > & { id?: string };
        Update: Partial<Omit<AufmassPosition, "wert" | "einheit">>;
        Relationships: [];
      };
      rechnungen: {
        Row: Rechnung;
        // gemahnt_am und mahnungen haben Vorgaben in der Datenbank: beim
        // Anlegen wurde noch nie erinnert.
        Insert: Omit<
          Rechnung,
          "id" | "created_at" | "updated_at" | "gemahnt_am" | "mahnungen"
        > & { id?: string; gemahnt_am?: string | null; mahnungen?: number };
        Update: Partial<Rechnung>;
        Relationships: [];
      };
      rechnung_positionen: {
        Row: RechnungPosition;
        Insert: Omit<
          RechnungPosition,
          "id" | "gesamtpreis" | "created_at" | "updated_at"
        > & { id?: string };
        Update: Partial<Omit<RechnungPosition, "gesamtpreis">>;
        Relationships: [];
      };
      positionen: {
        Row: Position;
        Insert: Omit<Position, "id" | "gesamtpreis" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Omit<Position, "gesamtpreis">>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      next_angebot_nummer: {
        Args: { p_user_id: string };
        Returns: string;
      };
      next_rechnung_nummer: {
        Args: { p_user_id: string };
        Returns: string;
      };
      pilot_auswertung: {
        Args: { p_user_id: string };
        Returns: PilotAuswertung[];
      };
      angebote_diesen_monat: {
        Args: { p_user_id: string };
        Returns: number;
      };
      // Anfragebremse: zählt die KI-Anfragen des Nutzers im Zeitfenster und
      // trägt die aktuelle gleich mit ein. false = Fenster ist voll.
      ki_anfrage_erlaubt: {
        Args: {
          p_user_id: string;
          p_max?: number;
          p_fenster_sekunden?: number;
          /** Getrennte Zähler je Vorgang (0013): "angebot", "aufmass". */
          p_art?: string;
        };
        Returns: boolean;
      };
      suche_preisliste: {
        Args: { p_suchtext: string; p_limit?: number; p_min_score?: number };
        Returns: {
          id: string;
          bezeichnung: string;
          kategorie: string | null;
          einheit: Einheit;
          einzelpreis: number;
          score: number;
        }[];
      };
    };
    Enums: {
      angebot_status: AngebotStatus;
      rechnung_status: RechnungStatus;
      eingabe_art: EingabeArt;
      feedback_art: FeedbackArt;
      einheit: Einheit;
      aufmass_status: AufmassStatus;
      messung_art: MessungArt;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
