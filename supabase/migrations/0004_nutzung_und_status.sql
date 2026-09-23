-- =============================================================================
-- KI-Nutzung (Kostenkontrolle) und Angebots-Zeitstempel
-- =============================================================================
-- Zwei Dinge, die ein verkaufsfertiges Produkt braucht und ein Prototyp nicht:
--
--  1. Jeder KI-Lauf kostet echtes Geld. Ohne Zählung kennt man weder die
--     Marge pro Kunde noch merkt man, wenn ein einzelnes Konto die Rechnung
--     sprengt. Deshalb wird jede Extraktion protokolliert.
--  2. "Nachfassen" braucht einen Zeitpunkt, ab dem gezählt wird.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ki_nutzung — ein Datensatz pro KI-Lauf
-- -----------------------------------------------------------------------------
create table public.ki_nutzung (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  angebot_id    uuid references public.angebote (id) on delete set null,

  -- 'transkription' (Whisper) oder 'extraktion' (Claude)
  art           text not null,
  modell        text not null,

  eingabe_token integer not null default 0,
  ausgabe_token integer not null default 0,
  cache_token   integer not null default 0,
  audio_sekunden integer not null default 0,

  -- In Zehntel-Cent, damit auch ein Lauf für 0,04 € nicht auf 0 gerundet wird.
  kosten_zehntelcent integer not null default 0,

  created_at    timestamptz not null default now()
);

create index ki_nutzung_user_monat_idx
  on public.ki_nutzung (user_id, created_at desc);

alter table public.ki_nutzung enable row level security;

-- Lesen darf der Nutzer (für die Anzeige "X von Y Angeboten diesen Monat").
-- Schreiben macht ausschliesslich der Server mit dem Service-Role-Key —
-- bewusst KEINE Insert-Policy: sonst könnte der Client seinen eigenen
-- Verbrauch kleinschreiben.
create policy "ki_nutzung: eigene Nutzung lesen"
  on public.ki_nutzung for select using (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- Zählt die Angebote des laufenden Monats (Grundlage fürs Kontingent).
-- -----------------------------------------------------------------------------
create or replace function public.angebote_diesen_monat(p_user_id uuid)
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer
  from public.angebote
  where user_id = p_user_id
    and created_at >= date_trunc('month', now())
$$;

-- -----------------------------------------------------------------------------
-- Angebote: Zeitstempel fürs Nachfassen
-- -----------------------------------------------------------------------------
alter table public.angebote
  add column gesendet_am timestamptz,
  add column entschieden_am timestamptz;

comment on column public.angebote.gesendet_am is
  'Wann das Angebot rausging. Basis für "seit X Tagen ohne Antwort".';

-- -----------------------------------------------------------------------------
-- Profile: Zustimmung zur Auftragsverarbeitung (AV-Vertrag)
-- -----------------------------------------------------------------------------
-- Der Handwerker ist Verantwortlicher für die Daten seiner Kunden, wir sind
-- Auftragsverarbeiter. Der Zeitpunkt der Zustimmung muss nachweisbar sein.
alter table public.profiles
  add column av_zugestimmt_am timestamptz,
  add column agb_zugestimmt_am timestamptz;
