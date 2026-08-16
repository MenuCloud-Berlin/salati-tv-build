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

// Tastencodes der Fernbedienung.
const K = { hoch: 19, runter: 20, links: 21, rechts: 22, ok: 23 };

// Reihenfolge und Wartezeiten wie bei Apple TV (scripts/tvos-screenshots.sh);
// hier ohne Kaltstart je Bild, weil kein Startargument noetig ist.
//
// `tasten` fuehrt nach dem Deep Link noch ein Stueck weiter. Zwei Bilder
// brauchen das (Befund 2026-08-16 beim Nachsehen der Store-Seite):
//
//   • „quran" zeigte die SURENLISTE. Die Unterschrift verspricht „Den Koran am
//     Fernseher lesen" — eine Liste von Namen zeigt davon nichts. Jetzt wird
//     eine Sure geoeffnet und die Rezitation angehalten, damit das Bild den
//     Vers mit Umschrift und Uebersetzung zeigt.
//   • „settings" zeigte die SPRACHWAHL, waehrend die Unterschrift von
//     23 Berechnungsmethoden und Madhab sprach. Bild und Text sagten
//     Verschiedenes. Jetzt oeffnet es den Bereich Gebetszeiten.
//
// Je Eintrag: [Bildschirm, Sekunden nach dem Deep Link, Tasten, Sekunden danach]
const AUFNAHMEN = [
  ['pairing', 7],
  ['clock', 6],
  ['home', 5],
  // runter + 3x rechts = Sure 4 (An-Nisaa); ihr erster Vers ist lang genug,
  // dass Vers, Umschrift und Uebersetzung zusammen zu sehen sind. Das zweite
  // OK haelt die Rezitation an, sonst waere der Vers beim Ausloesen schon
  // weitergelaufen.
  ['quran', 6, [K.runter, K.rechts, K.rechts, K.rechts, K.ok], 13, [K.ok], 2],
  ['reciters', 9],
  ['radio', 9],
  ['videos', 9],
  ['quiz', 6],
  // 2x runter = Gebetszeiten, OK oeffnet den Bereich.
  ['settings', 5, [K.runter, K.runter, K.ok], 3],
];

const GEBIET = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', ar: 'ar-SA' };

/**
 * Sprachen, deren Oberflaeche von rechts nach links laeuft.
 *
 * Fuer sie muessen die Richtungstasten GESPIEGELT werden: die Raster stehen auf
 * `row-reverse`, „rechts" bewegt den Fokus also nach links. Ohne die Spiegelung
 * lief die Automatik in der arabischen Fassung gegen den Rand und nahm Sure 1
 * statt Sure 4 auf (Befund 2026-08-16 — das Bild sah plausibel aus, zeigte aber
 * den falschen Vers).
 */
const RTL = new Set(['ar', 'ur', 'fa', 'ps']);
const spiegeln = (taste, sprache) => {
  if (!RTL.has(sprache)) return taste;
  if (taste === K.rechts) return K.links;
  if (taste === K.links) return K.rechts;
  return taste;
};

const arg = (name, vorgabe) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : vorgabe;
};
const APK = arg('apk', null);
const SPRACHEN = arg('sprachen', 'de en tr ar').split(/\s+/).filter(Boolean);
// `--screens pairing` nimmt nur einzelne Bildschirme auf, ohne den ganzen Satz
// neu zu machen: die Webseite zeigt einen anderen Ausschnitt als die Store-Seite.
const NUR = arg('screens', '').split(/\s+/).filter(Boolean);

// Ohne Auswahl der Store-Satz: acht Bildschirme, durchnummeriert ab 01. Der
// Kopplungs-Bildschirm bleibt draussen, weil Play nur acht TV-Bilder nimmt und
// er von den acht der schwaechste ist (ein QR-Code sagt im Store wenig).
const gewaehlt = AUFNAHMEN.filter(([screen]) =>
  NUR.length ? NUR.includes(screen) : screen !== 'pairing',
);
if (!gewaehlt.length) throw new Error(`Keine bekannten Bildschirme in --screens "${NUR.join(' ')}"`);

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

/**
 * Name des AVD hinter einer Seriennummer, oder null.
 *
 * MIT ZEITGRENZE: laeuft nebenher ein FREMDER Emulator, dessen Konsole nicht
 * mehr antwortet, blockiert `adb emu avd name` ohne Grenze — und damit den
 * ganzen Lauf, noch bevor die erste Zeile ausgegeben ist (2026-08-16, vier
 * Emulatoren auf der Maschine). Wer nicht binnen zehn Sekunden antwortet, ist
 * nicht der gesuchte.
 */
function avdName(serie) {
  try {
    return execFileSync(ADB, ['-s', serie, 'emu', 'avd', 'name'], {
      encoding: 'utf8',
      timeout: 10_000,
    })
      .split('\n')[0]
      .trim();
  } catch {
    return null;
  }
}

// Das RICHTIGE Geraet suchen, nicht das erste. Am 2026-08-11 lief nebenher ein
// Telefon-Emulator, und der Lauf lieferte acht Bilder in 1284x2778 — Play haette
// sie als TV-Bilder abgelehnt, und aufgefallen waere es erst dort.
// `--geraet emulator-5584` ueberspringt die Suche ganz. Auf einer Maschine mit
// mehreren Emulatoren ist das der sichere Weg — und der schnelle.
const GEWAEHLT = arg('geraet', null);
const vorher = GEWAEHLT
  ? laufende().filter((s) => s === GEWAEHLT)
  : laufende().filter((s) => avdName(s) === AVD);
if (vorher.length) {
  geraet = vorher[0];
  console.log(`Emulator ${GEWAEHLT ?? AVD} laeuft schon: ${geraet}`);
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
  for (const [screen, warten, tasten1, warten1, tasten2, warten2] of gewaehlt) {
    nr += 1;
    adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', `salatitv://screen/${screen}`, PAKET);
    await schlaf(warten);
    // Weiter in den Bildschirm hinein, wo der Deep Link nur bis zur Auswahl
    // fuehrt. Einzeln gesendet mit Pause: eine Folge in EINEM `input keyevent`
    // kommt schneller, als die Oberflaeche den Fokus nachzieht, und ein Teil
    // der Tastendruecke geht verloren (am Geraet gemessen).
    for (const [folge, danach] of [
      [tasten1, warten1],
      [tasten2, warten2],
    ]) {
      if (!folge) continue;
      for (const taste of folge) {
        adb('shell', 'input', 'keyevent', String(spiegeln(taste, sprache)));
        await schlaf(0.5);
      }
      await schlaf(danach ?? 2);
    }
    const roh = execFileSync(ADB, ['-s', geraet, 'exec-out', 'screencap', '-p'], { maxBuffer: 64 * 1024 * 1024 });
    const datei = path.join(ordner, `${String(nr).padStart(2, '0')}-${screen}.png`);
    fs.writeFileSync(datei, roh);
    const kopf = roh.subarray(16, 24);
    console.log(`${sprache} ${String(nr).padStart(2, '0')} ${screen} -> ${kopf.readUInt32BE(0)}x${kopf.readUInt32BE(4)}`);
  }
}

console.log(`\nFertig. Bilder unter ${path.join(TV, 'screenshots', 'androidtv')}`);
