-- =============================================================================
-- Baustift — Initiales Schema
-- =============================================================================
-- Ausführen im Supabase SQL-Editor oder via `supabase db push`.
--
-- Grundprinzip für die Sicherheit: JEDE Tabelle hat eine `user_id` und Row Level
-- Security (RLS). Dadurch sieht ein Handwerker ausschliesslich seine eigenen
-- Daten — auch wenn im Frontend ein Filter vergessen wird, gibt Postgres nichts
-- Fremdes heraus.
-- =============================================================================

-- pg_trgm = Trigramm-Suche. Brauchen wir später fürs Preis-Matching:
-- damit finden wir "Fliesen verlegen" auch wenn Claude "Fliesenarbeiten"
-- transkribiert hat (unscharfe Ähnlichkeitssuche statt exaktem Textvergleich).
create extension if not exists pg_trgm;

-- -----------------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------------

-- Lebenszyklus eines Angebots (Dashboard-Filter im MVP).
create type angebot_status as enum (
  'entwurf',      -- Entwurf, noch nicht verschickt
  'gesendet',     -- an den Kunden geschickt
  'angenommen',   -- Auftrag erhalten
  'abgelehnt',    -- Kunde hat abgesagt
  'nachfassen'    -- keine Rückmeldung -> nachhaken
);

-- Einheiten wie sie im Handwerk auf der Rechnung stehen.
create type einheit as enum (
  'stk',   -- Stück
  'm',     -- laufender Meter
  'm2',    -- Quadratmeter
  'm3',    -- Kubikmeter
  'h',     -- Stunde
  'tag',   -- Tag
  'pauschal',
  'kg',
  'l'
);

-- -----------------------------------------------------------------------------
-- profiles — Firmendaten des Handwerkers (1:1 zu auth.users)
-- -----------------------------------------------------------------------------
-- Supabase verwaltet Login/Passwort in `auth.users`. Diese Tabelle darf man nicht
-- erweitern, deshalb hängen wir alle App-Daten hier dran (gleiche id als PK).
-- Diese Felder landen 1:1 im Angebots-PDF (Briefkopf + Fusszeile).
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,

  firma_name        text not null default '',
  inhaber_name      text,
  strasse           text,
  plz               text,
  ort               text,
  telefon           text,
  email             text,
  website           text,

  -- Pflichtangaben auf deutschen Rechnungen/Angeboten
  steuernummer      text,
  ust_id            text,          -- USt-IdNr. (DE…)
  iban              text,
  bic               text,
  bank_name         text,

  logo_url          text,          -- Pfad im Supabase-Storage-Bucket "logos"

  -- Kleinunternehmer nach §19 UStG weisen KEINE MwSt aus.
  -- Ist das true, rechnet die App mit 0 % und druckt den §19-Hinweis ins PDF.
  kleinunternehmer  boolean not null default false,
  mwst_satz         numeric(5, 2) not null default 19.00,

  -- Standard-Gültigkeit eines Angebots in Tagen ("Dieses Angebot gilt bis …").
  angebot_gueltig_tage integer not null default 30,

  -- Stripe-Abo
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  subscription_status    text not null default 'trial',

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- kunden — Auftraggeber des Handwerkers
-- -----------------------------------------------------------------------------
create table public.kunden (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,

  name            text not null,     -- Firma oder Privatperson
  ansprechpartner text,
  strasse         text,
  plz             text,
  ort             text,
  email           text,
  telefon         text,
  notizen         text,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index kunden_user_id_idx on public.kunden (user_id);
create index kunden_name_trgm_idx on public.kunden using gin (name gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- preisliste — eigene Leistungen + Preise des Handwerkers
-- -----------------------------------------------------------------------------
-- Das ist das Herz der App: Claude ordnet die diktierten Leistungen diesen
-- Einträgen zu. Je besser gepflegt, desto weniger muss der Nutzer nacharbeiten.
create table public.preisliste (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  bezeichnung  text not null,                  -- z. B. "Fliesen verlegen 30x60"
  beschreibung text,                           -- Langtext fürs PDF
  kategorie    text,                           -- z. B. "Fliesenarbeiten", "Sanitär"
  einheit      einheit not null default 'stk',
  einzelpreis  numeric(12, 2) not null default 0,

  -- Synonyme/Stichwörter, die der Kunde beim Diktieren benutzt
  -- ("Bad fliesen", "verfliesen"). Verbessert das Matching deutlich.
  stichworte   text[] not null default '{}',

  aktiv        boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index preisliste_user_id_idx on public.preisliste (user_id);
-- Trigramm-Index: macht die unscharfe Suche (`similarity()`) schnell.
create index preisliste_bezeichnung_trgm_idx
  on public.preisliste using gin (bezeichnung gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- angebote — Kopfdaten eines Angebots
-- -----------------------------------------------------------------------------
create table public.angebote (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  -- Kunde darf gelöscht werden, ohne das Angebot zu zerstören -> set null.
  kunde_id       uuid references public.kunden (id) on delete set null,

  nummer         text not null,               -- z. B. "AN-2026-0007"
  titel          text not null default '',    -- z. B. "Badsanierung Musterstr. 4"
  status         angebot_status not null default 'entwurf',

  datum          date not null default current_date,
  gueltig_bis    date,

  -- Rohmaterial aus dem Sprach-Workflow (für Nachvollziehbarkeit & Debugging
  -- des Prompts: was wurde diktiert, was hat Claude daraus gemacht).
  audio_path     text,                        -- Storage-Bucket "audio"
  transkript     text,                        -- Whisper-Ausgabe
  ki_hinweis     text,                        -- Anmerkungen von Claude an den Nutzer

  -- Summen werden bei jeder Positionsänderung neu berechnet (Trigger unten).
  -- Redundant zu den Positionen, aber: das Dashboard listet hunderte Angebote
  -- und soll nicht jedes Mal alle Positionen aufsummieren müssen.
  netto          numeric(12, 2) not null default 0,
  mwst_satz      numeric(5, 2)  not null default 19.00,
  mwst_betrag    numeric(12, 2) not null default 0,
  brutto         numeric(12, 2) not null default 0,

  notiz          text,                        -- Schlusstext im PDF
  pdf_path       text,                        -- Storage-Bucket "angebote"

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  -- Angebotsnummern müssen pro Firma eindeutig sein (nicht global).
  unique (user_id, nummer)
);

create index angebote_user_id_idx on public.angebote (user_id);
create index angebote_status_idx on public.angebote (user_id, status);
create index angebote_created_at_idx on public.angebote (user_id, created_at desc);

-- -----------------------------------------------------------------------------
-- positionen — Zeilen eines Angebots
-- -----------------------------------------------------------------------------
create table public.positionen (
  id            uuid primary key default gen_random_uuid(),
  angebot_id    uuid not null references public.angebote (id) on delete cascade,

  -- Reihenfolge im PDF (1, 2, 3 …)
  pos_nr        integer not null default 1,

  bezeichnung   text not null,
  beschreibung  text,
  menge         numeric(12, 3) not null default 1,
  einheit       einheit not null default 'stk',
  einzelpreis   numeric(12, 2) not null default 0,
  -- Generierte Spalte: Postgres rechnet, das Frontend kann nicht abweichen.
  gesamtpreis   numeric(12, 2)
                generated always as (round(menge * einzelpreis, 2)) stored,

  -- Herkunft der Zeile (fürs Review-UI):
  -- preisliste_id gesetzt  -> Preis kommt aus der Preisliste
  -- zu_pruefen = true      -> Claude hat keinen sicheren Treffer gefunden,
  --                           der Nutzer muss Preis/Menge bestätigen
  preisliste_id uuid references public.preisliste (id) on delete set null,
  zu_pruefen    boolean not null default false,
  ki_konfidenz  numeric(3, 2),   -- 0.00 – 1.00, von Claude geschätzt

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index positionen_angebot_id_idx on public.positionen (angebot_id, pos_nr);

-- =============================================================================
-- Trigger
-- =============================================================================

-- updated_at automatisch pflegen
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch    before update on public.profiles    for each row execute function public.touch_updated_at();
create trigger kunden_touch      before update on public.kunden      for each row execute function public.touch_updated_at();
create trigger preisliste_touch  before update on public.preisliste  for each row execute function public.touch_updated_at();
create trigger angebote_touch    before update on public.angebote    for each row execute function public.touch_updated_at();
create trigger positionen_touch  before update on public.positionen  for each row execute function public.touch_updated_at();

-- Bei Registrierung automatisch ein leeres Profil anlegen, damit die App nie
-- auf ein fehlendes Profil läuft. `security definer`, weil der Trigger im
-- Kontext des Auth-Schemas läuft.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, firma_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'firma_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Summen des Angebots neu berechnen, sobald sich eine Position ändert.
-- So bleiben netto/mwst/brutto garantiert konsistent — egal ob die Änderung aus
-- dem Review-Screen, aus der KI-Pipeline oder per SQL kommt.
create or replace function public.recalc_angebot_summen()
returns trigger
language plpgsql
as $$
declare
  v_angebot_id uuid := coalesce(new.angebot_id, old.angebot_id);
  v_netto      numeric(12, 2);
  v_satz       numeric(5, 2);
begin
  select coalesce(sum(gesamtpreis), 0) into v_netto
  from public.positionen where angebot_id = v_angebot_id;

  select mwst_satz into v_satz from public.angebote where id = v_angebot_id;

  update public.angebote
  set netto       = v_netto,
      mwst_betrag = round(v_netto * v_satz / 100, 2),
      brutto      = v_netto + round(v_netto * v_satz / 100, 2)
  where id = v_angebot_id;

  return null;
end;
$$;

create trigger positionen_recalc
  after insert or update or delete on public.positionen
  for each row execute function public.recalc_angebot_summen();

-- Fortlaufende Angebotsnummer pro Firma und Jahr: AN-2026-0001, AN-2026-0002 …
--
-- Zwei Details, die hier wichtig sind:
--  - Wir nehmen das MAXIMUM der bisherigen Nummern, nicht deren Anzahl. Wird
--    ein Angebot gelöscht, würde count(*) eine schon vergebene Nummer erneut
--    ausgeben — und der unique(user_id, nummer) würde das Anlegen abweisen.
--  - Der Advisory Lock serialisiert gleichzeitige Aufrufe desselben Betriebs,
--    damit zwei parallel erstellte Angebote nicht dieselbe Nummer bekommen.
--    Er hängt an der Transaktion und wird automatisch wieder freigegeben.
create or replace function public.next_angebot_nummer(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jahr     text := to_char(current_date, 'YYYY');
  v_praefix  text := 'AN-' || v_jahr || '-';
  v_hoechste integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_jahr, 0));

  select coalesce(max(substring(nummer from '\d+$')::integer), 0)
    into v_hoechste
  from public.angebote
  where user_id = p_user_id
    and nummer like v_praefix || '%';

  return v_praefix || lpad((v_hoechste + 1)::text, 4, '0');
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
-- `auth.uid()` ist die User-ID aus dem JWT des eingeloggten Nutzers.

alter table public.profiles   enable row level security;
alter table public.kunden     enable row level security;
alter table public.preisliste enable row level security;
alter table public.angebote   enable row level security;
alter table public.positionen enable row level security;

create policy "profiles: eigenes Profil lesen"
  on public.profiles for select using (auth.uid() = id);
create policy "profiles: eigenes Profil anlegen"
  on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: eigenes Profil ändern"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "kunden: eigene Kunden"
  on public.kunden for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "preisliste: eigene Preise"
  on public.preisliste for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "angebote: eigene Angebote"
  on public.angebote for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Positionen haben keine eigene user_id — der Zugriff wird über das zugehörige
-- Angebot geprüft (deshalb der exists-Subselect).
create policy "positionen: über Angebot abgesichert"
  on public.positionen for all
  using (
    exists (
      select 1 from public.angebote a
      where a.id = positionen.angebot_id and a.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.angebote a
      where a.id = positionen.angebot_id and a.user_id = auth.uid()
    )
  );
