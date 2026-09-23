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
        Insert: Omit<Angebot, "id" | "created_at" | "updated_at"> & { id?: string };
        Update: Partial<Angebot>;
        /** Von supabase-js verlangt; wir nutzen keine eingebetteten Joins. */
        Relationships: [];
      };
      ki_nutzung: {
        Row: KiNutzung;
        Insert: Omit<KiNutzung, "id" | "created_at"> & { id?: string };
        Update: Partial<KiNutzung>;
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
      angebote_diesen_monat: {
        Args: { p_user_id: string };
        Returns: number;
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
      einheit: Einheit;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
