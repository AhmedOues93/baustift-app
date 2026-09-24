-- Nachbau der Supabase-Bausteine, die es in einem nackten Postgres nicht gibt.
create schema if not exists auth;
create schema if not exists storage;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);

-- Supabase liest die User-ID aus dem JWT. Im Test simulieren wir das über
-- eine Session-Variable, die wir vor jeder Abfrage setzen.
create function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[]
language sql immutable as $$ select string_to_array(name, '/') $$;

-- Supabase gibt jedem eingeloggten Client die Rolle `authenticated`. Wir
-- bauen sie nach, damit die GRANTs aus den Migrationen hier genauso greifen.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

-- Rolle, die die App benutzt (kein Superuser -> RLS greift wirklich).
create role app_user login;
grant usage on schema public, auth, storage to app_user;
grant authenticated to app_user;
