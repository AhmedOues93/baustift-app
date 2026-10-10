#!/usr/bin/env bash
#
# =============================================================================
# E-Rechnung gegen die offiziellen Regeln prüfen
# =============================================================================
# Eigene Tests prüfen nur, was wir selbst für richtig halten. Ob die Datei der
# Norm entspricht, entscheiden drei fremde Regelwerke:
#
#   1. CII-Schema D16B — Reihenfolge und Datentypen der Elemente.
#   2. EN-16931-Schematron der EU-Kommission — die Geschäftsregeln BR-*.
#   3. XRechnung-Schematron der KoSIT — die deutschen Zusatzregeln BR-DE-*.
#      Nur als Hinweis: verbindlich erst, wenn wir als Profil XRechnung
#      ausweisen. Heute weisen wir EN 16931 aus.
#
# ALLE FREMDEN BESTANDTEILE SIND AUF FESTE STÄNDE GENAGELT.
# Vorher wurde jeweils der Hauptzweig geladen. Das lief so lange gut, bis sich
# dort etwas änderte — dann erzeugte der Lauf plötzlich ein ungültiges
# Schematron, und zwar nur in einer frischen Umgebung, während lokal der alte
# Stand im Zwischenspeicher lag. Ein Prüfwerkzeug, dessen Ergebnis vom Tag
# abhängt, prüft nichts.
#
# Die Stände stehen unten als Konstanten und sind in
# docs/betrieb/veroeffentlichen.md erklärt. Heraufsetzen ist eine bewusste
# Entscheidung mit eigenem Commit, kein Nebeneffekt.
#
# Die Artefakte landen unter .pruefung/ und NICHT im Git: es sind zusammen
# über 100 MB fremder Code, der sich jederzeit identisch neu laden lässt.
#
# Braucht Java, unzip und Internet.
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# --- Feste Stände der fremden Regelwerke -------------------------------------
# Veröffentlichung der EU-Kommission; die Nummer steht im Repository als Tag.
EN16931_STAND="validation-1.3.16"
# KoSIT, Veröffentlichung der XRechnung-Regeln.
XRECHNUNG_STAND="v2.6.0"
# ISO-Schematron-Skelett, letzte getaggte Fassung.
SKELETT_STAND="2020-10-01"
# Saxon XSLT-Prozessor. Das Repository hat keine Tags, deshalb der Commit.
SAXON_COMMIT="355db68f8012ec7440bc87d3379de970610b9ab3"
SAXON_DATEI="12/Java/SaxonHE12-4J.zip"
SAXON_JAR="saxon-he-12.4.jar"

W=".pruefung"
SAXON="$W/saxon/$SAXON_JAR"
mkdir -p "$W"

# Ein Stand-Vermerk je Bestandteil: ändert sich die Konstante oben, wird neu
# geladen statt stillschweigend der alte Stand weiterbenutzt.
geladen() { # name stand -> wahr, wenn in genau diesem Stand vorhanden
  [ -f "$W/$1.stand" ] && [ "$(cat "$W/$1.stand")" = "$2" ]
}
vermerke() { echo "$2" > "$W/$1.stand"; }

hole_git() { # name repo stand
  local name="$1" repo="$2" stand="$3"
  if geladen "$name" "$stand"; then return; fi
  echo "· $name laden ($stand)"
  rm -rf "${W:?}/$name"
  git clone -q --depth 1 --branch "$stand" "https://github.com/$repo.git" "$W/$name"
  vermerke "$name" "$stand"
  # Die übersetzten Regeln passen nicht mehr zum neuen Stand.
  rm -f "$W/en16931.xsl" "$W/xrechnung.xsl"
}

if ! geladen saxon "$SAXON_COMMIT"; then
  echo "· Saxon laden ($SAXON_COMMIT)"
  rm -rf "${W:?}/saxon" "$W/saxon.zip"
  curl -fsSL --max-time 300 -o "$W/saxon.zip" \
    "https://raw.githubusercontent.com/Saxonica/Saxon-HE/$SAXON_COMMIT/$SAXON_DATEI"
  unzip -oq "$W/saxon.zip" -d "$W/saxon"
  rm -f "$W/saxon.zip"
  [ -f "$SAXON" ] || { echo "✗ $SAXON_JAR nicht im Archiv — Pfad geändert?"; exit 1; }
  vermerke saxon "$SAXON_COMMIT"
fi

hole_git schematron "Schematron/schematron"                     "$SKELETT_STAND"
hole_git en16931    "ConnectingEurope/eInvoicing-EN16931"       "$EN16931_STAND"
hole_git xrechnung  "itplr-kosit/xrechnung-schematron"          "$XRECHNUNG_STAND"

SK="$W/schematron/trunk/schematron/code"
XSD="$W/en16931/cii/schema/D16B SCRDM (Subset)/uncoupled clm/CII/uncefact/data/standard/CrossIndustryInvoice_100pD16B.xsd"

# Die Pfade in fremden Repositories können sich zwischen Ständen verschieben.
# Dann lieber hier abbrechen als später ein leeres Prüfergebnis melden.
for pfad in "$SK/iso_dsdl_include.xsl" "$SK/iso_abstract_expand.xsl" \
            "$SK/iso_svrl_for_xslt2.xsl" "$XSD" \
            "$W/en16931/cii/schematron/EN16931-CII-validation.sch" \
            "$W/xrechnung/src/validation/schematron/cii/XRechnung-CII-validation.sch"; do
  [ -f "$pfad" ] || { echo "✗ Erwartete Datei fehlt: $pfad"; echo "  Stand geändert? Siehe Konstanten oben."; exit 1; }
done

uebersetzen() { # .sch -> ausfuehrbares .xsl
  local sch="$1" ziel="$2"
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$sch"     -xsl:"$SK/iso_dsdl_include.xsl"    -o:"$W/a.sch" >/dev/null 2>&1
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$W/a.sch" -xsl:"$SK/iso_abstract_expand.xsl" -o:"$W/b.sch" >/dev/null 2>&1
  java -cp "$SAXON" net.sf.saxon.Transform -s:"$W/b.sch" -xsl:"$SK/iso_svrl_for_xslt2.xsl"  -o:"$ziel"    >/dev/null 2>&1
}

# Die übersetzten Regeln werden bei JEDEM Lauf geprüft, nicht nur beim
# Übersetzen. Sonst reicht eine einmal kaputt entstandene oder abgeschnittene
# Datei im Zwischenspeicher, und ab da besteht jede Rechnung — der Lauf meldet
# grün, weil er nichts mehr prüft. Nachgestellt, indem die Datei geleert
# wurde: vorher lief er durch.
pruefe_xsl() { # datei name
  if [ ! -s "$1" ] || ! grep -q "xsl:stylesheet\|xsl:transform" "$1"; then
    echo "✗ Die übersetzten $2-Regeln sind kein gültiges XSLT ($1)."
    echo "  Mit 'rm -rf .pruefung' neu aufbauen. Bleibt es dabei, passt das"
    echo "  Skelett ($SKELETT_STAND) nicht zu den Regeln."
    exit 1
  fi
}

[ -f "$W/en16931.xsl" ]   || { echo "· EN-16931-Regeln übersetzen"; uebersetzen "$W/en16931/cii/schematron/EN16931-CII-validation.sch" "$W/en16931.xsl"; }
[ -f "$W/xrechnung.xsl" ] || { echo "· XRechnung-Regeln übersetzen"; uebersetzen "$W/xrechnung/src/validation/schematron/cii/XRechnung-CII-validation.sch" "$W/xrechnung.xsl"; }
pruefe_xsl "$W/en16931.xsl"   "EN-16931"
pruefe_xsl "$W/xrechnung.xsl" "XRechnung"

echo "· Beispielrechnungen erzeugen"
rm -rf "$W/xml"
DUMP_ZIEL="$PWD/$W/xml" npx vitest run src/lib/erechnung/beispiele.test.ts >/dev/null
anzahl=$(find "$W/xml" -name "*.xml" | wc -l)
# Ohne Beispiele hätte der Lauf nichts zu prüfen und wäre trotzdem grün.
[ "$anzahl" -gt 0 ] || { echo "✗ Keine Beispielrechnung erzeugt."; exit 1; }

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
    # Das Ergebnis des vorigen Durchgangs zuerst wegräumen: bricht Saxon ab,
    # läge sonst noch der alte Befund da und die Rechnung bestünde mit einem
    # fremden Prüfergebnis.
    rm -f "$W/svrl.xml"
    java -cp "$SAXON" net.sf.saxon.Transform -s:"$f" -xsl:"$W/$regelwerk.xsl" -o:"$W/svrl.xml" >/dev/null 2>&1
    if [ ! -s "$W/svrl.xml" ]; then
      echo "   ${regelwerk}: PRÜFUNG ABGEBROCHEN — kein Ergebnis erzeugt."
      fehler=1
      continue
    fi
    if ! python3 - "$W/svrl.xml" "$regelwerk" <<'PY'
import sys, xml.etree.ElementTree as ET
baum = ET.parse(sys.argv[1]).getroot()
# Ein SVRL ohne eine einzige ausgewertete Regel heisst: der Prüfer lief ins
# Leere. Das sähe wie ein Bestehen aus und ist keines.
regeln = sum(1 for e in baum.iter() if e.tag.endswith(("fired-rule", "active-pattern")))
funde = []
for e in baum.iter():
    if e.tag.endswith("failed-assert") or e.tag.endswith("successful-report"):
        art = (e.get("flag") or e.get("role") or "fatal").lower()
        text = " ".join("".join(e.itertext()).split())[:140]
        funde.append((art, e.get("id") or "", text))
harte = [f for f in funde if f[0] not in ("warning", "info")]
marke = "   EN 16931:" if sys.argv[2] == "en16931" else "   XRechnung:"
if regeln == 0:
    print(f"{marke} KEINE REGEL AUSGEWERTET — der Prüfer lief ins Leere.")
    sys.exit(1)
if not funde:
    print(f"{marke} in Ordnung ({regeln} Regeln)")
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
  echo "✓ Alle $anzahl Beispielrechnungen bestehen Schema und EN 16931."
  echo "  Stände: EN 16931 $EN16931_STAND · XRechnung $XRECHNUNG_STAND · Skelett $SKELETT_STAND"
else
  echo "✗ Es gibt Fehler — siehe oben."
fi
exit $fehler
