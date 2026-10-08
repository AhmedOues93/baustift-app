-- =============================================================================
-- Kundenannahme per Link
-- =============================================================================
-- Bisher endete der Weg beim Versand: der Handwerker schickte das PDF und
-- wartete auf einen Anruf. Ob der Kunde es überhaupt geöffnet hat, wusste er
-- nicht; angenommen oder abgelehnt trug er selbst nach — wenn er daran dachte.
--
-- Jetzt bekommt jedes Angebot einen eigenen Link. Der Kunde sieht dort die
-- Positionen und die Summe, kann das PDF laden und mit einem Antippen zu- oder
-- absagen. Für ihn ohne Konto, ohne Anmeldung, ohne App.
--
-- SICHERHEIT. Ein öffentlicher Link ist eine Tür in die Datenbank, also:
--
--  * Der Schlüssel ist zufällig und 192 Bit lang. Raten scheidet aus.
--  * Gelesen und geschrieben wird ausschliesslich über die beiden Funktionen
--    unten. Sie laufen als `security definer`, geben aber nur die Zeile zu
--    genau diesem Schlüssel heraus — kein Zugriff auf andere Angebote, keine
--    Preisliste, keine anderen Kunden, keine Tabelle, die der Kunde nicht
--    sehen soll.
--  * Die RLS-Regeln der Tabellen bleiben unangetastet. Der öffentliche Weg
--    bekommt KEINE Policy, die etwas freigibt — sonst wäre der Schlüssel nur
--    noch eine Formsache.
--  * Entschieden wird einmal. Ein zweiter Aufruf ändert nichts mehr, auch
--    nicht vom Handwerker aus.
-- =============================================================================

create extension if not exists pgcrypto;

alter table public.angebote
  -- base64url, damit der Link ohne Prozentzeichen auskommt und sich notfalls
  -- vorlesen lässt.
  add column freigabe_token text unique
    default replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_'),
  -- Wann hat der Kunde das Angebot zum ersten Mal geöffnet? Das ist die
  -- Information, die dem Handwerker heute fehlt: "liegt es noch ungelesen da
  -- oder denkt er darüber nach?"
  add column freigabe_geoeffnet_am timestamptz,
  -- Wer hat entschieden — der Betrieb im Nachhinein oder der Kunde selbst?
  add column entschieden_durch text
    check (entschieden_durch in ('betrieb', 'kunde')),
  -- Was der Kunde beim Zu- oder Absagen dazugeschrieben hat.
  add column kunden_anmerkung text;

-- Bestandsangebote bekommen ebenfalls einen Schlüssel; die Spalte ist sonst
-- bei allem, was vor dieser Migration angelegt wurde, leer.
update public.angebote
set freigabe_token = replace(replace(encode(gen_random_bytes(24), 'base64'), '+', '-'), '/', '_')
where freigabe_token is null;

alter table public.angebote alter column freigabe_token set not null;

create index angebote_freigabe_token_idx on public.angebote (freigabe_token);

-- -----------------------------------------------------------------------------
-- Lesen: Angebot zu einem Schlüssel
-- -----------------------------------------------------------------------------
-- Gibt genau das zurück, was auf der öffentlichen Seite steht — und sonst
-- nichts. Kein Transkript (da stehen Gesprächsfetzen drin), kein KI-Hinweis,
-- keine internen Notizen, keine Kundenliste.
create or replace function public.angebot_per_token(p_token text)
returns table (
  id uuid,
  nummer text,
  titel text,
  status text,
  datum date,
  gueltig_bis date,
  netto numeric,
  mwst_satz numeric,
  mwst_betrag numeric,
  brutto numeric,
  notiz text,
  entschieden_am timestamptz,
  entschieden_durch text,
  kunden_anmerkung text,
  kunde_name text,
  firma_name text,
  firma_strasse text,
  firma_plz text,
  firma_ort text,
  firma_telefon text,
  firma_email text,
  firma_kleinunternehmer boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    a.id, a.nummer, a.titel, a.status::text, a.datum, a.gueltig_bis,
    a.netto, a.mwst_satz, a.mwst_betrag, a.brutto, a.notiz,
    a.entschieden_am, a.entschieden_durch, a.kunden_anmerkung,
    k.name,
    p.firma_name, p.strasse, p.plz, p.ort, p.telefon, p.email, p.kleinunternehmer
  from public.angebote a
  join public.profiles p on p.id = a.user_id
  left join public.kunden k on k.id = a.kunde_id
  where a.freigabe_token = p_token
    -- Ein Entwurf hat beim Kunden nichts verloren, auch nicht über einen
    -- Link, den jemand zu früh weitergegeben hat.
    and a.status <> 'entwurf';
$$;

revoke all on function public.angebot_per_token(text) from public;
grant execute on function public.angebot_per_token(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Lesen: Positionen zu einem Schlüssel
-- -----------------------------------------------------------------------------
create or replace function public.angebot_positionen_per_token(p_token text)
returns table (
  pos_nr integer,
  bezeichnung text,
  beschreibung text,
  menge numeric,
  einheit text,
  einzelpreis numeric,
  gesamtpreis numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select pos.pos_nr, pos.bezeichnung, pos.beschreibung, pos.menge,
         pos.einheit::text, pos.einzelpreis, pos.gesamtpreis
  from public.positionen pos
  join public.angebote a on a.id = pos.angebot_id
  where a.freigabe_token = p_token
    and a.status <> 'entwurf'
  order by pos.pos_nr;
$$;

revoke all on function public.angebot_positionen_per_token(text) from public;
grant execute on function public.angebot_positionen_per_token(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Öffnen vermerken
-- -----------------------------------------------------------------------------
-- Nur das erste Mal. Ein zweiter Blick des Kunden soll die Uhr nicht
-- zurückdrehen — sonst stünde beim Handwerker immer "gerade eben geöffnet".
create or replace function public.angebot_geoeffnet(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.angebote
  set freigabe_geoeffnet_am = now()
  where freigabe_token = p_token
    and status <> 'entwurf'
    and freigabe_geoeffnet_am is null;
$$;

revoke all on function public.angebot_geoeffnet(text) from public;
grant execute on function public.angebot_geoeffnet(text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Entscheiden
-- -----------------------------------------------------------------------------
-- Gibt zurück, ob die Entscheidung angekommen ist. Falsch heisst: der
-- Schlüssel passt nicht, das Angebot ist noch ein Entwurf, oder es ist schon
-- entschieden — in allen drei Fällen soll die Seite dasselbe sagen und nicht
-- verraten, welcher der Fälle zutrifft.
create or replace function public.angebot_entscheiden(
  p_token text,
  p_entscheidung text,
  p_anmerkung text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anzahl int;
begin
  if p_entscheidung not in ('angenommen', 'abgelehnt') then
    return false;
  end if;

  update public.angebote
  set status            = p_entscheidung::angebot_status,
      entschieden_am    = now(),
      entschieden_durch = 'kunde',
      -- Leere Eingaben nicht als leeren Text speichern.
      kunden_anmerkung  = nullif(btrim(coalesce(p_anmerkung, '')), '')
  where freigabe_token = p_token
    and status = 'gesendet';

  get diagnostics v_anzahl = row_count;
  return v_anzahl = 1;
end;
$$;

revoke all on function public.angebot_entscheiden(text, text, text) from public;
grant execute on function public.angebot_entscheiden(text, text, text) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Für das PDF: welches Angebot steckt hinter diesem Schlüssel?
-- -----------------------------------------------------------------------------
-- Gibt nur die beiden Kennungen zurück, nicht die Daten. Die PDF-Route lädt
-- damit anschliessend genau dieses eine Angebot — die Berechtigungsfrage ist
-- an dieser Stelle schon beantwortet, und zwar in der Datenbank.
create or replace function public.angebot_id_per_token(p_token text)
returns table (angebot_id uuid, besitzer uuid)
language sql
security definer
set search_path = public
stable
as $$
  select id, user_id
  from public.angebote
  where freigabe_token = p_token
    and status <> 'entwurf';
$$;

revoke all on function public.angebot_id_per_token(text) from public;
grant execute on function public.angebot_id_per_token(text) to anon, authenticated;
