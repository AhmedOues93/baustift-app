-- =============================================================================
-- Reihenfolge der Stripe-Ereignisse
-- =============================================================================
-- Stripe garantiert die Zustellung, aber nicht die Reihenfolge. Ein erneuter
-- Versuch eines älteren Ereignisses kann nach einem neueren ankommen — etwa
-- "subscription.updated (unbezahlt)" von vor zwei Minuten, nachdem die
-- Zahlung längst durch ist.
--
-- Bisher hätte das den Nutzer herabgestuft, der gerade bezahlt hat. Deshalb
-- merkt sich das Profil, wie alt das zuletzt verarbeitete Ereignis war;
-- ältere werden quittiert und verworfen.
-- =============================================================================

alter table public.profiles
  add column stripe_ereignis_am timestamptz;

comment on column public.profiles.stripe_ereignis_am is
  'Zeitpunkt des zuletzt verarbeiteten Stripe-Ereignisses. Ältere Ereignisse '
  'werden verworfen, weil Stripe die Reihenfolge nicht garantiert.';
