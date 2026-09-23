\set ON_ERROR_STOP on

-- Rechte wie in Supabase für die Rolle "authenticated".
grant select, insert, update, delete on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
grant insert, select on auth.users to app_user;

-- =========================================================================
-- 1. SIGNUP: Supabase legt den Nutzer an, unser Trigger das Profil
-- =========================================================================
insert into auth.users (id, email, raw_user_meta_data)
values ('11111111-1111-1111-1111-111111111111', 'chef@sanitaer-mueller.de',
        '{"firma_name": "Müller Sanitär GmbH"}'::jsonb),
       ('22222222-2222-2222-2222-222222222222', 'anderer@betrieb.de', '{}'::jsonb);

do $$
declare v_firma text; v_anzahl int;
begin
  select count(*) into v_anzahl from public.profiles;
  if v_anzahl <> 2 then
    raise exception 'FEHLER: Profil wurde nicht automatisch angelegt (% statt 2)', v_anzahl;
  end if;

  select firma_name into v_firma from public.profiles
  where id = '11111111-1111-1111-1111-111111111111';
  if v_firma <> 'Müller Sanitär GmbH' then
    raise exception 'FEHLER: firma_name aus den Metadaten nicht übernommen: %', v_firma;
  end if;

  raise notice '1. Signup -> Profil automatisch angelegt, Firma: %', v_firma;
end $$;

-- =========================================================================
-- 2. PREISLISTE als angemeldeter Nutzer (RLS aktiv)
-- =========================================================================
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

insert into public.preisliste (user_id, bezeichnung, kategorie, einheit, einzelpreis, stichworte)
values
  ('11111111-1111-1111-1111-111111111111', 'Fliesen verlegen 30x60', 'Fliesenarbeiten', 'm2', 48.50,
   array['bad fliesen','verfliesen','wandfliesen']),
  ('11111111-1111-1111-1111-111111111111', 'Duschwanne montieren', 'Sanitär', 'stk', 189.00,
   array['dusche einbauen']),
  ('11111111-1111-1111-1111-111111111111', 'Monteurstunde', 'Arbeitszeit', 'h', 62.00, '{}');

do $$
declare v int;
begin
  select count(*) into v from public.preisliste;
  if v <> 3 then raise exception 'FEHLER: % Einträge statt 3', v; end if;
  raise notice '2. Anlegen -> 3 Preise gespeichert';
end $$;

-- Ändern
update public.preisliste set einzelpreis = 52.00
where bezeichnung = 'Fliesen verlegen 30x60';

do $$
declare v numeric;
begin
  select einzelpreis into v from public.preisliste where bezeichnung = 'Fliesen verlegen 30x60';
  if v <> 52.00 then raise exception 'FEHLER: Preis nicht geändert: %', v; end if;
  raise notice '3. Ändern -> Preis jetzt %', v;
end $$;

-- Unscharfe Suche (die RPC aus 0003)
do $$
declare v_treffer text;
begin
  select bezeichnung into v_treffer
  from public.suche_preisliste('bad fliesen', 5, 0.2) limit 1;
  if v_treffer is null then
    raise exception 'FEHLER: Trigramm-Suche findet nichts fuer "bad fliesen"';
  end if;
  raise notice '4. Suche "bad fliesen" -> %', v_treffer;
end $$;

-- Löschen
delete from public.preisliste where bezeichnung = 'Monteurstunde';
do $$
declare v int;
begin
  select count(*) into v from public.preisliste;
  if v <> 2 then raise exception 'FEHLER: nach dem Löschen % statt 2', v; end if;
  raise notice '5. Löschen -> 2 Einträge übrig';
end $$;

-- =========================================================================
-- 3. RLS: der andere Betrieb darf nichts davon sehen oder ändern
-- =========================================================================
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare v int;
begin
  select count(*) into v from public.preisliste;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremde Preise sichtbar (%)', v; end if;

  update public.preisliste set einzelpreis = 1;
  get diagnostics v = row_count;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremde Preise änderbar (%)', v; end if;

  raise notice '6. RLS -> fremder Betrieb sieht 0 Einträge und kann keine ändern';
end $$;

-- Ein Eintrag unter fremder user_id lässt sich gar nicht erst einfügen.
do $$
begin
  begin
    insert into public.preisliste (user_id, bezeichnung, einzelpreis)
    values ('11111111-1111-1111-1111-111111111111', 'Eingeschmuggelt', 1);
    raise exception 'SICHERHEITSLÜCKE: Insert mit fremder user_id war erlaubt';
  exception when insufficient_privilege then
    raise notice '7. RLS -> Insert mit fremder user_id abgelehnt';
  end;
end $$;

-- =========================================================================
-- 4. Angebot: Nummernkreis und automatische Summen
-- =========================================================================
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_nummer text;
  v_angebot uuid;
  v_preis_id uuid;
  v_netto numeric; v_mwst numeric; v_brutto numeric;
begin
  v_nummer := public.next_angebot_nummer('11111111-1111-1111-1111-111111111111');
  if v_nummer !~ '^AN-\d{4}-0001$' then
    raise exception 'FEHLER: unerwartete Angebotsnummer %', v_nummer;
  end if;

  insert into public.angebote (user_id, nummer, titel)
  values ('11111111-1111-1111-1111-111111111111', v_nummer, 'Badsanierung')
  returning id into v_angebot;

  select id into v_preis_id from public.preisliste where einheit = 'm2';

  insert into public.positionen (angebot_id, pos_nr, bezeichnung, menge, einheit, einzelpreis, preisliste_id)
  values (v_angebot, 1, 'Fliesen verlegen 30x60', 8, 'm2', 52.00, v_preis_id),
         (v_angebot, 2, 'Duschwanne montieren', 1, 'stk', 189.00, null);

  select netto, mwst_betrag, brutto into v_netto, v_mwst, v_brutto
  from public.angebote where id = v_angebot;

  -- 8 * 52,00 = 416,00 + 189,00 = 605,00 netto; 19 % = 114,95; brutto 719,95
  if v_netto <> 605.00 or v_mwst <> 114.95 or v_brutto <> 719.95 then
    raise exception 'FEHLER: Summen falsch: netto=% mwst=% brutto=%', v_netto, v_mwst, v_brutto;
  end if;

  raise notice '8. Angebot % -> netto % / MwSt % / brutto % (automatisch berechnet)',
    v_nummer, v_netto, v_mwst, v_brutto;
end $$;

reset role;
