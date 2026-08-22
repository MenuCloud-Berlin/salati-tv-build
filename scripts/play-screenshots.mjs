// Tauscht NUR die TV-Screenshots des Play-Eintrags aus — in allen vier
// Listing-Sprachen.
//
// Warum ein eigenes Skript und nicht `play-upload.mjs`: das macht Listing,
// Grafiken UND einen APK-Upload in einem Lauf. Nach einem Release ist die
// Binaerdatei schon oben (play-aab-upload.mjs); denselben Lauf noch einmal
// anzustossen, nur um Bilder zu tauschen, hiesse einen zweiten Weg zur
// Auslieferung zu oeffnen. Dieses Skript fasst die Binaerdatei nicht an.
//
// Ausserdem bediente `play-upload.mjs` nur `en-US`. Der Eintrag hat vier
// Sprachen; die anderen drei behielten dadurch die alten Bilder — auf
// Deutsch also weiter die Oberflaeche vor dem Umbau.
//
//   node scripts/play-screenshots.mjs           (hochladen)
//   node scripts/play-screenshots.mjs --pruefen (nur nachsehen, was oben liegt)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const HIER = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(HIER, '..');
const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

/** Die vier Sprachen des Eintrags (s. scripts/play-listings.mjs). */
const SPRACHEN = ['de-DE', 'en-US', 'tr-TR', 'ar'];

/**
 * Reihenfolge = Reihenfolge im Store: erst die Uhr (das, wofuer die App laeuft),
 * dann der Einstieg, dann Koran, Rezitatoren, Radio, Videos, Quiz und die
 * Einstellungen.
 *
 * Die Bilder liegen JE SPRACHE vor und tragen eine Bildunterschrift. Bis zum
 * 2026-08-11 bekamen alle vier Sprachen dieselben sieben englischen Aufnahmen
 * aus 1.4.0 (versionCode 8): auf der deutschen Store-Seite stand also eine
 * englische Oberflaeche, und die war ausserdem vier Versionen alt.
 *
 * Erzeugt von:
 *   node scripts/androidtv-screenshots.mjs --apk <apk>   (Android-TV-Emulator)
 *   python scripts/store-bilder.py --quelle screenshots/androidtv  *          --ziel screenshots/store/androidtv               (Bildunterschriften)
 */
const REIHENFOLGE = [
  '01-clock.png',
  '02-home.png',
  '03-quran.png',
  '04-reciters.png',
  '05-radio.png',
  '06-videos.png',
  '07-quiz.png',
  '08-settings.png',
];

/** ASC-Sprachcode des Eintrags -> Ordner unter screenshots/store/androidtv/. */
const ORDNER = { 'de-DE': 'de', 'en-US': 'en', 'tr-TR': 'tr', ar: 'ar' };

const bilderFuer = (lang) =>
  REIHENFOLGE.map((n) => path.join(TV, 'screenshots', 'store', 'androidtv', ORDNER[lang], n));

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: 'RS256' },
  );
  const r = await (
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
  ).json();
  if (!r.access_token) throw new Error('token failed: ' + JSON.stringify(r));
  return r.access_token;
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UP = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
let TOK;
async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } });
  const t = await r.text();
  let j = null;
  try {
    j = t ? JSON.parse(t) : null;
  } catch {
    j = { raw: t };
  }
  return { ok: r.ok, status: r.status, j };
}

/** Bildmasse aus dem PNG-Header — Play lehnt abweichende Groessen ab, und ein
 *  falsch skaliertes Bild faellt sonst erst in der Console auf. */
function masse(datei) {
  const b = fs.readFileSync(datei);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${datei} ist kein PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length };
}

TOK = await token();
console.log('auth ok');

for (const lang of SPRACHEN) {
  for (const datei of bilderFuer(lang)) {
    if (!fs.existsSync(datei)) throw new Error(`Screenshot fehlt: ${datei}`);
    const { w, h } = masse(datei);
    if (w !== 1920 || h !== 1080) throw new Error(`${datei} ist ${w}x${h}, erwartet 1920x1080`);
  }
}
console.log(`${SPRACHEN.length} Sprachen x ${REIHENFOLGE.length} Bilder geprueft: alle 1920x1080`);

const edit = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
if (!edit.ok) throw new Error('edit: ' + edit.status + ' ' + JSON.stringify(edit.j));
const id = edit.j.id;
console.log('edit', id);

if (process.argv.includes('--pruefen')) {
  for (const lang of SPRACHEN) {
    const r = await api(`${BASE}/edits/${id}/listings/${lang}/tvScreenshots`);
    console.log(`  ${lang}: ${r.ok ? (r.j.images ?? []).length + ' Bilder' : 'HTTP ' + r.status}`);
  }
  await api(`${BASE}/edits/${id}`, { method: 'DELETE' });
  process.exit(0);
}

for (const lang of SPRACHEN) {
  // Erst alle entfernen: sonst haengen die neuen HINTER den alten, und der
  // Store zeigt weiter zuerst die Oberflaeche von 1.0.3.
  const del = await api(`${BASE}/edits/${id}/listings/${lang}/tvScreenshots`, { method: 'DELETE' });
  if (!del.ok && del.status !== 404) console.log(`  ${lang} loeschen: HTTP ${del.status}`);
  const bilder = bilderFuer(lang);
  let hoch = 0;
  for (const datei of bilder) {
    const u = await api(`${UP}/edits/${id}/listings/${lang}/tvScreenshots?uploadType=media`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: fs.readFileSync(datei),
    });
    if (u.ok) hoch++;
    else console.log(`  ${lang} ${path.basename(datei)}: FEHLER ${u.status} ${JSON.stringify(u.j).slice(0, 200)}`);
  }
  console.log(`  ${lang}: ${hoch}/${bilder.length} hochgeladen`);
}

const commit = await api(`${BASE}/edits/${id}:commit`, { method: 'POST' });
console.log('COMMIT:', commit.ok ? 'OK' : 'FEHLER ' + commit.status + ' ' + JSON.stringify(commit.j).slice(0, 400));
if (!commit.ok) process.exitCode = 1;
