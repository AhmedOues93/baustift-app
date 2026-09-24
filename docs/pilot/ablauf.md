# Pilotbetrieb — Ablauf

Kurzanleitung für den Betrieb des Tests. Keine Theorie, nur die Handgriffe.

## Wozu der Pilot da ist

Vier Fragen, und nur vier:

1. **Wird wirklich gesprochen?** Die ganze Produktidee steht und fällt damit.
   Wenn alle tippen, ist Baustift eine Angebotssoftware unter vielen.
2. **Trifft das Preis-Matching?** Gemessen am Anteil Positionen „zu prüfen“.
   Über einem Drittel fühlt sich das Produkt kaputt an, auch wenn es
   technisch richtig arbeitet.
3. **Was kostet ein Angebot wirklich?** Entscheidet, ob 39 € im Monat tragen.
4. **Wird aus einem Angebot Arbeit?** Verschickt → angenommen.

Alles andere ist im Piloten Beiwerk.

## Wen einladen

**Drei bis fünf Betriebe.** Weniger sagt nichts, mehr kann man nicht
betreuen — und im Piloten ist das Gespräch wichtiger als die Menge.

Gute Testbetriebe:
- schreiben selbst Angebote (Inhaber oder Meister, nicht das Büro)
- haben ihre Preise schon irgendwo (Excel, Handwerkersoftware, Zettel)
- arbeiten viel auswärts — dort entsteht der Bedarf

## Ein Testkonto einrichten

1. Der Betrieb registriert sich ganz normal.
2. Im Supabase-SQL-Editor auf Testbetrieb stellen:

```sql
update profiles
set subscription_status = 'pilot'
where email = 'chef@betrieb.de';
```

Damit bekommt das Konto 500 Angebote im Monat, den Rückmeldeknopf unten
links und die Auswertung unter Konto → „Zahlen aus dem Test ansehen“.

## Während des Piloten

- **Einmal pro Woche** kurz anrufen. Fünf Minuten. Wer nur auf schriftliche
  Rückmeldungen wartet, bekommt keine.
- Die Rückmeldungen aus der App stehen in der Tabelle `feedback`, mit der
  Seite, auf der sie entstanden sind.

## Die Zahlen ansehen

Jeder Betrieb sieht seine eigenen unter **Konto → Zahlen aus dem Test**.
Für den Blick über alle Testkonten hinweg im SQL-Editor:

```sql
-- Sprache gegen Tastatur, über alle Testbetriebe
select
  count(*)                                              as angebote,
  count(*) filter (where eingabe_art = 'sprache')       as per_sprache,
  count(*) filter (where eingabe_art = 'text')          as per_text,
  round(avg(aufnahme_sekunden))                         as sekunden_schnitt
from angebote;

-- Güte des Preis-Matchings
select
  count(*)                                   as positionen,
  count(*) filter (where zu_pruefen)         as ohne_preis,
  round(100.0 * count(*) filter (where zu_pruefen) / nullif(count(*), 0)) as prozent
from positionen;

-- Was uns ein Angebot kostet (in Euro)
select
  round(sum(kosten_zehntelcent) / 1000.0, 2)                    as kosten_gesamt,
  round(sum(kosten_zehntelcent) / 1000.0
        / nullif((select count(*) from angebote), 0), 3)        as je_angebot
from ki_nutzung;

-- Alle Rückmeldungen, neueste zuerst
select f.created_at, p.firma_name, f.art, f.seite, f.text
from feedback f
join profiles p on p.id = f.user_id
order by f.created_at desc;
```

## Wann der Pilot vorbei ist

Nach vier Wochen oder wenn jeder Betrieb zehn Angebote erstellt hat — was
zuerst eintritt. Danach entscheiden:

| Beobachtung | Was es bedeutet |
| --- | --- |
| Sprache unter 40 % | Die Kernidee trägt nicht. Erst klären warum, bevor irgendetwas gebaut wird. |
| „Ohne Preis“ über 33 % | Nicht verkaufen. Erst Matching und Import verbessern. |
| Kosten je Angebot über 0,15 € | Preis oder Modellwahl überdenken. |
| Angebote werden erstellt, aber nicht verschickt | Irgendwo zwischen Prüfen und Versenden bricht es ab. Nachfragen. |
