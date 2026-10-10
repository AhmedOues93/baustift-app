-- =============================================================================
-- Öffentliche Datenbankfunktionen absichern
-- =============================================================================
-- SECURITY DEFINER ist für den Anmelde-Trigger, die Anfragebremse und die
-- Nummernkreise nötig: sie müssen intern auch Tabellen sehen, für die der
-- aufrufende Nutzer keine direkte Berechtigung hat. Es darf aber nie reichen,
-- bloss eine fremde UUID als Parameter zu senden.
--
-- Deshalb gilt für jede Funktion mit Nutzerkennung:
--   1. nur angemeldete Nutzer dürfen sie ausführen,
--   2. die übergebene Kennung muss zur Session gehören,
--   3. der Suchpfad ist leer und alle Relationen sind qualifiziert.
-- =============================================================================

create or replace function public.next_angebot_nummer(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jahr     text := to_char(current_date, 'YYYY');
  v_praefix  text := 'AN-' || v_jahr || '-';
  v_hoechste integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Nicht berechtigt, Angebotsnummern für einen anderen Betrieb abzurufen.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_jahr, 0));

  select coalesce(max(substring(nummer from '\d+$')::integer), 0)
    into v_hoechste
  from public.angebote
  where user_id = p_user_id
    and nummer like v_praefix || '%';

  return v_praefix || lpad((v_hoechste + 1)::text, 4, '0');
end;
$$;

create or replace function public.next_rechnung_nummer(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_jahr     text := to_char(current_date, 'YYYY');
  v_praefix  text := 'RE-' || v_jahr || '-';
  v_hoechste integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Nicht berechtigt, Rechnungsnummern für einen anderen Betrieb abzurufen.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || v_jahr || 're', 0));

  select coalesce(max(substring(nummer from '\d+$')::integer), 0)
    into v_hoechste
  from public.rechnungen
  where user_id = p_user_id and nummer like v_praefix || '%';

  return v_praefix || lpad((v_hoechste + 1)::text, 4, '0');
end;
$$;

create or replace function public.ki_anfrage_erlaubt(
  p_user_id uuid,
  p_max integer default 5,
  p_fenster_sekunden integer default 60,
  p_art text default 'angebot'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_anzahl integer;
begin
  if (select auth.uid()) is null or (select auth.uid()) <> p_user_id then
    raise exception 'Nicht berechtigt, die Anfragebremse eines anderen Betriebs zu ändern.'
      using errcode = '42501';
  end if;

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

  insert into public.ki_anfragen(user_id, art) values (p_user_id, p_art);
  return true;
end;
$$;

-- Der Anmelde-Trigger ist kein RPC-Endpunkt. Nur der Trigger selbst braucht
-- die Funktion; über /rest/v1/rpc darf sie niemand aufrufen.
alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;

revoke all on function public.next_angebot_nummer(uuid) from public, anon;
revoke all on function public.next_rechnung_nummer(uuid) from public, anon;
revoke all on function public.ki_anfrage_erlaubt(uuid, integer, integer, text) from public, anon;
grant execute on function public.next_angebot_nummer(uuid) to authenticated;
grant execute on function public.next_rechnung_nummer(uuid) to authenticated;
grant execute on function public.ki_anfrage_erlaubt(uuid, integer, integer, text) to authenticated;

-- Trigger-Funktionen sind nicht als RPC gedacht. Ein fester, leerer
-- Suchpfad verhindert trotzdem, dass später angelegte Objekte Namensauflösung
-- in privilegierten Ausführungen beeinflussen.
alter function public.touch_updated_at() set search_path = '';
alter function public.recalc_angebot_summen() set search_path = '';
alter function public.recalc_rechnung_summen() set search_path = '';
alter function public.rechnung_unveraenderlich() set search_path = '';
alter function public.rechnung_positionen_unveraenderlich() set search_path = '';
alter function public.aufmass_position_offen() set search_path = '';
