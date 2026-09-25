#!/usr/bin/env bash
#
# =============================================================================
# Rauchtest: gehen die Routen im gebauten Next überhaupt?
# =============================================================================
# Es gibt diesen Test wegen eines Fehlers, der wochenlang unbemerkt blieb.
# Die PDF-Erzeugung war kaputt — jedes Angebot, jede Rechnung, ein 500 —,
# während alle 218 Tests grün waren. Der Grund: Vitest löst alle Module gegen
# dasselbe node_modules auf. Das Bauteil lief dort einwandfrei. Im gebauten
# Next traf es auf eine andere React-Fassung und brach ab.
#
# Ein Test kann eben nur prüfen, was er wirklich durchläuft. Also läuft hier
# die gebaute Anwendung, und die Routen werden aufgerufen wie von einem
# Browser: Statuscode, Inhaltstyp, Grösse. Beim PDF zusätzlich der Text —
# ein PDF mit 800 Byte und ohne Inhalt sieht von aussen gesund aus.
#
# Supabase wird dafür durch scripts/vorschau/server.ts ersetzt. Die Datei
# wird vor dem Bauen hineingeschoben und hinterher wieder entfernt; ein trap
# sorgt dafür, dass das auch bei Abbruch passiert.
#
# Aufruf:  ./scripts/rauchtest.sh
# =============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${BAUSTIFT_RAUCHTEST_PORT:-3199}"
SICHERUNG="$(mktemp -d)"
SERVER_PID=""

zurueck() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  for datei in src/lib/supabase/server.ts src/middleware.ts next.config.mjs; do
    name="$(echo "$datei" | tr '/' '_')"
    [ -f "$SICHERUNG/$name" ] && cp "$SICHERUNG/$name" "$datei"
  done
  rm -rf "$SICHERUNG"
}
trap zurueck EXIT

echo "→ Echte Dateien sichern"
for datei in src/lib/supabase/server.ts src/middleware.ts next.config.mjs; do
  cp "$datei" "$SICHERUNG/$(echo "$datei" | tr '/' '_')"
done

echo "→ Vorschau-Daten einsetzen"
cp scripts/vorschau/server.ts src/lib/supabase/server.ts
cp scripts/vorschau/middleware.ts src/middleware.ts
# Typprüfung und Lint laufen in ihren eigenen Schritten; hier geht es allein
# darum, ob die gebauten Routen antworten.
node -e '
  const fs = require("fs");
  const p = "next.config.mjs";
  const s = fs.readFileSync(p, "utf8").replace(
    "  reactStrictMode: true,",
    "  reactStrictMode: true,\n  typescript: { ignoreBuildErrors: true },\n  eslint: { ignoreDuringBuilds: true },",
  );
  fs.writeFileSync(p, s);
'

echo "→ Bauen"
export NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"
export NEXT_PUBLIC_SUPABASE_URL="https://beispiel.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="rauchtest"
export SUPABASE_SERVICE_ROLE_KEY="rauchtest"
export ANTHROPIC_API_KEY="sk-ant-rauchtest"
export OPENAI_API_KEY="sk-rauchtest"
export RESEND_API_KEY="re_rauchtest"
export RESEND_ABSENDER="Rauchtest <test@example.de>"
npm run build > "$SICHERUNG/build.log" 2>&1 || { tail -30 "$SICHERUNG/build.log"; exit 1; }

echo "→ Starten auf Port $PORT"
npx next start -p "$PORT" > "$SICHERUNG/server.log" 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -s -o /dev/null --noproxy localhost "http://localhost:$PORT/angebote"; then break; fi
  sleep 1
done

fehler=0

pruefe() {
  local pfad="$1" erwartet="$2" typ="$3"
  local antwort
  antwort=$(curl -s -o "$SICHERUNG/antwort.bin" -w "%{http_code} %{content_type} %{size_download}" \
    --noproxy localhost "http://localhost:$PORT$pfad")
  local code="${antwort%% *}"
  local rest="${antwort#* }"

  if [ "$code" != "$erwartet" ]; then
    echo "  ✗ $pfad -> $code (erwartet $erwartet)"
    grep -a "Error" "$SICHERUNG/server.log" | tail -3 | sed 's/^/      /'
    fehler=$((fehler + 1))
    return
  fi
  if [ -n "$typ" ] && [[ "$rest" != *"$typ"* ]]; then
    echo "  ✗ $pfad -> $rest (erwartet Typ $typ)"
    fehler=$((fehler + 1))
    return
  fi
  echo "  ✓ $pfad -> $rest"
}

echo "→ Seiten"
for pfad in / /login /angebote /angebote/a1 /angebote/neu /rechnungen /rechnungen/r3 \
            /kunden /kunden/k1 /preisliste /aufmass /aufmass/auf1 /einstellungen /abo \
            /rechtliches/impressum /rechtliches/datenschutz; do
  pruefe "$pfad" 200 "text/html"
done

echo "→ Routen"
pruefe /api/angebote/a1/pdf 200 "application/pdf"
pruefe /api/rechnungen/r3/pdf 200 "application/pdf"
pruefe /api/rechnungen/r3/erechnung 200 "xml"
pruefe /api/export/kunden 200 "csv"
pruefe /api/export/preisliste 200 "csv"
pruefe /api/export/angebote 200 "csv"
pruefe /api/export/rechnungen 200 "csv"
pruefe /api/konto/export 200 "json"
# Unbekannter Export darf nicht 500 werfen.
pruefe /api/export/unsinn 404 ""

echo "→ Inhalt der PDFs"
for ziel in "angebote/a1:AN-2026-0041" "rechnungen/r3:RE-2026-0016"; do
  pfad="${ziel%%:*}"
  nummer="${ziel##*:}"
  curl -s -o "$SICHERUNG/pruef.pdf" --noproxy localhost "http://localhost:$PORT/api/$pfad/pdf"
  if node -e "
    const { PDFParse } = require('pdf-parse');
    (async () => {
      const p = new PDFParse({ data: require('fs').readFileSync('$SICHERUNG/pruef.pdf') });
      const r = await p.getText();
      await p.destroy();
      if (!r.text.includes('$nummer')) { console.error('Nummer $nummer fehlt im PDF'); process.exit(1); }
      if (!r.text.includes('Schulz Sanitär GmbH')) { console.error('Firmenkopf fehlt'); process.exit(1); }
    })();
  " 2>"$SICHERUNG/pdf.err"; then
    echo "  ✓ $pfad enthält $nummer und den Firmenkopf"
  else
    echo "  ✗ $pfad: $(cat "$SICHERUNG/pdf.err")"
    fehler=$((fehler + 1))
  fi
done

echo
if [ "$fehler" -eq 0 ]; then
  echo "✓ Alle Routen antworten wie erwartet"
else
  echo "✗ $fehler Prüfung(en) fehlgeschlagen"
  exit 1
fi
