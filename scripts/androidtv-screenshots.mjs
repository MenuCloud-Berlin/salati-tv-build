#!/usr/bin/env node
// Nimmt die Play-Store-Bildschirmfotos im Android-TV-Emulator auf.
//
// Warum nicht die Apple-TV-Bilder wiederverwenden: es ist dieselbe App, aber
// nicht dieselbe Plattform. Wer im Play Store steht, soll Android sehen.
//
// Gesteuert wird ueber Deep Links (`salatitv://screen/<name>`, s. lib/nav.ts).
// Anders als Apple TV fragt Android dabei nicht zurueck, ein Startargument
// braucht es hier also nicht.
//
// Die Sprache wird JE APP gesetzt (`cmd locale set-app-locales`, ab Android 13)
// statt am ganzen Geraet: das spart je Sprache einen Neustart des Emulators.
//
// Usage:
//   node scripts/androidtv-screenshots.mjs --apk <pfad> [--sprachen "de en tr ar"]
//   node scripts/androidtv-screenshots.mjs --sprachen de        (App schon installiert)
import fs from 'fs';
import path from 'path';
import { execFileSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(HIER, '..');
const PAKET = 'de.salatibox.tv';
const AVD = 'salati_tv';

const SDK = ['C:/Android/Sdk', 'C:/Android', process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]
  .filter(Boolean)
  .find((d) => fs.existsSync(path.join(d, 'platform-tools', 'adb.exe')));
if (!SDK) throw new Error('Kein Android-SDK mit platform-tools gefunden');
const ADB = path.join(SDK, 'platform-tools', 'adb.exe');
const EMULATOR = ['C:/Android/emulator/emulator.exe', path.join(SDK, 'emulator', 'emulator.exe')].find((p) =>
  fs.existsSync(p),
);

// Reihenfolge und Wartezeiten wie bei Apple TV (scripts/tvos-screenshots.sh);
// hier ohne Kaltstart je Bild, weil kein Startargument noetig ist.
const AUFNAHMEN = [
  ['clock', 6],
  ['home', 5],
  ['quran', 9],
  ['reciters', 9],
  ['radio', 9],
  ['videos', 9],
  ['quiz', 6],
  ['settings', 5],
];

const GEBIET = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', ar: 'ar-SA' };

const arg = (name, vorgabe) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : vorgabe;
};
const APK = arg('apk', null);
const SPRACHEN = arg('sprachen', 'de en tr ar').split(/\s+/).filter(Boolean);

const adb = (...args) =>
  execFileSync(ADB, ['-s', geraet, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const schlaf = (s) => new Promise((r) => setTimeout(r, s * 1000));

// ── Emulator ────────────────────────────────────────────────────────────────
let geraet = null;
function laufende() {
  return execFileSync(ADB, ['devices'], { encoding: 'utf8' })
    .split('\n')
    .slice(1)
    .filter((z) => z.includes('\tdevice'))
    .map((z) => z.split('\t')[0]);
}

/** Name des AVD hinter einer Seriennummer, oder null. */
function avdName(serie) {
  try {
    return execFileSync(ADB, ['-s', serie, 'emu', 'avd', 'name'], { encoding: 'utf8' }).split('\n')[0].trim();
  } catch {
    return null;
  }
}

// Das RICHTIGE Geraet suchen, nicht das erste. Am 2026-08-11 lief nebenher ein
// Telefon-Emulator, und der Lauf lieferte acht Bilder in 1284x2778 — Play haette
// sie als TV-Bilder abgelehnt, und aufgefallen waere es erst dort.
const vorher = laufende().filter((s) => avdName(s) === AVD);
if (vorher.length) {
  geraet = vorher[0];
  console.log(`Emulator ${AVD} laeuft schon: ${geraet}`);
} else {
  if (!EMULATOR) throw new Error('emulator.exe nicht gefunden');
  console.log(`Starte Emulator ${AVD} …`);
  spawn(EMULATOR, ['-avd', AVD, '-no-audio', '-no-boot-anim', '-no-snapshot'], {
    detached: true,
    stdio: 'ignore',
  }).unref();
  for (let i = 0; i < 90 && !geraet; i++) {
    await schlaf(5);
    geraet = laufende().find((s) => avdName(s) === AVD) ?? null;
  }
  if (!geraet) throw new Error('Emulator ist nicht hochgekommen');
}

// Warten, bis das System wirklich fertig ist — ein zu frueher `am start`
// landet im Leeren.
for (let i = 0; i < 90; i++) {
  try {
    if (adb('shell', 'getprop', 'sys.boot_completed').trim() === '1') break;
  } catch {
    /* noch nicht ansprechbar */
  }
  await schlaf(5);
}
console.log(`Geraet bereit: ${geraet} (${adb('shell', 'getprop', 'ro.build.version.release').trim()})`);

if (APK) {
  console.log(`Installiere ${APK} …`);
  try {
    adb('uninstall', PAKET);
  } catch {
    /* war nicht installiert */
  }
  console.log(execFileSync(ADB, ['-s', geraet, 'install', '-r', '-t', APK], { encoding: 'utf8' }).trim());
}

// ── Aufnehmen ───────────────────────────────────────────────────────────────
for (const sprache of SPRACHEN) {
  const ordner = path.join(TV, 'screenshots', 'androidtv', sprache);
  fs.mkdirSync(ordner, { recursive: true });

  adb('shell', 'cmd', 'locale', 'set-app-locales', PAKET, '--locales', GEBIET[sprache] ?? sprache);
  adb('shell', 'am', 'force-stop', PAKET);
  await schlaf(2);

  let nr = 0;
  for (const [screen, warten] of AUFNAHMEN) {
    nr += 1;
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `salatitv://screen/${screen}`, PAKET);
    await schlaf(warten);
    const roh = execFileSync(ADB, ['-s', geraet, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
    const datei = path.join(ordner, `${String(nr).padStart(2, '0')}-${screen}.png`);
    fs.writeFileSync(datei, roh);
    const kopf = roh.subarray(16, 24);
    console.log(`${sprache} ${String(nr).padStart(2, '0')} ${screen} -> ${kopf.readUInt32BE(0)}x${kopf.readUInt32BE(4)}`);
  }
}

console.log(`\nFertig. Bilder unter ${path.join(TV, 'screenshots', 'androidtv')}`);
