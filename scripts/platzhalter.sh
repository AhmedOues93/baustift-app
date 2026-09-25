#!/usr/bin/env bash
#
# Findet die offenen Platzhalter in den Rechtstexten.
#
# Warum als Skript und nicht als Test: ein fehlschlagender Test würde die
# Entwicklung blockieren, obwohl die Platzhalter während der Arbeit völlig in
# Ordnung sind. Gebraucht wird die Liste genau einmal — vor dem ersten echten
# Nutzer. Dann aber vollständig.
#
# Aufruf:  ./scripts/platzhalter.sh
set -euo pipefail

ORDNER="src/app/rechtliches"
cd "$(dirname "$0")/.."

echo "Offene Platzhalter in $ORDNER"
echo

gefunden=0
for datei in "$ORDNER"/*/page.tsx; do
  treffer=$(grep -o '\[[^]]\{3,\}\]' "$datei" | sort -u || true)
  if [ -n "$treffer" ]; then
    seite=$(basename "$(dirname "$datei")")
    echo "  $seite"
    while IFS= read -r zeile; do
      echo "    - $zeile"
      gefunden=$((gefunden + 1))
    done <<< "$treffer"
    echo
  fi
done

if [ "$gefunden" -eq 0 ]; then
  echo "Keine. Die Texte sind ausgefüllt — die anwaltliche Prüfung ersetzt das nicht."
else
  echo "$gefunden Platzhalter offen. Siehe docs/rechtliches/checkliste.md."
fi
