-- =============================================================================
-- Aufmass-Trigger nach dem Absichern wieder lauffähig machen
-- =============================================================================
-- 0021 hat allen privilegierten Funktionen einen leeren Suchpfad gegeben. Das
-- ist richtig: so kann kein später angelegtes Objekt die Namensauflösung in
-- einer privilegierten Ausführung beeinflussen.
--
-- Eine Funktion hat das aber nicht überlebt. `aufmass_position_offen` legt
-- eine Variable vom Typ `aufmass_status` an — ohne Schema davor. Mit leerem
-- Suchpfad findet Postgres den Typ nicht mehr, und weil der Körper einer
-- plpgsql-Funktion erst beim ersten Aufruf übersetzt wird, fällt das nicht
-- beim Einspielen auf, sondern beim ersten Mass, das jemand einspricht:
--
--   ERROR: type "aufmass_status" does not exist
--
-- Damit wäre das Aufmass im Betrieb vollständig blockiert gewesen. Gefunden
-- hat es der Schema-Test, der den Trigger wirklich auslöst.
--
-- Die Funktion wird hier neu angelegt, mit qualifiziertem Typ. Der leere
-- Suchpfad bleibt.
-- =============================================================================

create or replace function public.aufmass_position_offen()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  -- public.aufmass_status statt aufmass_status: mit leerem Suchpfad gibt es
  -- keinen anderen Weg, den Typ zu finden.
  v_status public.aufmass_status;
begin
  select status into v_status from public.aufmass
  where id = coalesce(new.aufmass_id, old.aufmass_id);

  if v_status = 'abgeschlossen' then
    raise exception 'Das Aufmass ist abgeschlossen. Zum Ändern zuerst wieder öffnen.'
      using errcode = 'check_violation';
  end if;

  return coalesce(new, old);
end;
$$;
