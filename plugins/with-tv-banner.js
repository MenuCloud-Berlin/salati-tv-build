// Config-Plugin: Leanback-Banner in der Aufloesung, die zur Bildschirmdichte passt.
//
// @react-native-tvos/config-tv kopiert die EINE Datei aus `androidTVBanner` in
// alle sechs drawable-Ordner (build/withTVAndroidBannerImage.js). Android liest
// eine Bitmap aber in der Dichte ihres Ordners: dieselben 320x180 px sind in
// drawable-xhdpi 320x180 dp, in drawable-xxxhdpi aber nur 80x45 dp. Auf einem
// 4K-Fernseher rechnet der Launcher die Kachel dann vierfach hoch, und sie steht
// verwaschen in der App-Reihe.
//
// Google Play hat am 2026-08-09 versionCode 12 unter anderem wegen der
// Banner-Pruefung (TV-BN) abgelehnt. Deshalb liegt hier je Ordner die richtige
// Datei — erzeugt von scripts/marken-assets.py.
//
// Das Plugin muss NACH dem config-tv-Plugin in app.config.js stehen: gefaehrliche
// Mods laufen in der Reihenfolge, in der sie angemeldet wurden, und diese hier
// ueberschreibt die Kopien.
const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

// Muss zu DICHTEN in scripts/marken-assets.py passen.
const DICHTEN = {
  'drawable-mdpi': { datei: 'banner-mdpi.png', w: 160, h: 90 },
  'drawable-hdpi': { datei: 'banner-hdpi.png', w: 240, h: 135 },
  'drawable-xhdpi': { datei: 'banner-xhdpi.png', w: 320, h: 180 },
  'drawable-xxhdpi': { datei: 'banner-xxhdpi.png', w: 480, h: 270 },
  'drawable-xxxhdpi': { datei: 'banner-xxxhdpi.png', w: 640, h: 360 },
};

/** Bildmasse aus dem PNG-Header — ohne Abhaengigkeit auf einen Bildleser. */
function masse(pfad) {
  const b = fs.readFileSync(pfad);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${pfad} ist kein PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

const withTvBanner = (config) =>
  withDangerousMod(config, [
    'android',
    (cfg) => {
      const assets = path.join(cfg.modRequest.projectRoot, 'assets');
      const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');

      for (const [ordner, { datei, w, h }] of Object.entries(DICHTEN)) {
        const quelle = path.join(assets, datei);
        if (!fs.existsSync(quelle)) {
          // Hart abbrechen: sonst bleibt die 320x180-Kopie des config-tv-Plugins
          // liegen und der Mangel faellt erst dem naechsten Play-Pruefer auf.
          throw new Error(
            `with-tv-banner: ${datei} fehlt. Erst \`python scripts/marken-assets.py\` laufen lassen.`,
          );
        }
        const m = masse(quelle);
        if (m.w !== w || m.h !== h) {
          throw new Error(`with-tv-banner: ${datei} ist ${m.w}x${m.h}, erwartet ${w}x${h}`);
        }
        const ziel = path.join(res, ordner);
        fs.mkdirSync(ziel, { recursive: true });
        fs.copyFileSync(quelle, path.join(ziel, 'tv_banner.png'));
      }
      return cfg;
    },
  ]);

module.exports = withTvBanner;
module.exports.DICHTEN = DICHTEN;
