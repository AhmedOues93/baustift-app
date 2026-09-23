#!/usr/bin/env bash
#
# Schema-Test gegen ein echtes Postgres.
#
# Warum überhaupt: die halbe Geschäftslogik steckt in der Datenbank (Trigger für
# die Summen, Nummernkreis, vor allem RLS). Ein Fehler in einer RLS-Policy ist
# kein Schönheitsfehler, sondern zeigt einem Betrieb die Preise des Nachbarn.
# Das gehört getestet, nicht gehofft.
#
# Die Datei supabase/test/00_supabase_stubs.sql baut die Teile nach, die
# Supabase mitbringt (auth.users, auth.uid(), storage.*), damit der Test ohne
# Supabase-Instanz und ohne Docker läuft.
#
# Aufruf:  ./scripts/db-test.sh
# Voraussetzung: laufendes Postgres, Verbindung über PGHOST/PGPORT/PGUSER
#                oder DATABASE_URL.
set -euo pipefail

DB="${BAUSTIFT_TEST_DB:-baustift_test}"
PSQL=(psql -q -v ON_ERROR_STOP=1)

echo "→ Testdatenbank '$DB' neu aufbauen"
psql -q -c "drop database if exists $DB" postgres
psql -q -c "drop role if exists app_user" postgres
psql -q -c "create database $DB" postgres

echo "→ Supabase-Bausteine nachbauen"
"${PSQL[@]}" -d "$DB" -f supabase/test/00_supabase_stubs.sql

echo "→ Migrationen einspielen"
for f in supabase/migrations/*.sql; do
  echo "   $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "→ Ablauf prüfen"
"${PSQL[@]}" -d "$DB" -f supabase/test/10_flow.sql

echo "✓ Schema, Trigger und RLS in Ordnung"
