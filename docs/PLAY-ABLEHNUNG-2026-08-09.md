# Play-Ablehnung versionCode 12 (2026-08-09)

Google Play hat das Update auf 1.8.0 / vc12 zurueckgewiesen. Grundlage: Android
TV App Quality Guidelines, Routing-ID ZLFS. Der alte Stand blieb im Store, die
Aenderung wurde nicht veroeffentlicht.

Wortlaut der beiden Befunde:

> Your icon does not fill the entire icon space.
> TV-BN: The app launch banner contains the name of the app.

Und der Rahmen dazu:

> We are targeting 1080P, which we consider xhdpi. Apps should include the
> banner in the xhdpi (320 dpi) drawables folder with a size of (320px × 180px)
> and the icon with a size of (512px x512px).

## Was gemessen wurde

| Punkt | Befund | Wie gemessen |
|---|---|---|
| Icon | Der Stern belegte **730 von 1024 px = 71 %** der Kante. Der Rest war schwarze Flaeche. | Goldmaske ueber `assets/icon.png`, Bounding-Box |
| Banner-Groesse | 320×180 lag korrekt in `drawable-xhdpi` | `PIL.Image.open` ueber alle `drawable*/tv_banner.png` |
| Banner-Name | „SALATI TV" stand drauf | Augenschein |
| Banner-Kontrast | Grund war `#0b0b0d`, praktisch schwarz. In der dunklen Leanback-Reihe ist eine schwarze Kachel von „kein Banner" nicht zu unterscheiden. | Augenschein |
| Banner-Dichte | In **allen sechs** drawable-Ordnern lag dieselbe 320×180-Datei | s.o. |
| Adaptive Ikone | Vordergrund war `icon.png` mit eingebranntem Grund; der Stern mass 77 dp im 108-dp-Vordergrund, die Maske zeigt aber nur 72 dp — die Zacken wurden angeschnitten | Nachgestellt: Vordergrund auf `#0b0b0d`, mittlere 72/108 ausgeschnitten, Kreismaske |

Der Dichte-Punkt ist der, der ohne Nachrechnen durchgeht. Android liest eine
Bitmap in der Dichte ihres Ordners: dieselben 320×180 px sind in
`drawable-xhdpi` 320×180 dp, in `drawable-xxxhdpi` aber 80×45 dp. Auf einem
4K-Fernseher rechnet der Launcher die Kachel damit vierfach hoch. Verursacher
ist `@react-native-tvos/config-tv`, das die eine Datei aus `androidTVBanner`
unveraendert in alle sechs Ordner kopiert
(`build/withTVAndroidBannerImage.js`).

## Was geaendert wurde (1.8.1 / vc13)

- **`scripts/marken-assets.py`** (neu). Erzeugt Ikone, adaptive Ikone, Banner in
  fuenf Dichten, Store-Banner und Feature-Grafik aus einer Quelle. Der
  Achtzackstern wird gerechnet (Vereinigung zweier abgerundeter Quadrate, eines
  um 45 Grad gedreht, vierfach ueberabgetastet), nicht aus einer Bitmap montiert.
  Die Proportionen stammen aus dem alten Icon: Quadratseite 536 px bei
  Stern-Ausdehnung 730 px, Eckenradius 0,0672 der Seite.
  Nebenbei verschwindet damit der sichtbar andersfarbige Kasten hinter dem
  Stern in Feature-Grafik und Store-Banner: der entstand, weil `icon.png` mit
  Grund `#0b0b0d` auf einen Grund `#0a0a0a` montiert war.
- **Ikone fuellt die Flaeche**: Stern-Ausdehnung 96 % der Kante.
- **`assets/icon-adaptive.png`** (neu) als Vordergrund der adaptiven Ikone: nur
  der Stern, transparent, 60 % der Kante. Damit steht er nach der 72-dp-Maske
  auf rund 90 % der sichtbaren Flaeche, ohne angeschnitten zu werden.
  `icon.png` darf dafuer NICHT mehr verwendet werden.
- **`plugins/with-tv-banner.js`** (neu). Legt je Dichte die passende Aufloesung
  ab (160×90 / 240×135 / 320×180 / 480×270 / 640×360). Muss in `app.config.js`
  VOR `@react-native-tvos/config-tv` stehen: gefaehrliche Mods laufen in
  umgekehrter Anmeldereihenfolge. Andersherum kopierte config-tv seine sechs
  gleich grossen Banner wieder darueber (am 2026-08-09 gemessen: nach dem
  Prebuild lagen erneut sechsmal 320×180 im Baum).
- **Banner-Motiv**: warmer Goldschimmer links, Stern, Wortmarke „SALATI TV".
  Hebt sich von der dunklen App-Reihe ab.
- **`scripts/play-grafiken.mjs`** (neu). Tauscht Symbol, Feature-Grafik und
  TV-Banner im Eintrag, in allen vier Sprachen. Vorher lagen Grafiken nur unter
  `en-US` (`--pruefen` am 2026-08-09: de-DE/tr-TR/ar hatten keine eigenen).

## Belege

- Ikone im ausgelieferten Artefakt: `mipmap-xxxhdpi/ic_launcher.webp` aus dem
  AAB, Stern **184 von 192 px = 96 %** (vorher 71 %).
- Banner im AAB: `drawable-mdpi-v4` 160×90, `-hdpi-v4` 240×135, `-xhdpi-v4`
  320×180, `-xxhdpi-v4` 480×270, `-xxxhdpi-v4` 640×360.
- Launcher: `screenshots/marke-01-launcher-banner.png` — das Banner steht in
  der Reihe „Installed Apps" der Google-TV-Oberflaeche und hebt sich von den
  Nachbarn ab. `screenshots/marke-02-icon-appliste.png` — die Ikone in der
  Systemliste, der Stern fuellt das Feld.
  Aufgenommen auf dem Android-TV-Emulator (AVD `salati_tv`, 1920×1080, Dichte
  320 = xhdpi, Android 16), APK aus demselben Gradle-Lauf wie das AAB,
  `versionCode=13 versionName=1.8.1` aus `dumpsys package de.salatibox.tv`.
- Store: `node scripts/play-grafiken.mjs --pruefen` meldet fuer alle vier
  Sprachen dieselben SHA-Praefixe wie die Dateien in `assets/`
  (icon `61174d92`, featureGraphic `e38e046b`, tvBanner `e648bf71`).
- Tracks: `node scripts/play-status.mjs` meldet internal und production auf
  vc 13 / 1.8.1. vc12 ist in keinem Track mehr enthalten.

## Was nur in der Console ging

Die Einreichung selbst. Solange die Ablehnung offen ist, weist die Play-API
einen Commit ab, der die Aenderung gleich zur Pruefung schicken will:

> Changes cannot be sent for review automatically. Please set the query
> parameter changesNotSentForReview to true.

`play-grafiken.mjs` und `play-aab-upload.mjs` wiederholen den Commit deshalb mit
`changesNotSentForReview=true` und sagen es hin.

Gesendet wurde am 2026-08-09 ueber die Seite **Veroeffentlichungsuebersicht**:
18 Aenderungen (Produktions-Roll-out 1.8.1, 16 Store-Grafiken in vier Sprachen,
Formfaktor „Android TV"). Danach meldet der Produktions-Track
„Der Release 1.8.1 wird ueberprueft", 1.8.0 steht auf „Durch einen anderen
Release ersetzt" — die beanstandete Fassung ist damit in keinem Track mehr
enthalten, wie Google es verlangt. Der Hinweisbalken „Einige kuerzlich
vorgenommene Aenderungen wurden abgelehnt" ist von der Seite verschwunden.

Offen ist nur noch die Antwort von Google (in der Regel bis zu 7 Tage).

Ein Einspruch ist nicht angebracht: die Beanstandung war berechtigt.
