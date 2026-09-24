-- =============================================================================
-- Anfragebremse für die teuren KI-Aufrufe
-- =============================================================================
-- Die erste Fassung zählte in einer Map im Arbeitsspeicher. Auf einer
-- Plattform wie Vercel ist das wirkungslos: jede Instanz hat ihre eigene Map,
-- Instanzen kommen und gehen, und ein Aufrufer verteilt sich über mehrere.
-- Aus "fünf pro Minute und Nutzer" wird dann "fünf pro Minute und Instanz" —
-- also praktisch keine Bremse, bei gleichzeitig wachsendem Speicher, weil
-- Einträge nie aufgeräumt wurden.
--
-- Die Datenbank ist die einzige Stelle, die alle Instanzen gemeinsam sehen.
-- Deshalb zählt sie mit.
-- =============================================================================

create table public.ki_anfragen (
  id         bigserial primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Deckt genau die Abfrage der Bremse ab: "dieser Nutzer, letzte Minute".
create index ki_anfragen_user_zeit_idx
  on public.ki_anfragen (user_id, created_at desc);

alter table public.ki_anfragen enable row level security;
-- Bewusst KEINE Policy: geschrieben und gelesen wird ausschliesslich in der
-- Funktion unten, die als `security definer` läuft. Ein Client, der seine
-- eigenen Einträge löschen könnte, hätte keine Bremse mehr.

/**
 * Darf dieser Nutzer jetzt eine KI-Anfrage stellen?
 *
 * Zählt die Anfragen im Zeitfenster und trägt die neue gleich mit ein — in
 * einer Anweisung, damit zwei gleichzeitige Aufrufe sich nicht beide
 * durchmogeln. Gibt false zurück, wenn das Fenster voll ist.
 *
 * Räumt nebenbei alte Einträge desselben Nutzers weg. Eine eigene
 * Aufräum-Routine wäre eine Sache, die man einrichtet und dann vergisst.
 */
create or replace function public.ki_anfrage_erlaubt(
  p_user_id uuid,
  p_max integer default 5,
  p_fenster_sekunden integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anzahl integer;
begin
  delete from public.ki_anfragen
  where user_id = p_user_id
    and created_at < now() - interval '1 hour';

  select count(*) into v_anzahl
  from public.ki_anfragen
  where user_id = p_user_id
    and created_at > now() - make_interval(secs => p_fenster_sekunden);

  if v_anzahl >= p_max then
    return false;
  end if;

  insert into public.ki_anfragen (user_id) values (p_user_id);
  return true;
end;
$$;

-- Nur angemeldete Nutzer dürfen die Funktion rufen; sie prüft ohnehin nur
-- die ID, die der Server ihr gibt.
revoke all on function public.ki_anfrage_erlaubt(uuid, integer, integer) from public;
grant execute on function public.ki_anfrage_erlaubt(uuid, integer, integer) to authenticated;
