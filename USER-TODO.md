# Salati TV — offene Punkte

> Stand 2026-08-16, Release **1.9.1** ist in BEIDEN Laeden:
> Play production `completed` mit versionCode 15, App Store Build 5
> `WAITING_FOR_REVIEW`.
>
> 1.9.0 (vc 14, Build 4) ging kurz zuvor heraus, gebaut aus `a08dc521` — danach
> kamen noch Korrekturen dazu, die der Nutzer sieht, vor allem der Wortabstand
> im Vers auf Apple TV. Damit in den Laeden genau das liegt, was geprueft wurde,
> ist der Stand als 1.9.1 nachgezogen worden: Apple-Einreichung zurueckgenommen
> (`DEVELOPER_REJECTED`), Version umbenannt, Build 5 angehaengt, neu
> eingereicht.
>
> **Zuerst lesen:** Hergang und Fallstricke der Apple-Einreichung stehen in
> `docs/APPLE-TV-2026-08-11.md`.
> Erledigtes wird geloescht, nicht abgehakt. Die Historie steht im Git-Log und
> in `docs/`.

<!-- OFFEN:START -->
<!-- Diese Liste liest `00_Zentrale/werkzeug/aufgaben.mjs`. Ausfuehrlich mit
     Belegen steht dasselbe unter „Was noch offen ist". -->
- [x] **Apple TV auf echter Hardware pruefen** (erledigt 21.08.) — belegt ist Uebersetzen, Signieren, Hochladen und der tvOS-Simulator; nicht belegt sind die Kopplung mit dem Telefon ueber ein echtes WLAN und der Gebetsruf am Geraet. Sobald TestFlight die Fassung freigibt. Das laesst sich hier grundsaetzlich nicht nachholen: Der Simulator hat kein echtes WLAN und keinen Lautsprecher im Raum. Worauf zu achten ist — findet das Telefon den Fernseher im selben Netz (nicht im Gastnetz)? Kommt der Gebetsruf zur richtigen Zeit und in voller Laenge? Bleibt die Kopplung ueber Nacht bestehen, wenn der Fernseher in den Bereitschaftsbetrieb geht? · sobald TestFlight freigibt
- [ ] **Amazon Appstore (Fire TV) entscheiden** — braucht ein eigenes, kostenloses Amazon-Developer-Konto; solange es das nicht gibt, bleibt der APK-Direktdownload auf salati.pro der Weg.

      **Technisch ist nichts mehr zu tun.** Am 19.08.2026 nachgesehen: Die App
      erfuellt die Fire-TV-Anforderungen bereits vollstaendig, weil sie sie fuer
      Android TV ohnehin braucht — `android.software.leanback` und
      `android.hardware.touchscreen` stehen beide auf `required="false"`, der
      `LEANBACK_LAUNCHER` ist eingetragen, und `android:banner` zeigt auf
      `@drawable/tv_banner` (alles in
      `apps/tv/android/app/src/main/AndroidManifest.xml`, erzeugt aus
      `app.config.js` und `plugins/with-tv-banner`). Amazon nimmt dasselbe APK,
      das heute schon auf salati.pro liegt.

      **Es fehlt also ausschliesslich der Klickweg, und der braucht dein Konto:**
      `developer.amazon.com` → Anmelden mit einem Amazon-Konto → *Apps & Services*
      → *Add New App* → *Android* → APK hochladen → Ladenbilder und Text (beides
      liegt in `store/` bzw. `STORE-LISTING.md`) → einreichen.

      **Was dafuer spricht:** kostet nichts, keine Jahresgebuehr, und der
      Direktdownload eines APK ist fuer die meisten Nutzer eine Huerde, die sie
      nicht nehmen. **Was dagegen spricht:** ein dritter Laden ist ein dritter
      Ort, an dem eine Fassung veralten kann, und Amazons Pruefung ist ein
      weiterer Terminplan. **Entscheidung:** deine — ich kann sie nicht treffen,
      weil sie davon abhaengt, wie viel Pflege du dir aufladen willst · keine Eile, aendert am Produkt nichts
- [ ] **Titel der Inhalte sind nur deutsch** — Videos, Reels und Podcasts tragen deutsche Titel, die Oberflaeche spricht 14 Sprachen.

      **Am 19.08.2026 durchgesehen — es sind Daten, kein Code, und deshalb ohne
      deine Schluessel nicht loesbar.** Die Titel stehen in drei Indizes, die
      zur Laufzeit ueber HTTP geladen werden und **nirgends im Repo liegen**:

      | Was | Wo | Eintraege |
      |---|---|---|
      | Videos | `…r2.dev/videos/index.json` | 62 |
      | Reels | `…r2.dev/reels/index.json` | 496 |
      | Podcasts | Supabase-Bucket `podcasts/index.json` | 68 |

      Geladen in `apps/tv/src/lib/content.ts` (Z. 7, 108–125). Geschrieben
      werden koennen sie nur von `podcast/scripts/upload_videos_r2.py`,
      `upload_reels_r2.py` und `upload.py` — und die verlangen
      `cloudflare_id`/`cloudflare_sec`/`cloudflare_s3_api` bzw.
      `SUPABASE_SERVICE_ROLE_KEY` aus der `.env` im Projektstamm.

      **Der Aufwand ist kleiner, als die Zahlen aussehen.** 626 Eintraege, aber
      nur rund 130–170 **verschiedene** Titel, weil sich die 68 Folgentitel
      ueber Podcast, Video und Reels wiederholen. Die Quelle liegt im Repo und
      ist ohne Schluessel bearbeitbar: `podcast/manifest.json` (68 Titel) und
      `podcast/scripts/series.py` (10 Reihentitel). Und beide Upload-Skripte
      haben einen **Index-Modus, der kein einziges MP4 anfasst**
      (`upload_videos_r2.py:127-142`) — das Umschreiben dauert Minuten, nicht
      Stunden.

      **Das Schema hat heute kein Feld dafuer.** `VideoEntry`, `ReelEntry` und
      `PodcastEntry` in `content.ts:22-53` kennen genau ein `title: string`.
      Ein `titles: Record<Sprache, string>` waere zu ergaenzen, dazu vier
      Lesestellen (`VideosScreen.tsx:113`, `ReelsScreen.tsx:106`,
      `PodcastsScreen.tsx:115`, `content.ts:147`).

      **Der billigere Weg, den es schon gibt.** Die Handy-App zeigt seit dem
      28.07.2026 ein Abzeichen „Inhalt auf Deutsch"
      (`apps/mobile/src/features/media/content-language-badge.tsx`). **Die
      TV-App liest das Feld `lang` nicht einmal aus.** Das ehrlich zu
      kennzeichnen statt 2.000 Strings zu uebersetzen ist eine Zeile Schema und
      ein Abzeichen — und es ist eine Produktentscheidung, keine technische,
      deshalb steht sie hier und nicht im Code · keine Eile — erst entscheiden, welcher der beiden Wege es sein soll
<!-- OFFEN:END -->

## Ausgeliefert

| Kanal | Stand | Beleg |
|---|---|---|
| Apple App Store | **1.9.1 in Pruefung** | `node scripts/asc-listing.mjs --pruefen`: Version 1.9.1 `WAITING_FOR_REVIEW`, Build 5 `VALID`, Einreichung `c1cb3ef2`; Bilder 4x8 `COMPLETE` |
| Google Play (internal + production) | **1.9.1, vc 15** | `node scripts/play-status.mjs`: production und internal `completed` vc 15, Notizen in vier Sprachen |
| APK-Download (salati.pro) | **1.9.1** | `node scripts/upload-apk-r2.mjs --pruefen`: HTTP 200, 103,2 MB; vor dem Hochladen geprueft auf vier ABIs, acht Koran-Schriften und Upload-Keystore |
| Webseite salati.pro | **live** | TV-Sektion mit sieben Bildern aus 1.8.1 (am 2026-08-11 ersetzt) und dem Knopf „APK fuer Fire TV laden" |

Die Store-Bilder sind am 2026-08-16 erneut komplett neu gemacht worden — 32 je
Store, aus 1.9.0. Zwei davon zeigten vorher etwas anderes, als ihre Unterschrift
versprach: unter „Den Koran am Fernseher lesen" stand die Surenliste, unter
„Genau nach deiner Moschee · 23 Berechnungsmethoden" die Sprachwahl. Die
Automatik kam nur bis zur Auswahl; jetzt gibt es Ziele INNERHALB eines
Bildschirms (`salatitv://screen/quran/4`, `-salatiSure`, `-salatiBereich`).

Drei Werkzeugfehler kamen dabei heraus, alle behoben: das Android-Skript hing an
einem fremden Emulator mit toter Konsole (jetzt Zeitgrenze + `--geraet`), es
spiegelte die Richtungstasten in RTL-Sprachen nicht (Arabisch zeigte Sure 1 statt
Sure 4), und der Apple-Simulator kennt die App unter tvOS 26 nach einem Neustart
nicht mehr (jetzt Installation je Sprache).

    node scripts/androidtv-screenshots.mjs --apk <apk>     # Android-TV-Emulator
    gh workflow run tvos-screenshots.yml --repo MenuCloud-Berlin/salati-tv-build
    python scripts/store-bilder.py                          # Bildunterschriften
    python scripts/store-bilder.py --quelle screenshots/androidtv --ziel screenshots/store/androidtv
    node scripts/play-screenshots.mjs                       # Play
    node scripts/asc-screenshots.mjs                        # App Store

## Am 2026-08-11 mit aufgeraeumt

- **Eine Textquelle statt zwei.** Die Store-Texte lagen doppelt (Play in
  `store/listing/*.md`, Apple in `store/appstore/*.json`) und waren
  auseinandergelaufen: die Play-Beschreibung war vier Versionen alt. Jetzt gibt
  es nur noch `store/texte/` (`scripts/lib/store-texte.mjs`); `{{GERAET}}` wird
  je Laden aufgeloest, weil Apple keine Verweise auf fremde Plattformen duldet.
  `npm run pruefe-store` prueft Laengen, Wortwahl, Bildunterschriften und
  Bildmasse vor jeder Einreichung.
- **Webseite zeigt 1.8.1.** Die sieben TV-Bilder auf salati.pro stammten aus
  1.4.0 und waren englisch; jetzt sind sie aus 1.8.1 und deutsch. Nebenbefund:
  `tv-settings` stand gar nicht in `optimize-web-images.mjs`, wurde also bei
  jedem Durchlauf uebersehen. Live geprueft: sieben Dateien, HTTP 200, Groessen
  byte-genau wie lokal erzeugt.
- **Die CI lief wochenlang stumm rot.** `pnpm/action-setup` scheiterte an
  `virtual-store-dir` aus der `.npmrc`; danach fielen drei Gebetszeit-Tests um,
  weil ihre Zeitzone von der Maschine kam. Beides behoben, Lint laeuft jetzt
  wirklich mit. Lauf 31513664177: gruen.

## Was noch offen ist

- [x] **Der Apple-TV-Build laeuft noch nie auf echter Hardware.** (erledigt 21.08.) Belegt ist:
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
