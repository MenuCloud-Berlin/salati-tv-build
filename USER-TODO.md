# Salati TV — offene Punkte

> Stand 2026-08-09, Release **1.8.1 / versionCode 13**.
>
> **Zuerst lesen:** vc12 wurde von Play abgelehnt. vc13 liegt hochgeladen in
> beiden Tracks, ist aber noch NICHT zur Pruefung eingereicht (das geht nur in
> der Console). Siehe den ersten offenen Punkt und
> `docs/PLAY-ABLEHNUNG-2026-08-09.md`.
> Erledigtes wird geloescht, nicht abgehakt. Die Historie steht im Git-Log und
> in `docs/`.
>
> Die frueher hier stehende Fassung war vom 24.07. und nannte vc5 / 1.0.3 als
> aktuellen Stand — sechs Versionen alt. Sie ist ersetzt.

## Ausgeliefert

| Kanal | Stand | Beleg |
|---|---|---|
| Google Play (internal + production) | **1.8.1, vc 13** (hochgeladen, Pruefung offen) | `node scripts/play-status.mjs` liest es von Google zurueck |
| APK-Download (salati.pro) | **1.8.1** | `node scripts/upload-apk-r2.mjs --pruefen` |
| Webseite salati.pro | **live** | TV-Sektion mit sieben Bildern aus 1.4.0 und dem Knopf „APK fuer Fire TV laden" |

Die Store-Screenshots liegen in **allen vier** Listing-Sprachen (de-DE, en-US,
tr-TR, ar) — bis zum 2026-08-08 hatte nur `en-US` welche.

## Was noch offen ist

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
