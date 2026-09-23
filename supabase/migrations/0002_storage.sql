-- =============================================================================
-- Baustift — Storage-Buckets
-- =============================================================================
-- Drei Buckets, alle privat. Der Zugriff läuft über signierte URLs, die der
-- Server nur für den Eigentümer erzeugt.
--
-- Konvention für alle Pfade: <user_id>/<datei>
-- Genau darauf bauen die Policies auf: das erste Pfadsegment muss die eigene
-- User-ID sein (`storage.foldername(name)[1]`).
-- =============================================================================

insert into storage.buckets (id, name, public)
values
  ('logos',    'logos',    false),   -- Firmenlogo fürs PDF
  ('audio',    'audio',    false),   -- Original-Sprachaufnahmen
  ('angebote', 'angebote', false)    -- generierte Angebots-PDFs
on conflict (id) do nothing;

-- Eine Policy-Familie pro Bucket. `for all` deckt select/insert/update/delete ab.
create policy "logos: eigener Ordner"
  on storage.objects for all
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "audio: eigener Ordner"
  on storage.objects for all
  using (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audio' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "angebote: eigener Ordner"
  on storage.objects for all
  using (bucket_id = 'angebote' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'angebote' and (storage.foldername(name))[1] = auth.uid()::text);
