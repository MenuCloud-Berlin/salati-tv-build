// Config-Plugin: echter Upload-Keystore fuer den Release-Build der TV-App.
//
// Warum ein Plugin und kein Handgriff in android/app/build.gradle?
// apps/tv/android/ ist gitignored und wird von `expo prebuild` komplett neu
// erzeugt. Jede Aenderung von Hand ist beim naechsten Prebuild weg - und der
// RN-Vorlagentext signiert Release-Builds still mit dem DEBUG-Keystore
// ("Caution! In production, you need to generate your own keystore file").
// Das Ergebnis lehnt die Play Console erst beim Upload ab.
//
// Die Passwoerter stehen NICHT hier, sondern als Gradle-Properties in
// ~/.gradle/gradle.properties (ausserhalb des Repos):
//   TV_RELEASE_STORE_FILE=C:/Users/domen/Documents/salati-tv-credentials/upload-keystore.jks
//   TV_RELEASE_STORE_PASSWORD=...
//   TV_RELEASE_KEY_ALIAS=...
//   TV_RELEASE_KEY_PASSWORD=...
// Erwarteter Upload-Fingerabdruck (Play):
//   SHA-1 E9:DD:82:C1:14:12:8B:E8:93:34:C9:2C:95:7E:5C:07:82:4E:83:D9
const fs = require('fs');
const path = require('path');
const { withAppBuildGradle, withDangerousMod } = require('expo/config-plugins');

const MARKER = 'TV_RELEASE_SIGNING_PROPS';

const PROPS_BLOCK = `
/**
 * Release-Signierung (siehe plugins/with-release-signing.js).
 * Pfad + Passwoerter kommen aus ~/.gradle/gradle.properties, nie aus dem Repo.
 */
def ${MARKER} = ['TV_RELEASE_STORE_FILE', 'TV_RELEASE_STORE_PASSWORD', 'TV_RELEASE_KEY_ALIAS', 'TV_RELEASE_KEY_PASSWORD']
def hasTvReleaseSigningProps = ${MARKER}.every { project.hasProperty(it) }

`;

const RELEASE_SIGNING_CONFIG = `        release {
            if (hasTvReleaseSigningProps) {
                storeFile file(TV_RELEASE_STORE_FILE)
                storePassword TV_RELEASE_STORE_PASSWORD
                keyAlias TV_RELEASE_KEY_ALIAS
                keyPassword TV_RELEASE_KEY_PASSWORD
            }
        }
`;

const GUARD = `
// Kein stiller Debug-Fallback: ein Release-Build ohne echten Upload-Keystore
// bricht ab, statt ein AAB zu erzeugen, das Play nach Minuten Bauzeit ablehnt.
gradle.taskGraph.whenReady { graph ->
    def releaseTask = graph.allTasks.find { t ->
        t.project.path == project.path && t.name ==~ /^(assemble|bundle|install|package)Release.*/
    }
    if (releaseTask == null) return

    def keystore = android.signingConfigs.findByName('release')?.storeFile
    def debugKeystore = file('debug.keystore')
    def istEchterKeystore = keystore != null &&
        keystore.exists() &&
        keystore.canonicalFile != debugKeystore.canonicalFile
    if (istEchterKeystore) return

    def fehlend = ${MARKER}.findAll { !project.hasProperty(it) }
    def ursache = fehlend.isEmpty()
        ? "TV_RELEASE_STORE_FILE zeigt auf keinen nutzbaren Keystore: \${keystore}"
        : "Fehlende Gradle-Properties: \${fehlend.join(', ')}"
    throw new GradleException(
        "Release-Build ohne Upload-Keystore abgebrochen (Task \${releaseTask.path}).\\n" +
        "\${ursache}\\n" +
        "Setze die Werte in ~/.gradle/gradle.properties (NICHT im Repo):\\n" +
        "  TV_RELEASE_STORE_FILE / TV_RELEASE_STORE_PASSWORD / TV_RELEASE_KEY_ALIAS / TV_RELEASE_KEY_PASSWORD\\n" +
        "Erwarteter SHA-1: E9:DD:82:C1:14:12:8B:E8:93:34:C9:2C:95:7E:5C:07:82:4E:83:D9\\n" +
        "Fuer einen Testlauf ohne Keystore: assembleDebug statt assembleRelease."
    )
}
`;

/**
 * Reine Textumformung, damit sie ohne Prebuild testbar ist.
 * Wirft, wenn die erwarteten Stellen der RN-Vorlage fehlen - lieber ein harter
 * Fehler beim Prebuild als ein still debug-signiertes Release.
 */
function patchAppBuildGradle(contents) {
  if (contents.includes(MARKER)) return contents;

  let out = contents;

  const androidBlock = /^android \{$/m;
  if (!androidBlock.test(out)) throw new Error('with-release-signing: `android {` nicht gefunden');
  out = out.replace(androidBlock, `${PROPS_BLOCK}android {`);

  const debugSigning = /( {4}signingConfigs \{\n {8}debug \{[\s\S]*?\n {8}\}\n)/;
  if (!debugSigning.test(out)) throw new Error('with-release-signing: signingConfigs.debug nicht gefunden');
  out = out.replace(debugSigning, `$1${RELEASE_SIGNING_CONFIG}`);

  const templateRelease =
    / {12}\/\/ Caution! In production, you need to generate your own keystore file\.\n {12}\/\/ see https:\/\/reactnative\.dev\/docs\/signed-apk-android\.\n {12}signingConfig signingConfigs\.debug\n/;
  if (!templateRelease.test(out)) {
    throw new Error('with-release-signing: release-buildType der RN-Vorlage nicht gefunden');
  }
  out = out.replace(templateRelease, '            signingConfig signingConfigs.release\n');

  return `${out.replace(/\s*$/, '')}\n${GUARD}`;
}

/**
 * `expo prebuild` loescht android/ vollstaendig und erzeugt es neu — dabei
 * verschwindet auch android/local.properties, das den Pfad zum Android-SDK
 * traegt. Ist weder ANDROID_HOME noch ANDROID_SDK_ROOT gesetzt (auf diesem
 * Rechner der Fall), bricht der naechste Gradle-Lauf mit „SDK location not
 * found" ab. Belegt am 2026-07-29: nach `expo prebuild --platform android
 * --clean` war die Datei weg.
 *
 * Deshalb schreibt der Prebuild sie hier selbst wieder — aus der Umgebung oder,
 * falls die nichts hergibt, aus den ueblichen SDK-Orten. Die Datei bleibt
 * gitignored (sie steht in android/) und enthaelt keinerlei Geheimnis.
 */
function sdkVerzeichnis() {
  const kandidaten = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Library', 'Android', 'sdk') : null,
    process.env.HOME ? path.join(process.env.HOME, 'Android', 'Sdk') : null,
    'C:/Android',
  ].filter(Boolean);
  return kandidaten.find((dir) => fs.existsSync(path.join(dir, 'platform-tools'))) ?? null;
}

const withLocalProperties = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const ziel = path.join(cfg.modRequest.platformProjectRoot, 'local.properties');
      if (fs.existsSync(ziel)) return cfg;
      const sdk = sdkVerzeichnis();
      if (!sdk) {
        console.warn(
          'with-release-signing: kein Android-SDK gefunden — android/local.properties nicht geschrieben. ' +
            'Setze ANDROID_HOME, sonst scheitert Gradle mit "SDK location not found".',
        );
        return cfg;
      }
      // Gradle liest local.properties als Java-Properties: Backslashes muessen
      // verdoppelt werden, sonst wird `\A` als Escape gelesen.
      const wert = sdk.split('\\').join('\\\\');
      fs.writeFileSync(ziel, `sdk.dir=${wert}\n`, 'utf8');
      return cfg;
    },
  ]);

const withReleaseSigning = (config) =>
  withLocalProperties(
    withAppBuildGradle(config, (cfg) => {
      cfg.modResults.contents = patchAppBuildGradle(cfg.modResults.contents);
      return cfg;
    }),
  );

module.exports = withReleaseSigning;
module.exports.patchAppBuildGradle = patchAppBuildGradle;
module.exports.sdkVerzeichnis = sdkVerzeichnis;
