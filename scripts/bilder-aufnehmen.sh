#!/usr/bin/env bash
#
# Baut die App mit den Vorschau-Daten, startet sie und nimmt die Bilder für die
# Startseite auf. Siehe scripts/bilder/aufnehmen.mjs.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${BAUSTIFT_BILDER_PORT:-3197}"
SICHERUNG="$(mktemp -d)"
SERVER_PID=""

zurueck() {
  if [ -n "$SERVER_PID" ]; then
    kill -- -"$SERVER_PID" 2>/dev/null || kill "$SERVER_PID" 2>/dev/null || true
  fi
  pkill -f "next start -p $PORT" 2>/dev/null || true
  for datei in src/lib/supabase/server.ts src/middleware.ts next.config.mjs; do
    name="$(echo "$datei" | tr '/' '_')"
    [ -f "$SICHERUNG/$name" ] && cp "$SICHERUNG/$name" "$datei"
  done
  rm -rf "$SICHERUNG"
}
trap zurueck EXIT

if curl -s -o /dev/null --max-time 2 --noproxy localhost "http://localhost:$PORT/"; then
  echo "✗ Auf Port $PORT antwortet schon etwas — erst beenden."
  exit 1
fi

for datei in src/lib/supabase/server.ts src/middleware.ts next.config.mjs; do
  cp "$datei" "$SICHERUNG/$(echo "$datei" | tr '/' '_')"
done
cp scripts/vorschau/server.ts src/lib/supabase/server.ts
cp scripts/vorschau/middleware.ts src/middleware.ts
node -e '
  const fs = require("fs");
  const p = "next.config.mjs";
  fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(
    "  reactStrictMode: true,",
    "  reactStrictMode: true,\n  typescript: { ignoreBuildErrors: true },\n  eslint: { ignoreDuringBuilds: true },",
  ));
'

echo "→ Bauen"
export NEXT_PUBLIC_SITE_URL="http://localhost:$PORT"
export NEXT_PUBLIC_SUPABASE_URL="https://beispiel.supabase.co"
export NEXT_PUBLIC_SUPABASE_ANON_KEY="mobil"
export SUPABASE_SERVICE_ROLE_KEY="mobil"
export ANTHROPIC_API_KEY="sk-ant-mobil"
export OPENAI_API_KEY="sk-mobil"
export RESEND_API_KEY="re_mobil"
export RESEND_ABSENDER="Mobil <test@example.de>"
npm run build > "$SICHERUNG/build.log" 2>&1 || { tail -25 "$SICHERUNG/build.log"; exit 1; }

echo "→ Starten auf Port $PORT"
setsid npx next start -p "$PORT" > "$SICHERUNG/server.log" 2>&1 &
SERVER_PID=$!
for _ in $(seq 1 30); do
  curl -s -o /dev/null --noproxy localhost "http://localhost:$PORT/angebote" && break
  sleep 1
done

echo "→ Aufnehmen"
BASIS="http://localhost:$PORT" node scripts/bilder/aufnehmen.mjs
