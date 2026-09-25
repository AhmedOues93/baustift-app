-- Baustellendokumentation: append-only Fotos/Notizen pro Auftrag.
create type auftrag_doku_art as enum ('notiz','foto');
create table public.auftrag_dokumentation (
 id uuid primary key default gen_random_uuid(),
 auftrag_id uuid not null references public.auftraege(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 art auftrag_doku_art not null,
 text text,
 datei_pfad text,
 created_at timestamptz not null default now(),
 check ((art='notiz' and text is not null) or (art='foto' and datei_pfad is not null))
);
create index auftrag_doku_idx on public.auftrag_dokumentation(auftrag_id,created_at desc);
alter table public.auftrag_dokumentation enable row level security;
create policy "auftrag_dokumentation: eigene lesen" on public.auftrag_dokumentation for select using (auth.uid()=user_id and exists(select 1 from public.auftraege a where a.id=auftrag_id and a.user_id=auth.uid()));
create policy "auftrag_dokumentation: eigene anlegen" on public.auftrag_dokumentation for insert with check (auth.uid()=user_id and exists(select 1 from public.auftraege a where a.id=auftrag_id and a.user_id=auth.uid()));
