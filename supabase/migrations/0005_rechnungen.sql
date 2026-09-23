-- =============================================================================
-- Rechnungen und Onboarding
-- =============================================================================
-- Rechnungen sind bewusst EIGENE Tabellen und keine Erweiterung der Angebote.
-- Der Grund ist nicht Ordnungsliebe, sondern Recht: ein Angebot darf man
-- beliebig ändern, eine erteilte Rechnung nicht mehr. Steckten beide in einer
-- Tabelle, müsste jede Änderung am Angebot prüfen, ob sie gerade eine
-- Rechnung verändert. Getrennt ist die Regel einfach und erzwingbar.
--
-- WAS HIER ABGEDECKT IST: fortlaufende Nummern ohne Lücken, Pflichtangaben,
-- und eine festgeschriebene Rechnung, die sich nicht mehr ändern lässt.
--
-- WAS NICHT: E-Rechnung (XRechnung/ZUGFeRD als XML) und der GoBD-Export für
-- die Betriebsprüfung. Beides ist ein eigenes Vorhaben und steht in der
-- Liste im README.
-- =============================================================================

create type rechnung_status as enum (
  'entwurf',      -- noch änderbar
  'gestellt',     -- festgeschrieben und raus
  'bezahlt',
  'storniert'
);

-- -----------------------------------------------------------------------------
-- rechnungen
-- -----------------------------------------------------------------------------
create table public.rechnungen (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  kunde_id        uuid references public.kunden (id) on delete set null,
  -- Aus welchem Angebot entstanden? Nur zur Nachvollziehbarkeit; die Rechnung
  -- steht inhaltlich für sich, damit spätere Angebotsänderungen sie nicht
  -- berühren.
  angebot_id      uuid references public.angebote (id) on delete set null,

  nummer          text not null,
  titel           text not null default '',
  status          rechnung_status not null default 'entwurf',

  datum           date not null default current_date,
  -- §14 UStG: der Zeitpunkt der Leistung gehört auf jede Rechnung.
  leistung_von    date,
  leistung_bis    date,
  zahlungsziel_tage integer not null default 14,
  faellig_am      date,

  netto           numeric(12, 2) not null default 0,
  mwst_satz       numeric(5, 2)  not null default 19.00,
  mwst_betrag     numeric(12, 2) not null default 0,
  brutto          numeric(12, 2) not null default 0,

  notiz           text,

  -- Ab diesem Zeitpunkt ist die Rechnung unveränderlich (siehe Trigger unten).
  festgeschrieben_am timestamptz,
  bezahlt_am      timestamptz,
  storniert_am    timestamptz,
  -- Eine Stornorechnung zeigt auf die Rechnung, die sie aufhebt.
  storniert_durch uuid references public.rechnungen (id) on delete set null,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  unique (user_id, nummer)
);

create index rechnungen_user_idx on public.rechnungen (user_id, created_at desc);
create index rechnungen_status_idx on public.rechnungen (user_id, status);

-- -----------------------------------------------------------------------------
-- rechnung_positionen
-- -----------------------------------------------------------------------------
create table public.rechnung_positionen (
  id            uuid primary key default gen_random_uuid(),
  rechnung_id   uuid not null references public.rechnungen (id) on delete cascade,

  pos_nr        integer not null default 1,
  bezeichnung   text not null,
  beschreibung  text,
  menge         numeric(12, 3) not null default 1,
  einheit       einheit not null default 'stk',
  einzelpreis   numeric(12, 2) not null default 0,
  gesamtpreis   numeric(12, 2)
                generated always as (round(menge * einzelpreis, 2)) stored,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index rechnung_positionen_idx
  on public.rechnung_positionen (rechnung_id, pos_nr);

-- =============================================================================
-- Trigger
-- =============================================================================

create trigger rechnungen_touch before update on public.rechnungen
  for each row execute function public.touch_updated_at();
create trigger rechnung_positionen_touch before update on public.rechnung_positionen
  for each row execute function public.touch_updated_at();

-- Summen wie beim Angebot von der Datenbank rechnen lassen.
create or replace function public.recalc_rechnung_summen()
returns trigger
language plpgsql
as $$
declare
  v_id    uuid := coalesce(new.rechnung_id, old.rechnung_id);
  v_netto numeric(12, 2);
  v_satz  numeric(5, 2);
begin
  select coalesce(sum(gesamtpreis), 0) into v_netto
  from public.rechnung_positionen where rechnung_id = v_id;

  select mwst_satz into v_satz from public.rechnungen where id = v_id;

  update public.rechnungen
  set netto       = v_netto,
      mwst_betrag = round(v_netto * v_satz / 100, 2),
      brutto      = v_netto + round(v_netto * v_satz / 100, 2)
  where id = v_id;

  return null;
end;
$$;

create trigger rechnung_positionen_recalc
  after insert or update or delete on public.rechnung_positionen
  for each row execute function public.recalc_rechnung_summen();

-- -----------------------------------------------------------------------------
-- Unveränderlichkeit
-- -----------------------------------------------------------------------------
-- Der Kern der ganzen Tabelle: eine festgeschriebene Rechnung darf sich nicht
-- mehr ändern. Das in der Anwendung zu prüfen reicht nicht — ein vergessener
-- Pfad, ein Skript, ein SQL-Editor, und der Beleg ist still verändert.
-- Erlaubt bleiben nur die Felder, die sich fachlich NACH dem Stellen noch
-- ändern dürfen: bezahlt, storniert.
create or replace function public.rechnung_unveraenderlich()
returns trigger
language plpgsql
as $$
begin
  if old.festgeschrieben_am is null then
    return new;  -- Entwurf: alles erlaubt
  end if;

  if new.status is distinct from old.status
     or new.bezahlt_am is distinct from old.bezahlt_am
     or new.storniert_am is distinct from old.storniert_am
     or new.storniert_durch is distinct from old.storniert_durch
     or new.updated_at is distinct from old.updated_at then
    -- Diese Felder dürfen sich ändern. Alles andere muss gleich bleiben:
    if new.nummer = old.nummer
       and new.datum = old.datum
       and new.netto = old.netto
       and new.mwst_satz = old.mwst_satz
       and new.mwst_betrag = old.mwst_betrag
       and new.brutto = old.brutto
       and new.titel = old.titel
       and new.kunde_id is not distinct from old.kunde_id
       and new.leistung_von is not distinct from old.leistung_von
       and new.leistung_bis is not distinct from old.leistung_bis
       and new.notiz is not distinct from old.notiz then
      return new;
    end if;
  end if;

  raise exception 'Gestellte Rechnungen können nicht mehr geändert werden. Bitte stornieren und neu stellen.'
    using errcode = 'check_violation';
end;
$$;

create trigger rechnungen_unveraenderlich
  before update on public.rechnungen
  for each row execute function public.rechnung_unveraenderlich();

-- Dasselbe für die Positionen: gehört die Rechnung schon zum Bestand,
-- ist an den Zeilen nichts mehr zu machen.
create or replace function public.rechnung_positionen_unveraenderlich()
returns trigger
language plpgsql
as $$
declare
  v_id  uuid := coalesce(new.rechnung_id, old.rechnung_id);
  v_fest timestamptz;
begin
  select festgeschrieben_am into v_fest
  from public.rechnungen where id = v_id;

  if v_fest is not null then
    raise exception 'Positionen einer gestellten Rechnung können nicht mehr geändert werden.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger rechnung_positionen_unveraenderlich
  before insert or update or delete on public.rechnung_positionen
  for each row execute function public.rechnung_positionen_unveraenderlich();

-- -----------------------------------------------------------------------------
-- Fortlaufende Rechnungsnummer
-- -----------------------------------------------------------------------------
-- Gleiche Mechanik wie beim Angebot, aber hier ist die Lückenlosigkeit keine
-- Kosmetik: eine fortlaufende Nummer ist Pflichtangabe nach §14 UStG.
create or replace function public.next_rechnung_nummer(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jahr     text := to_char(current_date, 'YYYY');
  v_praefix  text := 'RE-' || v_jahr || '-';
  v_hoechste integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_jahr || 're', 0));

  select coalesce(max(substring(nummer from '\d+$')::integer), 0)
    into v_hoechste
  from public.rechnungen
  where user_id = p_user_id and nummer like v_praefix || '%';

  return v_praefix || lpad((v_hoechste + 1)::text, 4, '0');
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================

alter table public.rechnungen enable row level security;
alter table public.rechnung_positionen enable row level security;

create policy "rechnungen: eigene Rechnungen"
  on public.rechnungen for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "rechnung_positionen: über Rechnung abgesichert"
  on public.rechnung_positionen for all
  using (
    exists (
      select 1 from public.rechnungen r
      where r.id = rechnung_positionen.rechnung_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.rechnungen r
      where r.id = rechnung_positionen.rechnung_id and r.user_id = auth.uid()
    )
  );

-- =============================================================================
-- Onboarding
-- =============================================================================
-- Wann hat der Betrieb die Einrichtung abgeschlossen? Steuert, ob beim
-- Anmelden der Willkommensablauf erscheint.
alter table public.profiles
  add column onboarding_am timestamptz;
