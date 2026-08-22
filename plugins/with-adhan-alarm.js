// Config-Plugin: natives Android-Foreground-Service-Modul, das den Gebetsruf
// auch feuert, wenn die TV-App nicht im Vordergrund laeuft (s. Kotlin-Quellen
// unter plugins/adhan-native/ fuer das Warum — der bisherige JS-`setInterval`
// in src/lib/azanRuf.ts stirbt mit der App).
//
// Warum ein Plugin und keine handgeschriebenen Dateien direkt in android/?
// apps/tv/android/ ist gitignored und wird von `expo prebuild` komplett neu
// erzeugt (gleicher Grund wie plugins/with-release-signing.js) — Handaenderungen
// waeren beim naechsten Prebuild weg.
//
// NUR Android — Apple TV (tvOS) hat kein Aequivalent zu Foreground-Services
// fuer diesen Zweck; das ist eine bewusste Scope-Entscheidung (s. Plan), kein
// Versehen.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, withMainApplication } = require('expo/config-plugins');

const PACKAGE_NAME = 'de.salatibox.tv';
const NATIVE_SRC_DIR = path.join(__dirname, 'adhan-native');
const KOTLIN_FILES = [
  'AdhanAlarmReceiver.kt',
  'AdhanPlaybackService.kt',
  'AdhanAlarmModule.kt',
  'AdhanAlarmPackage.kt',
];
// Muss zu AZAN_CHOICES in src/lib/azan.ts passen ('aus' spielt nie etwas ab).
const AZAN_SOUNDS = ['adhan1', 'adhan2', 'fajr'];

/** Kotlin-Quelldateien + die drei Azan-mp3s (als raw-Resource, s. Kommentar in
 *  AdhanPlaybackService.kt) in den generierten android/-Baum kopieren. */
const withAdhanNativeFiles = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const javaDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app', 'src', 'main', 'java',
        ...PACKAGE_NAME.split('.'),
        'alarm',
      );
      fs.mkdirSync(javaDir, { recursive: true });
      for (const datei of KOTLIN_FILES) {
        fs.copyFileSync(path.join(NATIVE_SRC_DIR, datei), path.join(javaDir, datei));
      }

      const rawDir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res', 'raw');
      fs.mkdirSync(rawDir, { recursive: true });
      const quelle = path.join(cfg.modRequest.projectRoot, 'assets', 'audio', 'azan');
      for (const name of AZAN_SOUNDS) {
        const von = path.join(quelle, `${name}.mp3`);
        if (!fs.existsSync(von)) {
          throw new Error(`with-adhan-alarm: ${von} fehlt (erwartet fuer R.raw.${name}).`);
        }
        fs.copyFileSync(von, path.join(rawDir, `${name}.mp3`));
      }
      return cfg;
    },
  ]);

const REQUIRED_PERMISSIONS = [
  'android.permission.FOREGROUND_SERVICE',
  'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
  'android.permission.SCHEDULE_EXACT_ALARM',
  'android.permission.RECEIVE_BOOT_COMPLETED',
];

const withAdhanManifest = (config) =>
  withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) throw new Error('with-adhan-alarm: <application> nicht im generierten Manifest gefunden.');

    // Permissions einzeln pruefen statt blind anzuhaengen — ein zweiter
    // Prebuild-Lauf soll nicht doppelte Eintraege erzeugen.
    manifest.manifest['uses-permission'] = manifest.manifest['uses-permission'] ?? [];
    for (const perm of REQUIRED_PERMISSIONS) {
      const vorhanden = manifest.manifest['uses-permission'].some(
        (p) => p.$?.['android:name'] === perm,
      );
      if (!vorhanden) {
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    app.receiver = app.receiver ?? [];
    const receiverDa = app.receiver.some((r) => r.$?.['android:name'] === '.alarm.AdhanAlarmReceiver');
    app.service = app.service ?? [];
    const serviceDa = app.service.some((s) => s.$?.['android:name'] === '.alarm.AdhanPlaybackService');
    if (!receiverDa || !serviceDa) {
      // Einfacher als eine XML-Baum-Konstruktion: das fertige Fragment durch
      // den selben xml2js-Parser jagen, den expo/config-plugins intern nutzt,
      // waere ueberbaut fuer zwei feste Eintraege — stattdessen die AndroidManifest
      // als Text nachbearbeiten waere fragiler als der strukturierte Weg oben,
      // deshalb hier stattdessen direkt die geparsten Objekte ergaenzen.
      if (!receiverDa) {
        app.receiver.push({
          $: { 'android:name': '.alarm.AdhanAlarmReceiver', 'android:exported': 'false' },
          'intent-filter': [
            {
              action: [
                { $: { 'android:name': 'de.salatibox.tv.ADHAN_ALARM' } },
                { $: { 'android:name': 'android.intent.action.BOOT_COMPLETED' } },
                { $: { 'android:name': 'android.intent.action.TIME_SET' } },
                { $: { 'android:name': 'android.intent.action.TIMEZONE_CHANGED' } },
              ],
            },
          ],
        });
      }
      if (!serviceDa) {
        app.service.push({
          $: {
            'android:name': '.alarm.AdhanPlaybackService',
            'android:exported': 'false',
            'android:foregroundServiceType': 'mediaPlayback',
          },
        });
      }
    }
    return cfg;
  });

const IMPORT_ANCHOR = 'import com.facebook.react.PackageList';
const PACKAGES_ANCHOR =
  /(\/\/ Packages that cannot be autolinked yet can be added manually here, for example:\n\s*\/\/ add\(MyReactNativePackage\(\)\)\n)/;

const withAdhanMainApplication = (config) =>
  withMainApplication(config, (cfg) => {
    let out = cfg.modResults.contents;
    if (out.includes('AdhanAlarmPackage')) return cfg; // schon eingetragen (zweiter Prebuild-Lauf)

    if (!out.includes(IMPORT_ANCHOR)) {
      throw new Error('with-adhan-alarm: Import-Anker in MainApplication.kt nicht gefunden — Expo/RN-Vorlage geaendert?');
    }
    out = out.replace(IMPORT_ANCHOR, `${IMPORT_ANCHOR}\nimport de.salatibox.tv.alarm.AdhanAlarmPackage`);

    if (!PACKAGES_ANCHOR.test(out)) {
      throw new Error('with-adhan-alarm: Packages-Anker in MainApplication.kt nicht gefunden — Expo/RN-Vorlage geaendert?');
    }
    out = out.replace(PACKAGES_ANCHOR, '$1          add(AdhanAlarmPackage())\n');

    cfg.modResults.contents = out;
    return cfg;
  });

const withAdhanAlarm = (config) =>
  withAdhanMainApplication(withAdhanManifest(withAdhanNativeFiles(config)));

module.exports = withAdhanAlarm;
