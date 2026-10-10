-- =============================================================================
-- Leistungspakete
-- =============================================================================
-- Ein Bad ist für den Handwerker nicht eine Position, sondern immer dieselben
-- acht: alte Fliesen raus, Untergrund, neue Fliesen, Dusche, WC, Armatur,
-- Silikon, Entsorgung. Dieselben acht tippt er bei jedem Bad neu zusammen —
-- oder er kopiert ein altes Angebot und vergisst dabei eine Zeile.
--
-- Ein Paket ist diese Zusammenstellung mit einem Namen. Ins Angebot kommt sie
-- mit einem Antippen.
--
-- DIE WICHTIGE ENTSCHEIDUNG: ein Paket speichert KEINE Preise, sondern
-- Verweise auf die Preisliste. Wer seine Stundensätze erhöht, soll das nicht
-- in zwölf Paketen nachpflegen müssen — sonst steht in einem davon in zwei
-- Jahren noch der alte Satz, und niemand merkt es. Nur für Zeilen ohne
-- Katalogeintrag wird ein Preis mitgeführt.
-- =============================================================================

create table public.leistungspakete (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,

  name         text not null,                 -- "Bad komplett bis 10 m²"
  beschreibung text,                           -- wofür das Paket gedacht ist

  aktiv        boolean not null default true,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index leistungspakete_user_id_idx on public.leistungspakete (user_id);

create table public.paket_positionen (
  id            uuid primary key default gen_random_uuid(),
  paket_id      uuid not null references public.leistungspakete (id) on delete cascade,

  pos_nr        integer not null default 1,

  -- Verweis auf die Preisliste. Bleibt der Normalfall; der Preis kommt beim
  -- Einfügen von dort. Wird der Eintrag gelöscht, bleibt die Zeile mit ihrem
  -- Text stehen und wird im Angebot als "zu prüfen" markiert.
  preisliste_id uuid references public.preisliste (id) on delete set null,

  -- Text und Menge gehören zum Paket, nicht zum Katalog: dieselbe Leistung
  -- kann in zwei Paketen mit anderer Menge stehen.
  bezeichnung   text not null,
  beschreibung  text,
  menge         numeric(12, 3) not null default 1,
  einheit       einheit not null default 'stk',

  -- Nur für Zeilen ohne Katalogeintrag.
  einzelpreis   numeric(12, 2) not null default 0,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index paket_positionen_paket_idx on public.paket_positionen (paket_id, pos_nr);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table public.leistungspakete enable row level security;
alter table public.paket_positionen enable row level security;

create policy "eigene Pakete lesen" on public.leistungspakete
  for select using (auth.uid() = user_id);
create policy "eigene Pakete anlegen" on public.leistungspakete
  for insert with check (auth.uid() = user_id);
create policy "eigene Pakete ändern" on public.leistungspakete
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eigene Pakete löschen" on public.leistungspakete
  for delete using (auth.uid() = user_id);

-- Die Positionen hängen am Paket, nicht an einer eigenen user_id. Die Policy
-- fragt deshalb über das Paket — genau wie bei den Angebotspositionen.
create policy "eigene Paketzeilen lesen" on public.paket_positionen
  for select using (
    exists (select 1 from public.leistungspakete p
            where p.id = paket_id and p.user_id = auth.uid())
  );
create policy "eigene Paketzeilen anlegen" on public.paket_positionen
  for insert with check (
    exists (select 1 from public.leistungspakete p
            where p.id = paket_id and p.user_id = auth.uid())
  );
create policy "eigene Paketzeilen ändern" on public.paket_positionen
  for update using (
    exists (select 1 from public.leistungspakete p
            where p.id = paket_id and p.user_id = auth.uid())
  );
create policy "eigene Paketzeilen löschen" on public.paket_positionen
  for delete using (
    exists (select 1 from public.leistungspakete p
            where p.id = paket_id and p.user_id = auth.uid())
  );

grant select, insert, update, delete on public.leistungspakete to authenticated;
grant select, insert, update, delete on public.paket_positionen to authenticated;

-- updated_at mitführen, wie bei den anderen Tabellen.
create trigger leistungspakete_touch
  before update on public.leistungspakete
  for each row execute function public.touch_updated_at();
create trigger paket_positionen_touch
  before update on public.paket_positionen
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Paket in ein Angebot übernehmen
-- -----------------------------------------------------------------------------
-- In einer Transaktion und in der Datenbank, aus zwei Gründen:
--
--  1. Der Preis muss beim Einfügen aus der Preisliste kommen, nicht aus dem
--     Paket. Das hier ist die einzige Stelle, an der das passiert.
--  2. Acht einzelne Inserts aus der Anwendung heraus wären acht Gelegenheiten,
--     dass die Hälfte ankommt.
--
-- Zeilen, deren Katalogeintrag gelöscht wurde, kommen mit `zu_pruefen` ins
-- Angebot: der Preis ist dann der zuletzt im Paket hinterlegte, und auf den
-- soll sich niemand blind verlassen.
create or replace function public.paket_in_angebot(
  p_paket_id uuid,
  p_angebot_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_naechste integer;
  v_anzahl   integer;
begin
  -- RLS entscheidet, ob Paket und Angebot dem Aufrufer gehören: sieht er
  -- eines von beiden nicht, findet er hier nichts und es passiert nichts.
  if not exists (select 1 from public.leistungspakete where id = p_paket_id) then
    return 0;
  end if;
  if not exists (select 1 from public.angebote where id = p_angebot_id) then
    return 0;
  end if;

  select coalesce(max(pos_nr), 0) into v_naechste
  from public.positionen where angebot_id = p_angebot_id;

  insert into public.positionen
    (angebot_id, pos_nr, bezeichnung, beschreibung, menge, einheit,
     einzelpreis, preisliste_id, zu_pruefen)
  select
    p_angebot_id,
    v_naechste + row_number() over (order by pp.pos_nr),
    pp.bezeichnung,
    coalesce(pp.beschreibung, pl.beschreibung),
    pp.menge,
    pp.einheit,
    -- Preis aus dem Katalog, wenn es ihn noch gibt.
    coalesce(pl.einzelpreis, pp.einzelpreis),
    pl.id,
    -- Ohne Katalogeintrag ist der Preis nur noch ein Andenken.
    pl.id is null
  from public.paket_positionen pp
  left join public.preisliste pl
    on pl.id = pp.preisliste_id and pl.aktiv
  where pp.paket_id = p_paket_id;

  get diagnostics v_anzahl = row_count;
  return v_anzahl;
end;
$$;

grant execute on function public.paket_in_angebot(uuid, uuid) to authenticated;
