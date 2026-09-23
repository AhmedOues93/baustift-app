-- =============================================================================
-- Unscharfe Suche in der Preisliste (Trigramm)
-- =============================================================================
-- Im Normalfall lädt die App die komplette Preisliste eines Betriebs und macht
-- das Matching in TypeScript (src/lib/ai/matching.ts) — bei ein paar hundert
-- Einträgen ist das schneller als mehrere DB-Roundtrips.
--
-- Diese Funktion ist für zwei andere Fälle da:
--   1. sehr grosse Preislisten (>1000 Einträge): dann schicken wir nicht mehr
--      den ganzen Katalog an Claude, sondern nur die Top-Kandidaten je Position.
--   2. die Suche im Preislisten-UI ("Fliesen" tippen, Treffer sehen).
--
-- `similarity()` kommt aus pg_trgm und nutzt den GIN-Index aus 0001.
-- =============================================================================

create or replace function public.suche_preisliste(
  p_suchtext text,
  p_limit    integer default 10,
  p_min_score real default 0.2
)
returns table (
  id          uuid,
  bezeichnung text,
  kategorie   text,
  einheit     einheit,
  einzelpreis numeric,
  score       real
)
language sql
stable
security invoker   -- läuft als aufrufender Nutzer -> RLS greift weiterhin
set search_path = public
as $$
  -- Die Filterung nach Score passiert in der äusseren Abfrage: der `%`-Operator
  -- kann den GIN-Index nutzen, `similarity() >= x` würde einen Seq Scan erzwingen.
  select t.id, t.bezeichnung, t.kategorie, t.einheit, t.einzelpreis, t.score
  from (
    select p.id,
           p.bezeichnung,
           p.kategorie,
           p.einheit,
           p.einzelpreis,
           greatest(
             similarity(p.bezeichnung, p_suchtext),
             -- Stichworte mitbewerten: array_to_string macht daraus einen Text,
             -- den similarity() vergleichen kann.
             similarity(array_to_string(p.stichworte, ' '), p_suchtext)
           ) as score
    from public.preisliste p
    where p.aktiv
      and (
        p.bezeichnung % p_suchtext
        or array_to_string(p.stichworte, ' ') % p_suchtext
      )
  ) t
  where t.score >= p_min_score
  order by t.score desc
  limit p_limit
$$;

comment on function public.suche_preisliste is
  'Unscharfe Suche (Trigramm) in der eigenen Preisliste des angemeldeten Nutzers.';
