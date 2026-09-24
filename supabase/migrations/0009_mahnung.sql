-- =============================================================================
-- Zahlungserinnerung
-- =============================================================================
-- Das Geld kommt nicht von der schönsten Rechnung, sondern von der, an die
-- erinnert wurde. Kleinbetriebe schieben genau das auf — es ist unangenehm,
-- und ohne Überblick weiss man nicht einmal, wen man schon erinnert hat.
--
-- Zwei Felder reichen dafür: wann zuletzt erinnert wurde und wie oft. Beide
-- gehören zur Rechnung, nicht in eine eigene Tabelle: es sind Eigenschaften
-- des Vorgangs, keine eigene Geschäftsentität.
--
-- Wichtig fürs Verständnis: die Unveränderlichkeit gestellter Rechnungen
-- (0005) bleibt davon unberührt. Sie schützt den Beleg — Nummer, Datum,
-- Beträge, Positionen. Wann erinnert wurde, steht auf keinem Beleg und ist
-- deshalb auch nach dem Festschreiben noch änderbar.
-- =============================================================================

alter table public.rechnungen
  add column gemahnt_am timestamptz,
  add column mahnungen  smallint not null default 0;

comment on column public.rechnungen.gemahnt_am is
  'Zeitpunkt der letzten Zahlungserinnerung an den Kunden.';
comment on column public.rechnungen.mahnungen is
  'Wie oft bereits erinnert wurde. 0 = noch gar nicht.';
