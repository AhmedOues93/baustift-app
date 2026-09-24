-- =============================================================================
-- Angebote kopieren
-- =============================================================================
-- Derselbe Badumbau, andere Wohnung: der häufigste Fall im Handwerk. Bisher
-- musste dafür ein zweites Mal diktiert werden — für ein Ergebnis, das schon
-- da war, und für KI-Kosten, die wir zweimal zahlen.
--
-- Eine Kopie ist keine Spracheingabe und keine Texteingabe. Sie als "text" zu
-- zählen würde die eine Zahl verderben, um die es im Piloten geht: wie oft
-- wird wirklich gesprochen. Deshalb bekommt sie ihren eigenen Wert.
-- =============================================================================

alter type eingabe_art add value if not exists 'kopie';

comment on column public.angebote.eingabe_art is
  'Wie ist das Angebot entstanden: diktiert (sprache), getippt (text) oder '
  'aus einem anderen Angebot kopiert (kopie). Grundlage der Pilot-Auswertung.';
