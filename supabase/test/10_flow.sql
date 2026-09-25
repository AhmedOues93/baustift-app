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

-- =========================================================================
-- 5. Rechnungen: Nummernkreis und Unveränderlichkeit
-- =========================================================================
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_nr      text;
  v_re      uuid;
  v_netto   numeric;
  v_fehler  boolean;
begin
  v_nr := public.next_rechnung_nummer('11111111-1111-1111-1111-111111111111');
  if v_nr !~ '^RE-\d{4}-0001$' then
    raise exception 'FEHLER: unerwartete Rechnungsnummer %', v_nr;
  end if;

  insert into public.rechnungen (user_id, nummer, titel, zahlungsziel_tage)
  values ('11111111-1111-1111-1111-111111111111', v_nr, 'Badsanierung', 14)
  returning id into v_re;

  insert into public.rechnung_positionen (rechnung_id, pos_nr, bezeichnung, menge, einheit, einzelpreis)
  values (v_re, 1, 'Fliesen verlegen', 8, 'm2', 52.00);

  select netto into v_netto from public.rechnungen where id = v_re;
  if v_netto <> 416.00 then
    raise exception 'FEHLER: Rechnungssumme falsch: %', v_netto;
  end if;
  raise notice '9. Rechnung % angelegt -> netto % (automatisch)', v_nr, v_netto;

  -- Festschreiben
  update public.rechnungen
  set status = 'gestellt', festgeschrieben_am = now()
  where id = v_re;

  -- Ab jetzt darf sich der Betrag NICHT mehr ändern.
  v_fehler := false;
  begin
    update public.rechnungen set netto = 1.00 where id = v_re;
  exception when check_violation then
    v_fehler := true;
  end;
  if not v_fehler then
    raise exception 'SCHWERER FEHLER: gestellte Rechnung liess sich ändern';
  end if;

  -- Auch die Positionen sind zu.
  v_fehler := false;
  begin
    update public.rechnung_positionen set einzelpreis = 1 where rechnung_id = v_re;
  exception when check_violation then
    v_fehler := true;
  end;
  if not v_fehler then
    raise exception 'SCHWERER FEHLER: Positionen einer gestellten Rechnung liessen sich ändern';
  end if;

  -- Löschen einer Position ebenfalls nicht.
  v_fehler := false;
  begin
    delete from public.rechnung_positionen where rechnung_id = v_re;
  exception when check_violation then
    v_fehler := true;
  end;
  if not v_fehler then
    raise exception 'SCHWERER FEHLER: Position einer gestellten Rechnung liess sich löschen';
  end if;

  raise notice '10. Gestellte Rechnung ist unveränderlich (Betrag, Positionen, Löschen)';

  -- Als bezahlt markieren muss weiterhin gehen.
  update public.rechnungen set status = 'bezahlt', bezahlt_am = now() where id = v_re;
  raise notice '11. "Bezahlt" lässt sich trotzdem setzen';

  -- Die nächste Nummer zählt weiter, ohne Lücke.
  if public.next_rechnung_nummer('11111111-1111-1111-1111-111111111111') !~ '0002$' then
    raise exception 'FEHLER: Rechnungsnummer zählt nicht fortlaufend weiter';
  end if;
  raise notice '12. Nächste Nummer ist fortlaufend';
end $$;

-- RLS auch hier prüfen.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v int;
begin
  select count(*) into v from public.rechnungen;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremde Rechnungen sichtbar (%)', v; end if;
  select count(*) into v from public.rechnung_positionen;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremde Rechnungspositionen sichtbar (%)', v; end if;
  raise notice '13. RLS -> fremder Betrieb sieht keine Rechnungen';
end $$;

reset role;

-- =========================================================================
-- 6. Pilot: Feedback und Auswertung
-- =========================================================================
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_fehler boolean;
  v_gesamt integer;
  v_sprache integer;
  v_pruefen integer;
begin
  insert into public.feedback (user_id, art, text, seite)
  values ('11111111-1111-1111-1111-111111111111', 'problem',
          'Das Mikro hat nichts aufgenommen.', '/angebote/neu');

  -- Eine abgeschickte Rückmeldung ist ein Beleg, kein Notizzettel:
  -- Ändern und Löschen müssen abgewiesen werden.
  v_fehler := false;
  begin
    update public.feedback set text = 'doch nicht';
    get diagnostics v_gesamt = row_count;
    if v_gesamt > 0 then v_fehler := true; end if;
  exception when insufficient_privilege then
    null;
  end;
  if v_fehler then
    raise exception 'FEHLER: abgeschickte Rückmeldung liess sich ändern';
  end if;

  raise notice '14. Feedback -> abgegeben, nachträglich nicht änderbar';

  -- Eingabeart am Angebot festhalten und auswerten.
  update public.angebote
  set eingabe_art = 'sprache', aufnahme_sekunden = 48
  where user_id = '11111111-1111-1111-1111-111111111111';

  select angebote_gesamt, per_sprache, positionen_zu_pruefen
    into v_gesamt, v_sprache, v_pruefen
  from public.pilot_auswertung('11111111-1111-1111-1111-111111111111');

  if v_gesamt < 1 or v_sprache <> v_gesamt then
    raise exception 'FEHLER: Auswertung zählt falsch (% gesamt, % Sprache)', v_gesamt, v_sprache;
  end if;

  raise notice '15. Auswertung -> % Angebote, davon % per Sprache', v_gesamt, v_sprache;
end $$;

-- Und auch hier: fremde Rückmeldungen bleiben fremd.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v int;
begin
  select count(*) into v from public.feedback;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremdes Feedback sichtbar (%)', v; end if;

  select angebote_gesamt into v from public.pilot_auswertung('11111111-1111-1111-1111-111111111111');
  if v <> 0 then
    raise exception 'SICHERHEITSLÜCKE: Auswertung zeigt fremde Zahlen (%)', v;
  end if;
  raise notice '16. RLS -> weder fremdes Feedback noch fremde Auswertung';
end $$;

reset role;

-- =========================================================================
-- 7. Anfragebremse
-- =========================================================================
-- Kein eigener GRANT hier: die Migration gibt das Recht an `authenticated`,
-- und app_user ist Mitglied dieser Rolle. Genau so läuft es in Supabase auch.
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_ok boolean;
  i integer;
begin
  -- Drei Anfragen bei einem Limit von drei müssen durchgehen.
  for i in 1..3 loop
    select public.ki_anfrage_erlaubt('11111111-1111-1111-1111-111111111111', 3, 60, 'angebot') into v_ok;
    if not v_ok then
      raise exception 'FEHLER: Anfrage % wurde abgewiesen, obwohl erlaubt', i;
    end if;
  end loop;

  -- Die vierte nicht.
  select public.ki_anfrage_erlaubt('11111111-1111-1111-1111-111111111111', 3, 60, 'angebot') into v_ok;
  if v_ok then
    raise exception 'SCHWERER FEHLER: Bremse greift nicht';
  end if;

  -- Ein anderer Betrieb ist davon nicht betroffen.
  select public.ki_anfrage_erlaubt('22222222-2222-2222-2222-222222222222', 3, 60, 'angebot') into v_ok;
  if not v_ok then
    raise exception 'FEHLER: Bremse trifft den falschen Nutzer';
  end if;

  -- Mit kurzem Fenster ist sofort wieder Platz.
  select public.ki_anfrage_erlaubt('11111111-1111-1111-1111-111111111111', 3, 0, 'angebot') into v_ok;
  if not v_ok then
    raise exception 'FEHLER: Fenster läuft nicht ab';
  end if;

  -- Eine andere Art hat ihren eigenen Zähler: sonst bräche die Bremse
  -- mitten im Aufmass ein, wo zwanzig Messungen hintereinander kommen.
  select public.ki_anfrage_erlaubt('11111111-1111-1111-1111-111111111111', 3, 60, 'aufmass') into v_ok;
  if not v_ok then
    raise exception 'FEHLER: Aufmass wird vom Angebotszähler gebremst';
  end if;

  raise notice '17. Anfragebremse -> greift pro Nutzer und Art und läuft ab';
end $$;

-- Der Client darf seine eigenen Einträge nicht sehen oder löschen —
-- sonst wäre die Bremse mit einem DELETE ausgehebelt.
do $$
declare v int;
begin
  select count(*) into v from public.ki_anfragen;
  if v <> 0 then
    raise exception 'SICHERHEITSLÜCKE: Anfrageprotokoll ist für den Client lesbar (%)', v;
  end if;
  raise notice '18. Anfrageprotokoll ist für den Client unsichtbar';
end $$;

reset role;

-- =========================================================================
-- 8. Angebot kopieren
-- =========================================================================
-- Die Kopie trägt eine eigene Eingabe-Art. Fehlt der Enum-Wert, schlägt das
-- Kopieren in der App mit einem Datenbankfehler fehl — hier fällt es sofort auf.
do $$
declare v_art eingabe_art;
begin
  insert into public.angebote
    (user_id, nummer, titel, datum, gueltig_bis, mwst_satz, eingabe_art)
  values
    ('11111111-1111-1111-1111-111111111111', 'AN-2026-9999', 'Kopie', current_date,
     current_date + 30, 19, 'kopie')
  returning eingabe_art into v_art;

  if v_art <> 'kopie' then
    raise exception 'FEHLER: Eingabe-Art "kopie" nicht gespeichert (%)', v_art;
  end if;

  raise notice '19. Angebote dürfen als Kopie gekennzeichnet werden';
end $$;

-- =========================================================================
-- 9. Zahlungserinnerung
-- =========================================================================
-- Erinnern muss auch an einer festgeschriebenen Rechnung gehen: wann erinnert
-- wurde, steht auf keinem Beleg. Die Beträge bleiben trotzdem gesperrt —
-- sonst hätte die Erinnerung ein Loch in die Unveränderlichkeit gerissen.
do $$
declare
  v_id uuid;
  v_zahl smallint;
begin
  select id into v_id from public.rechnungen where nummer = 'RE-2026-0001';

  update public.rechnungen
  set gemahnt_am = now(), mahnungen = 1
  where id = v_id;

  select mahnungen into v_zahl from public.rechnungen where id = v_id;
  if v_zahl <> 1 then
    raise exception 'FEHLER: Erinnerung nicht vermerkt (%)', v_zahl;
  end if;

  begin
    update public.rechnungen set brutto = 1 where id = v_id;
    raise exception 'SCHWERER FEHLER: Betrag über den Mahnweg änderbar';
  exception when check_violation then null;
  end;

  raise notice '20. Erinnerung vermerkbar, Beträge bleiben gesperrt';
end $$;

-- =========================================================================
-- 10. Speicherorte
-- =========================================================================
-- Die Datenschutzerklärung sagt zu, dass keine Sprachaufnahmen gespeichert
-- werden. Diese Zusage hängt hier nicht am Verhalten der Anwendung, sondern
-- daran, dass es den Ort dafür gar nicht gibt.
do $$
declare v_uebrig text[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_uebrig
  from storage.buckets;

  if v_uebrig <> array['logos'] then
    raise exception 'FEHLER: unerwartete Speicherorte: %', v_uebrig;
  end if;

  raise notice '21. Nur der Logo-Speicher existiert — kein Ort für Aufnahmen';
end $$;

-- =========================================================================
-- 11. Aufmass
-- =========================================================================
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_id   uuid;
  v_wert numeric;
  v_einh einheit;
begin
  insert into public.aufmass (user_id, titel)
  values ('11111111-1111-1111-1111-111111111111', 'Bad Lindenstr. 12')
  returning id into v_id;

  -- Fläche: 2,40 × 1,80 = 4,32 m²
  insert into public.aufmass_positionen
    (aufmass_id, pos_nr, raum, bezeichnung, art, laenge, breite)
  values (v_id, 1, 'Bad', 'Boden', 'flaeche', 2.40, 1.80);

  select wert, einheit into v_wert, v_einh
  from public.aufmass_positionen where aufmass_id = v_id and pos_nr = 1;

  if v_wert <> 4.32 then
    raise exception 'FEHLER: Fläche falsch gerechnet (%)', v_wert;
  end if;
  if v_einh <> 'm2' then
    raise exception 'FEHLER: Einheit folgt nicht der Art (%)', v_einh;
  end if;

  -- Anzahl geht mit ein: 3 × 1,20 × 1,40 = 5,04 m²
  insert into public.aufmass_positionen
    (aufmass_id, pos_nr, bezeichnung, art, laenge, breite, anzahl, abzug)
  values (v_id, 2, 'Fenster', 'flaeche', 1.20, 1.40, 3, true);

  select wert into v_wert from public.aufmass_positionen
  where aufmass_id = v_id and pos_nr = 2;
  if v_wert <> 5.04 then
    raise exception 'FEHLER: Anzahl nicht eingerechnet (%)', v_wert;
  end if;

  -- Fehlendes Mass ergibt NULL, nicht 0: eine 0 sähe aus wie ein Ergebnis.
  insert into public.aufmass_positionen
    (aufmass_id, pos_nr, bezeichnung, art, laenge)
  values (v_id, 3, 'Unvollständig', 'flaeche', 3.00);

  select wert into v_wert from public.aufmass_positionen
  where aufmass_id = v_id and pos_nr = 3;
  if v_wert is not null then
    raise exception 'FEHLER: unvollständiges Mass ergibt % statt NULL', v_wert;
  end if;

  raise notice '22. Aufmass -> Fläche, Anzahl und Einheit rechnet die Datenbank';

  -- Abgeschlossen heisst zu.
  update public.aufmass set status = 'abgeschlossen', abgeschlossen_am = now()
  where id = v_id;

  begin
    insert into public.aufmass_positionen (aufmass_id, pos_nr, bezeichnung, art, laenge, breite)
    values (v_id, 4, 'Nachträglich', 'flaeche', 1, 1);
    raise exception 'SCHWERER FEHLER: abgeschlossenes Aufmass nimmt noch Zeilen an';
  exception when check_violation then null;
  end;

  begin
    update public.aufmass_positionen set laenge = 99 where aufmass_id = v_id and pos_nr = 1;
    raise exception 'SCHWERER FEHLER: abgeschlossenes Aufmass ist noch änderbar';
  exception when check_violation then null;
  end;

  -- Wieder öffnen ist ausdrücklich erlaubt.
  update public.aufmass set status = 'offen' where id = v_id;
  update public.aufmass_positionen set laenge = 2.50 where aufmass_id = v_id and pos_nr = 1;

  raise notice '23. Abgeschlossenes Aufmass ist zu, wieder öffnen geht';
end $$;

-- Und fremde Aufmasse bleiben fremd.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v int;
begin
  select count(*) into v from public.aufmass;
  if v <> 0 then raise exception 'SICHERHEITSLÜCKE: fremdes Aufmass sichtbar (%)', v; end if;

  select count(*) into v from public.aufmass_positionen;
  if v <> 0 then
    raise exception 'SICHERHEITSLÜCKE: fremde Messungen sichtbar (%)', v;
  end if;

  raise notice '24. RLS -> fremde Aufmasse und Messungen bleiben unsichtbar';
end $$;

reset role;

-- =========================================================================
-- 12. Teilzahlungen
-- =========================================================================
set role app_user;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';

do $$
declare
  v_id     uuid;
  v_offen  numeric;
  v_bezahlt numeric;
begin
  select id into v_id from public.rechnungen where nummer = 'RE-2026-0001';

  insert into public.rechnung_zahlungen (rechnung_id, user_id, betrag, notiz)
  values (v_id, '11111111-1111-1111-1111-111111111111', 100.00, 'Anzahlung');

  select bezahlt, offen into v_bezahlt, v_offen
  from public.rechnung_zahlungsstand(v_id);

  if v_bezahlt <> 100.00 then
    raise exception 'FEHLER: Zahlungsstand falsch (%)', v_bezahlt;
  end if;

  -- Ein Betrag von 0 oder weniger ist keine Zahlung.
  begin
    insert into public.rechnung_zahlungen (rechnung_id, user_id, betrag)
    values (v_id, '11111111-1111-1111-1111-111111111111', 0);
    raise exception 'SCHWERER FEHLER: Nullbetrag wurde gebucht';
  exception when check_violation then null;
  end;

  raise notice '25. Teilzahlung -> gebucht, Stand stimmt, Nullbetrag abgewiesen';
end $$;

-- Auf einen Entwurf darf nichts gebucht werden.
do $$
declare v_id uuid;
begin
  insert into public.rechnungen (user_id, nummer, titel, datum, mwst_satz)
  values ('11111111-1111-1111-1111-111111111111', 'RE-2026-8888', 'Entwurf',
          current_date, 19)
  returning id into v_id;

  begin
    insert into public.rechnung_zahlungen (rechnung_id, user_id, betrag)
    values (v_id, '11111111-1111-1111-1111-111111111111', 50);
    raise exception 'SCHWERER FEHLER: Zahlung auf einen Entwurf gebucht';
  exception when insufficient_privilege then null;
  end;

  raise notice '26. Auf einen Entwurf lässt sich nichts buchen';
end $$;

-- Und fremde Zahlungen bleiben fremd.
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
do $$
declare v int;
begin
  select count(*) into v from public.rechnung_zahlungen;
  if v <> 0 then
    raise exception 'SICHERHEITSLÜCKE: fremde Zahlungen sichtbar (%)', v;
  end if;
  raise notice '27. RLS -> fremde Zahlungen bleiben unsichtbar';
end $$;

reset role;
