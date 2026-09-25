-- =============================================================================
-- Angebote aus dem Aufmass kennzeichnen
-- =============================================================================
-- Wie die Kopie (0008): ein Angebot aus dem Aufmass ist weder diktiert noch
-- getippt. Es als "text" zu zählen würde die Zahl verderben, um die es im
-- Piloten geht — wie oft wird wirklich gesprochen.
--
-- Dass es einen eigenen Wert bekommt, beantwortet nebenbei die zweite Frage
-- des Piloten: wird der Aufmass-Modus überhaupt benutzt, oder diktieren alle
-- weiter frei?
-- =============================================================================

alter type eingabe_art add value if not exists 'aufmass';
