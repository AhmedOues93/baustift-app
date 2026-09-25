-- =============================================================================
-- Ungenutzte Speicherorte entfernen
-- =============================================================================
-- 0002 hat drei Buckets angelegt. Benutzt wird nur einer:
--
--   logos     -> Firmenlogo fürs PDF. Bleibt.
--   audio     -> war für Original-Sprachaufnahmen gedacht. Die Anwendung
--                speichert sie bewusst nicht: eine Aufnahme von der Baustelle
--                enthält Namen, Anschriften und Gesprächsfetzen von Dritten,
--                und nach der Umwandlung in Text braucht sie niemand mehr.
--                audio_path ist überall null.
--   angebote  -> war für erzeugte PDFs gedacht. Die entstehen bei jedem Abruf
--                frisch, weil ein abgelegtes PDF ab der ersten Änderung am
--                Angebot falsch ist, ohne dass es jemand merkt. pdf_path ist
--                überall null.
--
-- Die Datenschutzerklärung sagt zu: wir speichern keine Sprachaufnahmen. Diese
-- Zusage soll nicht davon abhängen, dass niemand versehentlich Code schreibt,
-- der in einen dort noch vorhandenen Bucket schreibt. Ohne Bucket geht es
-- nicht — das ist der Unterschied zwischen einer Zusage und einer Garantie.
--
-- Gelöscht wird nur, was leer ist: die beiden Buckets wurden nie beschrieben.
-- Hat eine Installation doch Objekte darin, bleibt alles stehen und muss von
-- Hand angesehen werden. Stillschweigend Dateien zu löschen wäre schlimmer
-- als ein ungenutzter Bucket.
-- =============================================================================

do $$
declare
  v_bucket text;
  v_anzahl integer;
begin
  foreach v_bucket in array array['audio', 'angebote'] loop
    select count(*) into v_anzahl
    from storage.objects where bucket_id = v_bucket;

    if v_anzahl > 0 then
      raise warning 'Bucket % enthält % Objekte und bleibt bestehen. Bitte prüfen.',
        v_bucket, v_anzahl;
    else
      execute format('drop policy if exists %I on storage.objects',
                     v_bucket || ': eigener Ordner');
      delete from storage.buckets where id = v_bucket;
    end if;
  end loop;
end $$;
