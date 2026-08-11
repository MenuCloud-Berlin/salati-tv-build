# Salati TV — offene Punkte

> Stand 2026-08-11, Release **1.8.1** (Play versionCode 13, App Store Build 1).
>
> **Zuerst lesen:** Die App liegt seit dem 2026-08-11 auch im Apple App Store
> zur Pruefung. Hergang und Fallstricke: `docs/APPLE-TV-2026-08-11.md`.
> Erledigtes wird geloescht, nicht abgehakt. Die Historie steht im Git-Log und
> in `docs/`.

## Ausgeliefert

| Kanal | Stand | Beleg |
|---|---|---|
| Apple App Store | **1.8.1 in Pruefung** | Einreichung `fa1446ab`, Element „1.8.1 TV_OS", `submittedDate 2026-08-11T14:13Z`, Version `WAITING_FOR_REVIEW`, `releaseType AFTER_APPROVAL`, Build 1 `VALID` |
| Google Play (internal + production) | **1.8.1, vc 13**, Pruefung laeuft | `node scripts/play-status.mjs`; Console: „Aenderungen, die ueberprueft werden" |
| APK-Download (salati.pro) | **1.8.1** | `node scripts/upload-apk-r2.mjs --pruefen` |
| Webseite salati.pro | **live** | TV-Sektion mit sieben Bildern aus 1.4.0 und dem Knopf „APK fuer Fire TV laden" |

Die Store-Bilder sind am 2026-08-11 komplett neu gemacht worden: acht je
Sprache, aus 1.8.1 statt aus 1.4.0, je Store aus der eigenen Plattform
(Apple-TV-Simulator bzw. Android-TV-Emulator) und mit Bildunterschrift. Vorher
bekamen alle vier Sprachen dieselben sieben englischen Aufnahmen.

    node scripts/androidtv-screenshots.mjs --apk <apk>     # Android-TV-Emulator
    gh workflow run tvos-screenshots.yml --repo MenuCloud-Berlin/salati-tv-build
    python scripts/store-bilder.py                          # Bildunterschriften
    python scripts/store-bilder.py --quelle screenshots/androidtv --ziel screenshots/store/androidtv
    node scripts/play-screenshots.mjs                       # Play
    node scripts/asc-screenshots.mjs                        # App Store

## Was noch offen ist

- [ ] **Apples Antwort abwarten.** 1.8.1 steht auf `WAITING_FOR_REVIEW`. Kommt
      eine Ablehnung, steht der Grund in App Store Connect unter „Resolution
      Center"; `node scripts/asc-bestand.mjs` zeigt den Bestand, der Stand der
      Version kommt aus `node scripts/asc-listing.mjs --pruefen`.

- [ ] **Der Apple-TV-Build laeuft noch nie auf echter Hardware.** Belegt ist:
      er uebersetzt, signiert, laedt hoch und laeuft im tvOS-Simulator (die
      32 Store-Bilder kommen von dort). NICHT belegt ist die Kopplung mit dem
      Telefon ueber ein echtes WLAN und der Gebetsruf auf einem Geraet. Sobald
      TestFlight die Fassung freigibt, auf einem Apple TV nachsehen.

- [x] ~~Kopplung mit zwei echten Geraeten pruefen.~~ **Am 2026-08-08 belegt** —
      nicht mit zwei Telefonen, aber mit zwei ECHTEN APPS: die Handy-App
      (de.salatibox.de) auf einem Android-Emulator, die TV-App auf dem
      TV-Emulator, verbunden ueber TCP. Nachgewiesen wurde die ganze Kette:
      Handshake mit Token, die vom Fernseher gemeldete Bildschirmliste,
      Navigation vom Handy (Handy tippt „Read the Quran" -> Fernseher schaltet
      um), die Quiz-Spiegelung samt Rundlauf (vom Handy geantwortet ->
      Fernseher wertet richtig, 1 Punkt, naechste Frage) und die Uebernahme der
      Gebetszeit-Einstellungen (die TV-Uhr zeigt danach „Berlin, Deutschland",
      also das Ortslabel des HANDYS). Belege: `screenshots/` p-08 bis p-15.
      Was das NICHT belegt: eine echte WLAN-Strecke mit zwei Geraeten und deren
      Router. Das Protokoll und beide Apps sind es.

      Dabei kam ein echter Mangel heraus, der jetzt behoben ist: der Fernseher
      zeigt seit jeher eine Zeile „Manuell: host:port · Code …" — das Handy
      konnte damit **nichts anfangen**, es kannte nur die Kamera. Seit
      Handy-1.48.0 gibt es die manuelle Eingabe, und zwar auch auf dem
      Berechtigungs-Bildschirm: sie lag zuerst hinter der Kamera-Erlaubnis, also
      genau dort, wo sie niemand erreicht, der die Erlaubnis ablehnt.

- [x] ~~**Play-Ablehnung von versionCode 12 nachziehen.**~~ **Am 2026-08-09
      eingereicht.** Google hat vc12 am
      2026-08-09 zurueckgewiesen (Android TV App Quality Guidelines, Routing-ID
      ZLFS): „Your icon does not fill the entire icon space" und die
      Banner-Pruefung TV-BN. Behoben in 1.8.1 / vc13, Hergang und Messwerte in
      `docs/PLAY-ABLEHNUNG-2026-08-09.md`.

      Erledigt ist: vc13 liegt in internal UND production, vc12 in keinem Track
      mehr (`node scripts/play-status.mjs`); die neuen Grafiken liegen in allen
      vier Sprachen (`node scripts/play-grafiken.mjs --pruefen`, Hashes stimmen
      mit den Dateien in `assets/` ueberein).

      Die Einreichung selbst ging nur ueber die Console: solange die Ablehnung
      offen war, wies die API sie ab („Changes cannot be sent for review
      automatically"), die Skripte committen deshalb ohne Pruefungsanstoss. In
      der Console sind am 2026-08-09 **18 Aenderungen zur Ueberpruefung
      gesendet** (Produktions-Roll-out 1.8.1, 16 Store-Grafiken in vier
      Sprachen, Formfaktor „Android TV"). Der Produktions-Track meldet seitdem
      „Der Release 1.8.1 wird ueberprueft"; 1.8.0 steht auf „Durch einen
      anderen Release ersetzt", ist also nicht mehr enthalten. Kein Einspruch
      eingelegt: die Beanstandung war berechtigt.

      **Offen bleibt nur die Antwort von Google** (in der Regel bis zu 7 Tage).
      Kommt eine erneute Ablehnung, steht der Grund unter „Richtlinienstatus".

- [ ] **Inhalte sind nur deutsch betitelt.** Videos, Reels und Podcasts tragen
      deutsche Titel, waehrend die Oberflaeche 14 Sprachen spricht. Das ist eine
      Inhaltsfrage — die App kann Titel nicht uebersetzen. Loesungsweg waere,
      die R2-Indizes um Titel je Sprache zu erweitern.

- [ ] **Amazon Appstore (Fire TV).** Braucht ein eigenes, kostenloses
      Amazon-Developer-Konto. Solange es das nicht gibt, ist der
      APK-Direktdownload auf salati.pro der Weg fuer Fire-TV-Sticks — der ist
      seit 1.5.0 auf der Seite verlinkt.

## Bewusst nicht gemacht (kein Handeln noetig)

- **Uebersetzungen offline.** Der Korantext liegt seit 1.6.0 vollstaendig im
  Paket (6.236 Verse mit Umschrift). Die Uebersetzungen nicht: 14 Sprachen
  waeren ein Vielfaches der Textgroesse, und welche gebraucht wird, steht erst
  auf dem Geraet fest. Wer eine Sure einmal mit Netz oeffnet, hat ihre
  Uebersetzung danach dauerhaft.

- **Wort-Synchrone Rezitation im Leser bleibt online.** Sie braucht die
  Vers-Einzeldateien UND die Wort-Zeitstempel von quran.com — bei Al-Baqara
  waeren das 286 Dateien je Rezitator. Wer eine Rezitation offline hoeren will,
  speichert sie seit 1.7.0 im Rezitatoren-Bereich: dort ist es EINE Datei je
  Sure (Voll-Suren-Aufnahme), und die spielt ohne Netz in voller Laenge.

- **Der Gebetsruf weckt die App nicht.** Seit 1.8.0 ruft der Fernseher zur
  Gebetszeit (Auswahl je Gebet, drei Aufnahmen, ab Werk alles aus) — aber nur,
  solange die App laeuft. Android TV hat keinen verlaesslichen Weg, eine App zur
  Gebetszeit aus dem Ruhezustand zu holen, ohne einen dauerhaften
  Hintergrunddienst; die Handy-App macht das ueber Benachrichtigungen, die es
  auf dem Fernseher so nicht gibt. Fuer eine Gebetsuhr, die ohnehin auf dem
  Bildschirm steht, ist das der Normalfall — nach einem Neustart des Fernsehers
  bleibt sie stumm, bis jemand sie oeffnet. Der Hinweistext in den Einstellungen
  sagt genau das.
