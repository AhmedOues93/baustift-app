-- Teilzahlungen fuer gestellte Rechnungen.
-- Zahlungen sind eigene, unveraenderliche Buchungen; die Rechnung selbst bleibt Beleg.
create table public.rechnung_zahlungen (
  id uuid primary key default gen_random_uuid(),
  rechnung_id uuid not null references public.rechnungen(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  betrag numeric(12,2) not null check (betrag > 0),
  bezahlt_am date not null default current_date,
  notiz text,
  created_at timestamptz not null default now()
);

create index rechnung_zahlungen_rechnung_idx
  on public.rechnung_zahlungen(rechnung_id, bezahlt_am, created_at);

alter table public.rechnung_zahlungen enable row level security;

create policy "rechnung_zahlungen: eigene Zahlungen lesen"
  on public.rechnung_zahlungen for select
  using (auth.uid() = user_id);

create policy "rechnung_zahlungen: eigene Zahlungen erfassen"
  on public.rechnung_zahlungen for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.rechnungen r
      where r.id = rechnung_id
        and r.user_id = auth.uid()
        and r.festgeschrieben_am is not null
        and r.status <> 'storniert'
    )
  );

create or replace function public.rechnung_zahlungsstand(p_rechnung_id uuid)
returns table(bezahlt numeric, offen numeric)
language sql stable security invoker set search_path = public
as $$
  select
    coalesce(sum(z.betrag), 0)::numeric(12,2) as bezahlt,
    greatest(r.brutto - coalesce(sum(z.betrag), 0), 0)::numeric(12,2) as offen
  from public.rechnungen r
  left join public.rechnung_zahlungen z on z.rechnung_id = r.id
  where r.id = p_rechnung_id and r.user_id = auth.uid()
  group by r.id, r.brutto
$$;
