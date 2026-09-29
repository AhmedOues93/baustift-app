#!/usr/bin/env bash
#
# Prueft die erzeugte E-Rechnung gegen die offiziellen Regeln — nicht gegen
# unsere eigene Meinung davon.
#
#   1. CII-Schema D16B (Reihenfolge und Datentypen der Elemente)
#   2. EN-16931-Schematron der EU-Kommission (die Geschaeftsregeln BR-*)
#   3. XRechnung-Schematron (nur Hinweis: die deutschen Zusatzregeln BR-DE-*,
#      verbindlich erst, wenn wir als Profil XRechnung ausweisen)
#
# Braucht Java und Internet. Die Werkzeuge werden einmal nach .pruefung/
# geladen und danach wiederverwendet.
set -euo pipefail
cd "$(dirname "$0")/.."

W=".pruefung"
SAXON="$W/saxon/saxon-he-12.4.jar"
mkdir -p "$W"

if [ ! -f "$SAXON" ]; then
  echo "· Saxon laden"
  curl -sL --max-time 300 -o "$W/saxon.zip" \
    "https://raw.githubusercontent.com/Saxonica/Saxon-HE/main/12/Java/SaxonHE12-4J.zip"
  unzip -oq "$W/saxon.zip" -d "$W/saxon"
fi
[ -d "$W/schematron" ] || { echo "· Schematron-Skelett laden"; git clone -q --depth 1 https://github.com/Schematron/schematron.git "$W/schematron"; }
[ -d "$W/en16931" ]    || { echo "· EN-16931-Regeln laden";   git clone -q --depth 1 https://github.com/ConnectingEurope/eInvoicing-EN16931.git "$W/en16931"; }
[ -d "$W/xrechnung" ]  || { echo "· XRechnung-Regeln laden";  git clone -q --depth 1 https://github.com/itplr-kosit/xrechnung-schematron.git "$W/xrechnung"; }

SK="$W/schematron/trunk/schematron/code"
uebersetzen() { # .sch -> ausfuehrbares .xsl
  local sch="$1" ziel="$2"
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$sch"       -xsl:"$SK/iso_dsdl_include.xsl"   -o:"$W/a.sch" >/dev/null 2>&1
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$W/a.sch"   -xsl:"$SK/iso_abstract_expand.xsl" -o:"$W/b.sch" >/dev/null 2>&1
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$W/b.sch"   -xsl:"$SK/iso_svrl_for_xslt2.xsl"  -o:"$ziel"    >/dev/null 2>&1
}
[ -f "$W/en16931.xsl" ]   || { echo "· EN-16931-Regeln uebersetzen"; uebersetzen "$W/en16931/cii/schematron/EN16931-CII-validation.sch" "$W/en16931.xsl"; }
[ -f "$W/xrechnung.xsl" ] || { echo "· XRechnung-Regeln uebersetzen"; uebersetzen "$W/xrechnung/src/validation/schematron/cii/XRechnung-CII-validation.sch" "$W/xrechnung.xsl"; }

echo "· Beispielrechnungen erzeugen"
rm -rf "$W/xml"
DUMP_ZIEL="$PWD/$W/xml" npx vitest run src/lib/erechnung/beispiele.test.ts >/dev/null

XSD="$W/en16931/cii/schema/D16B SCRDM (Subset)/uncoupled clm/CII/uncefact/data/standard/CrossIndustryInvoice_100pD16B.xsd"
fehler=0
for f in "$W"/xml/*.xml; do
  name=$(basename "$f" .xml)
  echo
  echo "── $name"
  if xmllint --noout --schema "$XSD" "$f" 2>"$W/xsd.log"; then
    echo "   Schema: in Ordnung"
  else
    echo "   Schema: ABGELEHNT"; sed -n 1,3p "$W/xsd.log" | sed 's/^/     /'; fehler=1
  fi
  for regelwerk in en16931 xrechnung; do
    java -cp "$SAXON" net.sf.saxon.Transform -s:"$f" -xsl:"$W/$regelwerk.xsl" -o:"$W/svrl.xml" >/dev/null 2>&1
    if ! python3 - "$W/svrl.xml" "$regelwerk" <<'PY'
import sys, xml.etree.ElementTree as ET
baum = ET.parse(sys.argv[1]).getroot()
funde = []
for e in baum.iter():
    if e.tag.endswith("failed-assert") or e.tag.endswith("successful-report"):
        art = (e.get("flag") or e.get("role") or "fatal").lower()
        text = " ".join("".join(e.itertext()).split())[:140]
        funde.append((art, e.get("id") or "", text))
harte = [f for f in funde if f[0] not in ("warning", "info")]
marke = "   EN 16931:" if sys.argv[2] == "en16931" else "   XRechnung:"
if not funde:
    print(f"{marke} in Ordnung")
else:
    print(f"{marke} {len(harte)} Fehler, {len(funde)-len(harte)} Hinweis(e)")
    for art, kennung, text in funde:
        print(f"     [{art}] {kennung} {text}")
sys.exit(1 if (harte and sys.argv[2] == "en16931") else 0)
PY
    then fehler=1
    fi
  done
done

echo
if [ "$fehler" = 0 ]; then
  echo "Alle Beispielrechnungen bestehen Schema und EN 16931."
else
  echo "Es gibt Fehler — siehe oben."
fi
exit $fehler
