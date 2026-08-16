#!/usr/bin/env bash
# Nimmt die App-Store-Bildschirmfotos im Apple-TV-Simulator auf — aus der
# wirklich gebauten tvOS-App, nicht aus dem Android-Emulator.
#
# Gesteuert wird ueber ein Startargument (`-salatiScreen <name>`, s. lib/nav.ts):
# der Simulator kennt keine Fernbedienung, die sich von aussen druecken liesse.
#
# NICHT ueber Deep Links, obwohl die App sie versteht: Apple TV legt vor eine
# von aussen geoeffnete Adresse eine Rueckfrage („Open in ‚Salati TV'?"), und die
# bleibt ohne Tastendruck stehen. Am 2026-08-11 zeigten deshalb alle acht Bilder
# dieselbe Uhr mit offenem Fenster (Lauf 31491392843). Je Bildschirm ein
# frischer Start kostet ein paar Sekunden und ist dafuer eindeutig.
#
# Aufruf (auf einem macOS-Runner, nach `expo prebuild` + `pod install`):
#   bash scripts/tvos-screenshots.sh <Pfad-zur-gebauten-.app> [sprache …]
#
# Ergebnis: screenshots/appletv/<sprache>/NN-<screen>.png in 1920x1080.
set -euo pipefail

APP_PFAD="${1:?Pfad zur gebauten .app fehlt}"
shift || true
# Bash 3.2 (macOS-Vorgabe) bricht bei `"$@"` ohne Argumente unter `set -u` ab —
# deshalb der Umweg ueber eine Zeichenkette.
SPRACHEN="${*:-de en}"

# Apple erwartet ein volles Gebietsschema (`de_DE`), nicht nur den Sprachcode.
gebietsschema() {
  case "$1" in
    de) echo de_DE ;;
    en) echo en_US ;;
    tr) echo tr_TR ;;
    ar) echo ar_SA ;;
    fr) echo fr_FR ;;
    es) echo es_ES ;;
    *) echo "$1" ;;
  esac
}

BUNDLE_ID=de.salatibox.tv
ZIEL="$(cd "$(dirname "$0")/.." && pwd)/screenshots/appletv"

# Reihenfolge = Reihenfolge auf der Store-Seite. Zahl = Wartezeit in Sekunden
# nach dem Start, bevor abgedrueckt wird. Sie deckt zweierlei ab: den Kaltstart
# (jedes Bild bekommt einen frischen Start) und das Nachladen der Listen ueber
# das Netz — ein Foto vom Ladezustand nuetzt niemandem.
#
# Drittes Feld (optional) = zusaetzliches Startargument. Zwei Bilder brauchen
# das (Befund 2026-08-16 beim Nachsehen der Store-Seite):
#
#   * "quran" zeigte die SURENLISTE, waehrend die Unterschrift "Den Koran am
#     Fernseher lesen" verspricht. Eine Liste von Namen zeigt davon nichts.
#   * "settings" zeigte die SPRACHWAHL, waehrend die Unterschrift von
#     23 Berechnungsmethoden und Madhab sprach. Bild und Text sagten
#     Verschiedenes.
#
# Am Fernseher fuehrt die Fernbedienung weiter; im Simulator gibt es keine,
# also kommt das Ziel beim Start mit (s. lib/nav.ts).
AUFNAHMEN=(
  "clock:15"
  "home:14"
  "quran:22:-salatiSure 4"
  "reciters:20"
  "radio:20"
  "videos:20"
  "quiz:16"
  "settings:14:-salatiBereich prayer"
)

# --- Simulator besorgen ------------------------------------------------------
# Die 1080p-Variante liefert Fotos in exakt 1920x1080 — genau das Format, das
# Apple fuer Apple-TV-Bilder erwartet. Die 4K-Variante muesste erst skaliert
# werden.
GERAETETYP=$(xcrun simctl list devicetypes \
  | grep -oE 'com\.apple\.CoreSimulator\.SimDeviceType\.Apple-TV[A-Za-z0-9.-]*1080p' | head -1)
[ -z "$GERAETETYP" ] && GERAETETYP=$(xcrun simctl list devicetypes \
  | grep -oE 'com\.apple\.CoreSimulator\.SimDeviceType\.Apple-TV[A-Za-z0-9.-]*' | head -1)
LAUFZEIT=$(xcrun simctl list runtimes \
  | grep -oE 'com\.apple\.CoreSimulator\.SimRuntime\.tvOS-[0-9-]+' | tail -1)
echo "Geraetetyp: $GERAETETYP"
echo "Laufzeit:   $LAUFZEIT"
[ -n "$GERAETETYP" ] && [ -n "$LAUFZEIT" ] || { echo "Kein Apple-TV-Simulator verfuegbar."; exit 1; }

xcrun simctl delete "SalatiTV-Fotos" >/dev/null 2>&1 || true
UDID=$(xcrun simctl create "SalatiTV-Fotos" "$GERAETETYP" "$LAUFZEIT")
xcrun simctl boot "$UDID"
xcrun simctl bootstatus "$UDID" -b

xcrun simctl install "$UDID" "$APP_PFAD"
echo "Installiert: $APP_PFAD"

# --- Aufnehmen ---------------------------------------------------------------
for SPRACHE in $SPRACHEN; do
  ORDNER="$ZIEL/$SPRACHE"
  mkdir -p "$ORDNER"

  # Sprache am GERAET setzen, und zwar im ausgeschalteten Zustand direkt in der
  # Voreinstellungsdatei. `simctl spawn … defaults write` bleibt wirkungslos:
  # der Voreinstellungsdienst des laufenden Simulators haelt seinen eigenen
  # Stand und ueberschreibt die Datei wieder — die Oberflaeche blieb in den
  # Laeufen 31491392843 und 31493692564 englisch.
  GEBIET="$(gebietsschema "$SPRACHE")"
  PLIST="$HOME/Library/Developer/CoreSimulator/Devices/$UDID/data/Library/Preferences/.GlobalPreferences.plist"
  xcrun simctl shutdown "$UDID" >/dev/null 2>&1 || true
  mkdir -p "$(dirname "$PLIST")"
  # PlistBuddy legt die Datei beim Speichern an, wenn es sie nicht gibt.
  [ -f "$PLIST" ] || /usr/libexec/PlistBuddy -c "Save" "$PLIST"
  plutil -replace AppleLanguages -json "[\"$SPRACHE\"]" "$PLIST"
  plutil -replace AppleLocale -string "$GEBIET" "$PLIST"
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b
  echo "Sprache am Geraet: $(plutil -extract AppleLanguages json -o - "$PLIST") / $GEBIET"

  NR=0
  for EINTRAG in "${AUFNAHMEN[@]}"; do
    SCREEN="${EINTRAG%%:*}"
    REST="${EINTRAG#*:}"
    WARTEN="${REST%%:*}"
    # Drittes Feld ist optional; ohne es bleibt EXTRA leer.
    if [ "$REST" != "$WARTEN" ]; then EXTRA="${REST#*:}"; else EXTRA=""; fi
    NR=$((NR + 1))
    xcrun simctl terminate "$UDID" "$BUNDLE_ID" >/dev/null 2>&1 || true
    # shellcheck disable=SC2086  # EXTRA soll in zwei Argumente zerfallen
    xcrun simctl launch "$UDID" "$BUNDLE_ID" \
      -salatiScreen "$SCREEN" $EXTRA \
      -AppleLanguages "($SPRACHE)" -AppleLocale "$GEBIET" >/dev/null
    sleep "$WARTEN"
    DATEI=$(printf '%s/%02d-%s.png' "$ORDNER" "$NR" "$SCREEN")
    xcrun simctl io "$UDID" screenshot --type=png "$DATEI"
    echo "$SPRACHE $(printf '%02d' $NR) $SCREEN -> $(sips -g pixelWidth -g pixelHeight "$DATEI" | awk '/pixel/ {printf "%s ", $2}')"
  done
done

xcrun simctl shutdown "$UDID" || true
echo "Fertig. Bilder unter $ZIEL"
