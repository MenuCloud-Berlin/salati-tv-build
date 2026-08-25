// Salati TV — Expo + react-native-tvos (Fire TV / Android TV / Google TV / Apple TV).
// CommonJS-Config (plain JS), damit eas-cli/@expo/config sie im Standalone-Dir
// ohne TS-Transpile-Setup lesen kann. Build via EAS (salatipro-Credits),
// Play-Auslieferung unter menucloudberlin (Service-Account), Package de.salatibox.tv.
module.exports = {
  name: 'Salati TV',
  slug: 'salati-tv',
  owner: 'salatipro',
  // 1.1.0 (Audit 2026-07-29): Gebetszeiten rechnen jetzt exakt wie die
  // Handy-App (Methoden-IDs, Hochbreiten-Regel, Polarkreis, Minuten-Rundung);
  // Methode, Hochbreiten-Regel und Minuten-Korrektur sind einstellbar.
  // 1.3.0 (Release 2026-07-29): das Handy überträgt seine Gebetszeit-Einstellungen
  // nach der Kopplung an den Fernseher (src/lib/settings.ts); der Uhren-Screen
  // berechnete die Gebetszeiten sekündlich neu statt einmal je Tag; ESLint ist
  // eingerichtet und alle 27 Befunde sind behoben.
  // 1.4.0 (Release 2026-08-08): Darstellung und Koran-Leser holen auf.
  // Fünf Farbwelten (lib/theme.ts) statt fest verdrahteter Farben in elf
  // Bildschirmen; die acht Koran-Schriften der Handy-App inklusive
  // KFGQPC-Textumschreibung und Sukūn-Einstellung; der Leser bekommt
  // Schriftgrad, ein-/ausblendbare Umschrift und Übersetzung sowie eine echte
  // Bedienung (Vers vor/zurück, Vers wiederholen, Auto-Weiter abschaltbar);
  // die Einstellungen sind in fünf Bereiche gegliedert (Befund D4); der
  // Home-Hub merkt sich den Fokus (Befund N4), zeigt das nächste Gebet und
  // schneidet keine Kachelreihe mehr ab; die Uhr zeigt Hidschri-Datum und
  // Sonnenaufgang.
  // 1.5.0 (Release 2026-08-08): so viel wie moeglich ohne Netz. Jede geholte
  // Liste und jede gelesene Sure liegt in einer eigenen, groessenbegrenzten
  // Ablage (src/lib/cache.ts) — der Fernseher zeigt sie ohne Verbindung weiter
  // und SAGT, dass sie aus dem Speicher kommt. Dafuer musste der unsichtbare
  // HTTP-Zwischenspeicher der Netzschicht weichen: er bediente Abrufe still aus
  // sich selbst, wodurch der Offline-Zustand gar nicht ablesbar war.
  // 1.6.0 (Release 2026-08-08): der Korantext liegt im Paket — 6.236 Verse
  // Wort fuer Wort mit Umschrift (2,4 MB), der Leser braucht also gar keine
  // erste Verbindung mehr. Rezitatoren- und Senderliste haben denselben
  // Rueckfall. Und der Fernseher zeigt Zeiten endlich in der Zone des
  // GEWAEHLTEN ORTES statt in seiner eigenen (Audit-Befund P10/K5, seit dem
  // 2026-07-29 offen).
  // 1.7.0 (Release 2026-08-08): Rezitationen lassen sich speichern. Eine Sure
  // je Datei (der Fernseher spielt die Voll-Suren-Aufnahme von mp3quran, nicht
  // die Vers-Schnipsel wie die Handy-App) — gespeichert wird nur, was der
  // Nutzer waehlt, und der neue Speicher-Bereich zeigt Belegung und loescht
  // wieder.
  // 1.8.1 (Release 2026-08-09): Play hat vc12 abgelehnt — „Your icon does not
  // fill the entire icon space" plus die Banner-Pruefung TV-BN. Der Stern
  // belegte nur 71 % der Icon-Flaeche, und das Leanback-Banner war fast
  // schwarz, hob sich also in der Launcher-Reihe von nichts ab. Saemtliche
  // Marken-Grafiken kommen jetzt aus `scripts/marken-assets.py`: die Ikone
  // vollflaechig, der Vordergrund der adaptiven Ikone separat (damit die
  // 72-dp-Maske die Zacken nicht abschneidet), das Banner mit Goldschimmer
  // und dem App-Namen.
  // 1.10.0 (Release 2026-08-23): nativer Adhan-Hintergrunddienst (Android,
  // Foreground-Service statt reinem JS-Interval), plus Screensaver-Optionen
  // (Uhr-Groesse, Vers des Tages, Jumu'a-Kennzeichnung, Wetter).
  version: '1.11.0',
  scheme: 'salatitv',
  orientation: 'landscape',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0b0b0d',
  assetBundlePatterns: ['**/*'],
  android: {
    package: 'de.salatibox.tv',
    // 6, weil Play fuer de.salatibox.tv die Codes 1, 3 und 5 schon kennt
    // (EAS-Builds mit remote autoIncrement); 3 waere abgelehnt worden.
    // 8 = 1.4.0; 7 liegt als 1.3.0 im Produktions-Track. 9 = 1.5.0, 10 = 1.6.0,
    // 11 = 1.7.0, 12 = 1.8.0 (von Play abgelehnt, siehe oben).
    // 16 = 1.10.0 (nativer Adhan-Dienst, Screensaver-Optionen).
    versionCode: 17,
    // Der Vordergrund darf NICHT icon.png sein: das ist seit 1.8.1 vollflaechig,
    // und die Maske zeigt vom 108-dp-Vordergrund nur die mittleren 72 dp — die
    // Zacken waeren abgeschnitten.
    adaptiveIcon: { foregroundImage: './assets/icon-adaptive.png', backgroundColor: '#0b0b0d' },
  },
  // Apple TV (tvOS). Dieselbe Anwendung, derselbe Quelltext — Apple verlangt nur
  // eigene Marken-Grafiken (quer statt quadratisch) und eine eigene Bundle-ID.
  ios: {
    bundleIdentifier: 'de.salatibox.tv',
    // Wird beim Bauen vom Workflow hochgezaehlt; Apple lehnt eine schon
    // hochgeladene Build-Nummer ab, auch wenn die Version dieselbe bleibt.
    buildNumber: '2',
    infoPlist: {
      // Der Fernseher oeffnet fuer die Handy-Kopplung einen TCP-Server im WLAN
      // (src/lib/pairing.ts). Ohne diesen Text verweigert tvOS den Zugriff aufs
      // lokale Netz — und die Kopplung waere stumm kaputt.
      NSLocalNetworkUsageDescription:
        'Salati TV oeffnet im heimischen WLAN eine direkte Verbindung, damit dein Handy den Fernseher steuern kann. Es werden keine Daten ins Internet gesendet.',
      // Die App nutzt ausschliesslich HTTPS und Apples eingebaute Verschluesselung.
      // Ohne diesen Eintrag fragt App Store Connect das bei JEDEM Build erneut ab
      // und haelt den Build so lange von der Pruefung zurueck.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    // VOR config-tv angemeldet, weil gefaehrliche Mods in umgekehrter
    // Reihenfolge laufen: der zuletzt angemeldete zuerst. Andersherum kopierte
    // config-tv danach wieder seine sechs gleich grossen Banner darueber
    // (am 2026-08-09 gemessen).
    './plugins/with-tv-banner',
    [
      '@react-native-tvos/config-tv',
      {
        isTV: true,
        androidTVBanner: './assets/banner.png',
        // Expo SDK 57 verlangt in jedem Podspec tvOS 16.4; der Vorgabewert des
        // Plugins (15.1) laesst `pod install` scheitern.
        tvosDeploymentTarget: '16.4',
        // Apple-TV-Markengrafiken, erzeugt von scripts/marken-assets.py.
        // `icon` ist zugleich das App-Store-Bild (1280x768) — Apple nimmt es
        // aus dem Asset-Katalog des Programms, nicht aus dem Store-Formular.
        appleTVImages: {
          icon: './assets/appletv/icon-1280x768.png',
          iconSmall: './assets/appletv/icon-400x240.png',
          iconSmall2x: './assets/appletv/icon-800x480.png',
          topShelf: './assets/appletv/top-shelf-1920x720.png',
          topShelf2x: './assets/appletv/top-shelf-3840x1440.png',
          topShelfWide: './assets/appletv/top-shelf-wide-2320x720.png',
          topShelfWide2x: './assets/appletv/top-shelf-wide-4640x1440.png',
        },
      },
    ],
    // Release-Signierung mit dem echten Upload-Keystore; ueberlebt `expo prebuild`,
    // weil android/ gitignored ist und neu erzeugt wird.
    './plugins/with-release-signing',
    // Natives Android-Foreground-Service-Modul fuer den Gebetsruf im
    // Hintergrund (s. plugins/with-adhan-alarm.js + plugins/adhan-native/).
    // Nur Android — Apple TV hat kein Aequivalent (bewusste Scope-Entscheidung).
    './plugins/with-adhan-alarm',
    // Nur der tvOS-Build uebersetzt ExpoModulesCore aus den Quellen; die
    // brauchen ein Swift-Merkmal, das im Sprachstand 6 noch aus ist.
    './plugins/with-swift-weak-let',
    ['expo-splash-screen', { backgroundColor: '#0b0b0d', image: './assets/icon-adaptive.png', imageWidth: 200 }],
    'expo-font',
    'expo-video',
  ],
  extra: {
    r2Base: 'https://pub-d0489c0572704285af79896edb72cbed.r2.dev',
    eas: { projectId: '16fae2aa-2c17-4dd9-a1df-c7bd7009c99f' },
  },
};
