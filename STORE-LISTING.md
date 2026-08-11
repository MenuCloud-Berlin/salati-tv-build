# Salati TV — Play-Store-Listing (Vorbereitung)

Für den Play-Console-Eintrag „Salati TV" (Package `de.salatibox.tv`) unter dem
MenuCloud-Account. Formfaktor: **Android TV / Google TV** (Leanback). Kostenlos,
werbefrei. Sobald der TV-Build (APK) grün ist, dient dieser Text 1:1 fürs Listing.

## App-Name
Salati TV — Gebetszeiten, Koran & Lernen

## Kurzbeschreibung (max. 80 Zeichen)
Gebetsuhr, Koran-Rezitatoren, Radio, Lern-Videos & Quiz — auf dem großen Bildschirm.

## Vollständige Beschreibung (max. 4000 Zeichen)
Salati TV bringt Gebetszeiten und Koran auf dein Android-TV oder Google-TV —
ruhig, schön und werbefrei.

GEBETSUHR
• Große, gut ablesbare Uhr mit den fünf Gebetszeiten und Countdown zum nächsten Gebet
• Vollständig offline berechnet (keine Internetverbindung für die Zeiten nötig)
• Standort aus vielen Städten wählbar, Berechnungsmethode und Madhab einstellbar

KORAN
• Rezitatoren-Auswahl mit vollständigen Suren (hochwertige Aufnahmen)
• Quran-Radio: 24/7-Sender direkt auf dem Fernseher
• Schöne, ruhige Darstellung für das Wohnzimmer

LERNEN
• Lern-Videos zu Koran-Arabisch und Grammatik
• Podcast-Folgen zum Zuhören
• Kurze Reels für zwischendurch
• Wissens-Quiz — allein mit der Fernbedienung oder als Zweitschirm-Spiel

VERBINDUNG MIT DEM HANDY
• Kopple die Salati-Handy-App per QR-Code mit dem Fernseher (gleiches WLAN)
• Steuere den TV bequem vom Handy
• Beantworte das Quiz auf dem Handy, während die Frage auf dem TV läuft
• Keine Cloud, keine Anmeldung nötig — die Verbindung bleibt lokal in deinem WLAN

Salati TV ist die TV-Ergänzung zur Salati-App: kostenlos, ohne Werbung, ohne
Tracking. Alle Medien laufen über die bestehende Salati-Infrastruktur.

## Neuigkeiten (Was ist neu, erste Version)
Erste Version von Salati TV: Gebetsuhr, Rezitatoren, Quran-Radio, Lern-Videos,
Podcasts, Reels, Quiz und Handy-Kopplung.

## Kategorie / Einstufung
- Kategorie: Bildung (oder Lebensstil)
- Inhaltseinstufung: Für alle Altersgruppen (keine bedenklichen Inhalte)
- Enthält keine Werbung; keine In-App-Käufe

## Grafik-Anforderungen (Android TV)
Alle Marken-Grafiken werden gerendert, nicht von Hand montiert:
`python scripts/marken-assets.py`. Hochladen in allen vier Sprachen:
`node scripts/play-grafiken.mjs`.

- **Leanback-Banner**: 320×180 in `drawable-xhdpi` (assets/banner.png, vom
  Config-Plugin verteilt). Muss den App-Namen tragen und sich vom dunklen
  Launcher abheben.
- **TV-Banner (Store)**: 1280×720, assets/store-banner-1280x720.png
- **Icon**: 512×512, assets/icon-512.png. Der Stern muss die Fläche
  ausfüllen; ein kleines Zeichen in schwarzem Feld hat 2026-08-09 die Ablehnung
  von versionCode 12 ausgelöst.
- **Adaptive Ikone**: assets/icon-adaptive.png (nur Stern, transparent, 60 %
  der Kante). NICHT icon.png verwenden: die 72-dp-Maske schneidet sonst die
  Zacken ab.
- **TV-Screenshots**: mind. 1, 1920×1080 (Gebetsuhr, Home-Hub, Rezitatoren,
  Quiz, Pairing), via `node scripts/play-screenshots.mjs`
- **Feature-Grafik**: 1024×500, assets/feature-graphic-1024x500.png

## Datenschutz
- Datenschutzerklärung: bestehende Salati-Datenschutzseite verwenden (salati.pro)
- Datensicherheit: keine personenbezogenen Daten erhoben; LAN-Pairing rein lokal
