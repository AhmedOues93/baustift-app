-- =============================================================================
-- Anfragebremse je Art
-- =============================================================================
-- 0007 zählt alle KI-Anfragen eines Nutzers in einen Topf: fünf pro Minute.
-- Für Angebote ist das grosszügig — niemand diktiert fünf Angebote in einer
-- Minute.
--
-- Beim Aufmass stimmt die Zahl nicht mehr. Dort spricht der Handwerker alle
-- zwanzig Sekunden ein Mass ein, und beim Ausmessen eines Bades kommen
-- zwanzig Messungen hintereinander. Mit einem gemeinsamen Zähler bräche die
-- Bremse mitten im Aufmass ein — und zwar genau dann, wenn er im Takt ist.
--
-- Also zählt sie getrennt. Eine Spalte statt einer zweiten Tabelle: es ist
-- dieselbe Frage, nur nach Art aufgeteilt.
-- =============================================================================

alter table public.ki_anfragen
  add column art text not null default 'angebot';

-- Der Index deckt jetzt die tatsächliche Abfrage ab: dieser Nutzer, diese
-- Art, letzte Minute.
drop index if exists ki_anfragen_user_zeit_idx;
create index ki_anfragen_user_art_zeit_idx
  on public.ki_anfragen (user_id, art, created_at desc);

-- Die alte Fassung muss weg: ein vierter Parameter mit Vorgabewert wäre
-- neben ihr mehrdeutig, und Postgres lehnt den Aufruf dann ab.
drop function if exists public.ki_anfrage_erlaubt(uuid, integer, integer);

create or replace function public.ki_anfrage_erlaubt(
  p_user_id uuid,
  p_max integer default 5,
  p_fenster_sekunden integer default 60,
  p_art text default 'angebot'
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
    and art = p_art
    and created_at > now() - make_interval(secs => p_fenster_sekunden);

  if v_anzahl >= p_max then
    return false;
  end if;

  insert into public.ki_anfragen (user_id, art) values (p_user_id, p_art);
  return true;
end;
$$;

revoke all on function public.ki_anfrage_erlaubt(uuid, integer, integer, text) from public;
grant execute on function public.ki_anfrage_erlaubt(uuid, integer, integer, text) to authenticated;
