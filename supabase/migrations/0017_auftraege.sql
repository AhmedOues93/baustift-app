-- Auftraege: angenommene Angebote werden zu ausfuehrbaren Baustellen.
create type auftrag_status as enum ('geplant','in_arbeit','fertig','abgerechnet');

create table public.auftraege (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kunde_id uuid references public.kunden(id) on delete set null,
  angebot_id uuid references public.angebote(id) on delete set null,
  titel text not null default '',
  status auftrag_status not null default 'geplant',
  termin_von timestamptz,
  termin_bis timestamptz,
  adresse text,
  notiz text,
  fertig_am timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, angebot_id)
);
create index auftraege_user_idx on public.auftraege(user_id, status, created_at desc);
create index auftraege_kunde_idx on public.auftraege(kunde_id);
create trigger auftraege_touch before update on public.auftraege for each row execute function public.touch_updated_at();
alter table public.auftraege enable row level security;
create policy "auftraege: eigene" on public.auftraege for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
