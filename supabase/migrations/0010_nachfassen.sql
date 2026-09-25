-- =============================================================================
-- Nachfassen
-- =============================================================================
-- Ein verschicktes Angebot, auf das niemand antwortet, ist kein verlorener
-- Auftrag — es ist ein vergessener. Die Liste zeigt seit jeher, wie viele
-- davon liegen; getan hat man damit nichts. Damit ein Nachhaken möglich ist,
-- ohne beim zweiten Mal wieder bei null anzufangen, merkt sich das Angebot,
-- wann zuletzt nachgehakt wurde.
--
-- Wie bei der Zahlungserinnerung: zwei Felder an der Sache selbst, keine
-- eigene Tabelle.
-- =============================================================================

alter table public.angebote
  add column nachgefasst_am timestamptz,
  add column nachfassungen  smallint not null default 0;

comment on column public.angebote.nachgefasst_am is
  'Zeitpunkt der letzten Nachfrage beim Kunden.';
comment on column public.angebote.nachfassungen is
  'Wie oft schon nachgehakt wurde. 0 = noch gar nicht.';
