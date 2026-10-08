/**
 * =============================================================================
 * Rechnet der Bildschirm wie die Datenbank?
 * =============================================================================
 * Im Angebot wird an zwei Stellen gerechnet: im Browser, damit der Handwerker
 * beim Tippen sofort die Summe sieht, und in Postgres, woher das PDF seine
 * Zahlen nimmt. Weichen die beiden ab, steht auf dem Bildschirm ein anderer
 * Betrag als in dem Dokument, das beim Kunden landet.
 *
 * Genau das war der Fall: 388 von 30 000 realistischen Kombinationen gingen
 * um einen Cent auseinander. Dieses Skript erzeugt die Fälle mit der echten
 * Anwendungslogik und lässt Postgres dieselben Zahlen rechnen.
 *
 * Aufruf über scripts/db-test.sh — eine laufende Datenbank wird gebraucht.
 */

import { writeFileSync } from "node:fs";

import { mwstBetrag, zeilensumme } from "../src/lib/rechnen.ts";

const ziel = process.argv[2];
if (!ziel) {
  console.error("Aufruf: node scripts/rechnen-abgleich.mjs <ziel.sql>");
  process.exit(1);
}

const zeilen = [];
// Mengen mit drei Nachkommastellen — dort lag der Fehler.
for (let m = 1; m <= 3000; m++) {
  const menge = m / 1000;
  for (const preis of [0.01, 0.05, 1, 1.5, 2.5, 7.5, 12.34, 48, 65, 1450]) {
    zeilen.push(`(${menge},${preis},${zeilensumme(menge, preis)})`);
  }
}
// Grössere Mengen, wie sie im Erd- und Trockenbau vorkommen.
for (let m = 1; m <= 500; m++) {
  for (const preis of [0.33, 3.33, 17.85, 99.99]) {
    zeilen.push(`(${(m * 1.125).toFixed(3)},${preis},${zeilensumme(m * 1.125, preis)})`);
  }
}

const steuer = [];
for (let cent = 1; cent <= 20000; cent++) {
  const netto = cent / 100;
  for (const satz of [19, 7, 0, 16, 5.5]) {
    steuer.push(`(${netto},${satz},${mwstBetrag(netto, satz)})`);
  }
}

writeFileSync(
  ziel,
  [
    "-- Erzeugt von scripts/rechnen-abgleich.mjs. Nicht von Hand ändern.",
    "create temp table abgleich_zeilen(menge numeric(12,3), preis numeric(12,2), js numeric(12,2));",
    `insert into abgleich_zeilen values ${zeilen.join(",")};`,
    "do $$",
    "declare v int;",
    "begin",
    "  select count(*) into v from abgleich_zeilen where round(menge * preis, 2) <> js;",
    "  if v > 0 then",
    "    raise exception 'Zeilensumme: % von % Fällen rechnen im Browser anders als in der Datenbank',",
    "      v, (select count(*) from abgleich_zeilen);",
    "  end if;",
    "  raise notice 'Zeilensummen: % Fälle, keine Abweichung', (select count(*) from abgleich_zeilen);",
    "end $$;",
    "create temp table abgleich_steuer(netto numeric(12,2), satz numeric(5,2), js numeric(12,2));",
    `insert into abgleich_steuer values ${steuer.join(",")};`,
    "do $$",
    "declare v int;",
    "begin",
    "  select count(*) into v from abgleich_steuer where round(netto * satz / 100, 2) <> js;",
    "  if v > 0 then",
    "    raise exception 'Umsatzsteuer: % von % Fällen weichen ab',",
    "      v, (select count(*) from abgleich_steuer);",
    "  end if;",
    "  raise notice 'Umsatzsteuer: % Fälle, keine Abweichung', (select count(*) from abgleich_steuer);",
    "end $$;",
  ].join("\n"),
);
