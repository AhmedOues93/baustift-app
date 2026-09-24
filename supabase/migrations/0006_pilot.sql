-- =============================================================================
-- Pilotbetrieb: Rückmeldungen und Messpunkte
-- =============================================================================
-- Ein Pilot ohne Messung ist nur ein Gefühl. Diese Migration bringt die zwei
-- Dinge, ohne die man hinterher nicht sagen kann, ob das Produkt trägt:
--
--   1. Rückmeldungen dort einsammeln, wo sie entstehen (in der App, mit
--      Angabe der Seite) — nicht per WhatsApp irgendwann später.
--   2. Festhalten, WIE ein Angebot entstanden ist. Die Kernfrage des ganzen
--      Produkts lautet "benutzen sie wirklich die Sprache?" — ohne diese
--      Spalte ist sie nach dem Piloten nicht zu beantworten.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Wie ist das Angebot entstanden?
-- -----------------------------------------------------------------------------
create type eingabe_art as enum ('sprache', 'text');

alter table public.angebote
  add column eingabe_art eingabe_art,
  -- Länge der Aufnahme in Sekunden: zeigt, ob knapp diktiert oder erzählt wird.
  add column aufnahme_sekunden integer;

comment on column public.angebote.eingabe_art is
  'Sprache oder Tastatur. Grundlage für die wichtigste Pilotfrage.';

-- -----------------------------------------------------------------------------
-- feedback — Rückmeldungen aus dem laufenden Betrieb
-- -----------------------------------------------------------------------------
create type feedback_art as enum ('problem', 'idee', 'lob');

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,

  art        feedback_art not null default 'problem',
  text       text not null,
  -- Von welcher Seite kam die Meldung? Ohne das fehlt jeder Rückmeldung der
  -- Zusammenhang, und man rät beim Nachstellen.
  seite      text,

  erledigt   boolean not null default false,

  created_at timestamptz not null default now()
);

create index feedback_user_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;

-- Schreiben und die eigenen Meldungen lesen darf der Nutzer. Ändern und
-- Löschen nicht: eine abgeschickte Rückmeldung ist für uns ein Beleg, kein
-- Notizzettel des Nutzers.
create policy "feedback: eigene Meldungen lesen"
  on public.feedback for select using (auth.uid() = user_id);
create policy "feedback: eigene Meldung abgeben"
  on public.feedback for insert with check (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Auswertung des Piloten
-- -----------------------------------------------------------------------------
-- Eine Funktion statt fünf Abfragen im Frontend: die Zahlen gehören zusammen
-- und sollen aus einem Stand kommen.
--
-- `security invoker`, damit RLS greift — jeder sieht nur seine eigenen Zahlen.
create or replace function public.pilot_auswertung(p_user_id uuid)
returns table (
  angebote_gesamt      integer,
  per_sprache          integer,
  per_text             integer,
  positionen_gesamt    integer,
  positionen_zu_pruefen integer,
  sekunden_schnitt     integer,
  kosten_zehntelcent   integer,
  angebote_gesendet    integer,
  angebote_angenommen  integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (select count(*)::integer from angebote where user_id = p_user_id),
    (select count(*)::integer from angebote where user_id = p_user_id and eingabe_art = 'sprache'),
    (select count(*)::integer from angebote where user_id = p_user_id and eingabe_art = 'text'),
    (select count(*)::integer from positionen p
       join angebote a on a.id = p.angebot_id where a.user_id = p_user_id),
    -- Der Anteil "zu prüfen" ist das Mass für die Güte des Preis-Matchings.
    (select count(*)::integer from positionen p
       join angebote a on a.id = p.angebot_id
      where a.user_id = p_user_id and p.zu_pruefen),
    (select coalesce(round(avg(aufnahme_sekunden)), 0)::integer from angebote
      where user_id = p_user_id and aufnahme_sekunden is not null),
    (select coalesce(sum(kosten_zehntelcent), 0)::integer from ki_nutzung
      where user_id = p_user_id),
    (select count(*)::integer from angebote where user_id = p_user_id and gesendet_am is not null),
    (select count(*)::integer from angebote where user_id = p_user_id and status = 'angenommen')
$$;
