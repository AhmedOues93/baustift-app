-- =============================================================================
-- Aufmass
-- =============================================================================
-- Die Hälfte, die bisher fehlte. Ein Angebot entsteht nicht aus dem Nichts,
-- sondern aus Massen: Wandflächen, Bodenflächen, laufende Meter. Bisher
-- standen die auf einem Zettel, wurden abends abgetippt, und dabei ging der
-- Zettel verloren oder eine Zahl daneben.
--
-- ZWEI TABELLEN, EINE ENTSCHEIDUNG DAHINTER:
--
-- Die Session (`aufmass`) ist langlebig, die Aufnahme ist es nicht. Ein
-- Aufmass dauert eine halbe Stunde, mit Pausen, Telefonaten und einer
-- Bildschirmsperre dazwischen — eine durchlaufende Tonaufnahme würde das auf
-- einem iPhone nicht überleben, weil der Browser sie beim Sperren beendet.
-- Deshalb ist die Session hier eine Zeile in der Datenbank, die offen bleibt,
-- und jede Messung eine eigene, kurze Aufnahme. Pausen kosten dann nichts,
-- weil nichts läuft.
--
-- Gerechnet wird in der Datenbank (generierte Spalte), nicht in der
-- Anwendung: dieselbe Regel wie bei den Angebotssummen. Ein Wert, den die
-- Liste anders ausrechnet als das Angebot, ist ein Fehler, den niemand
-- bemerkt, bis ein Kunde nachmisst.
-- =============================================================================

create type aufmass_status as enum ('offen', 'abgeschlossen');

-- Was für ein Mass ist das? Bestimmt die Rechnung und die Einheit.
create type messung_art as enum (
  'flaeche',   -- Länge × Breite        -> m²
  'laenge',    -- nur Länge             -> m
  'volumen',   -- Länge × Breite × Höhe -> m³
  'stueck'     -- gezählt               -> Stk.
);

create table public.aufmass (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  kunde_id         uuid references public.kunden (id) on delete set null,
  titel            text not null default '',
  status           aufmass_status not null default 'offen',
  notiz            text,
  -- Das Angebot, das aus diesem Aufmass entstanden ist. Bleibt leer, solange
  -- keins erzeugt wurde; wird das Angebot gelöscht, bleibt das Aufmass.
  angebot_id       uuid references public.angebote (id) on delete set null,
  abgeschlossen_am timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.aufmass_positionen (
  id          uuid primary key default gen_random_uuid(),
  aufmass_id  uuid not null references public.aufmass (id) on delete cascade,
  pos_nr      integer not null,

  -- Wo und was: "Bad" / "Wand 1". Der Raum ist optional — wer ein einzelnes
  -- Zimmer aufmisst, nennt ihn nicht.
  raum        text,
  bezeichnung text not null default '',

  art         messung_art not null default 'flaeche',

  -- Die Masse in Metern. Welche gebraucht werden, hängt an `art`; die
  -- übrigen bleiben leer, statt mit einer stillen 0 belegt zu werden.
  laenge      numeric(10, 3),
  breite      numeric(10, 3),
  hoehe       numeric(10, 3),

  -- Gleiche Masse mehrfach: "drei Fenster je 1,20 auf 1,40".
  anzahl      numeric(10, 3) not null default 1,

  -- Abzüge sind im Aufmass Alltag: Fenster und Türen gehen von der
  -- Wandfläche ab. Als eigene Zeile mit Vorzeichen statt als Sonderfall —
  -- so bleibt nachvollziehbar, WAS abgezogen wurde.
  abzug       boolean not null default false,

  /**
   * Der gerechnete Wert. NULL, solange ein nötiges Mass fehlt — das ist
   * ehrlicher als eine 0, die aussieht wie ein Ergebnis.
   */
  wert numeric(12, 3) generated always as (
    case art
      when 'flaeche' then
        case when laenge is null or breite is null
             then null else anzahl * laenge * breite end
      when 'volumen' then
        case when laenge is null or breite is null or hoehe is null
             then null else anzahl * laenge * breite * hoehe end
      when 'laenge' then
        case when laenge is null then null else anzahl * laenge end
      else anzahl
    end
  ) stored,

  /** Einheit folgt aus der Art — zwei Quellen dafür wären eine zu viel. */
  einheit einheit generated always as (
    case art
      when 'flaeche' then 'm2'::einheit
      when 'volumen' then 'm3'::einheit
      when 'laenge'  then 'm'::einheit
      else 'stk'::einheit
    end
  ) stored,

  /** Was gesprochen wurde. Bleibt stehen, damit ein Wert prüfbar ist. */
  gesprochen  text,
  /** Konnte der Parser das nicht sicher deuten? Dann gelb markieren. */
  zu_pruefen  boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  unique (aufmass_id, pos_nr)
);

create index aufmass_user_idx on public.aufmass (user_id, created_at desc);
create index aufmass_kunde_idx on public.aufmass (kunde_id);
create index aufmass_positionen_idx on public.aufmass_positionen (aufmass_id, pos_nr);

create trigger aufmass_touch before update on public.aufmass
  for each row execute function public.touch_updated_at();
create trigger aufmass_positionen_touch before update on public.aufmass_positionen
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Zugriff
-- -----------------------------------------------------------------------------
alter table public.aufmass enable row level security;
alter table public.aufmass_positionen enable row level security;

create policy "aufmass: eigene" on public.aufmass
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Die Positionen hängen am Aufmass; geprüft wird über dessen Eigentümer.
create policy "aufmass_positionen: eigene" on public.aufmass_positionen
  for all
  using (exists (
    select 1 from public.aufmass a
    where a.id = aufmass_id and a.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.aufmass a
    where a.id = aufmass_id and a.user_id = auth.uid()
  ));

-- -----------------------------------------------------------------------------
-- Abgeschlossene Aufmasse sind zu
-- -----------------------------------------------------------------------------
-- Nicht aus Buchhaltungsgründen wie bei der Rechnung, sondern gegen den
-- Alltagsfehler: das Aufmass ist im Angebot verrechnet, jemand ändert
-- nachträglich eine Zahl, und das verschickte Angebot passt nicht mehr zu den
-- Massen, auf die es sich beruft. Wieder öffnen geht ausdrücklich — dann aber
-- sichtbar und als Entscheidung.
create or replace function public.aufmass_position_offen()
returns trigger
language plpgsql
as $$
declare
  v_status aufmass_status;
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

create trigger aufmass_positionen_nur_offen
  before insert or update or delete on public.aufmass_positionen
  for each row execute function public.aufmass_position_offen();
