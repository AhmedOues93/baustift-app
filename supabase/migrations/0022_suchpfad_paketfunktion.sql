-- Die Paketfunktion arbeitet mit Daten des angemeldeten Betriebs (SECURITY
-- INVOKER). Auch dafür bleibt der Suchpfad fest: so kann kein später
-- angelegtes Objekt die Namensauflösung in der Funktion beeinflussen.
alter function public.paket_in_angebot(uuid, uuid) set search_path = '';
