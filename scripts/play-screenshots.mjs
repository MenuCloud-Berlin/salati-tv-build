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
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';

/** Die vier Sprachen des Eintrags (s. scripts/play-listings.mjs). */
const SPRACHEN = ['de-DE', 'en-US', 'tr-TR', 'ar'];

/**
 * Reihenfolge = Reihenfolge im Store. Erst die Uhr (das, wofuer die App laeuft),
 * dann der Koran-Leser, dann der Einstieg; die Schriftauswahl an vierter Stelle,
 * weil sie die auffaelligste Neuerung von 1.4.0 ist und auf einem Standbild
 * sofort zu erkennen.
 *
 * Aufgenommen am 2026-08-08 aus der ausgelieferten 1.4.0 (versionCode 8) am
 * Android-TV-Emulator, 1920x1080.
 */
const SHOTS = [
  '10-clock.png',
  '11-quran.png',
  '12-home.png',
  '13-settings.png',
  '14-reciters.png',
  '15-quiz.png',
  '16-pairing.png',
].map((n) => path.join(TV, 'screenshots', n));

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

for (const datei of SHOTS) {
  if (!fs.existsSync(datei)) throw new Error(`Screenshot fehlt: ${datei}`);
  const { w, h } = masse(datei);
  if (w !== 1920 || h !== 1080) throw new Error(`${path.basename(datei)} ist ${w}x${h}, erwartet 1920x1080`);
}
console.log(`${SHOTS.length} Screenshots geprueft: alle 1920x1080`);

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
  let hoch = 0;
  for (const datei of SHOTS) {
    const u = await api(`${UP}/edits/${id}/listings/${lang}/tvScreenshots?uploadType=media`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: fs.readFileSync(datei),
    });
    if (u.ok) hoch++;
    else console.log(`  ${lang} ${path.basename(datei)}: FEHLER ${u.status} ${JSON.stringify(u.j).slice(0, 200)}`);
  }
  console.log(`  ${lang}: ${hoch}/${SHOTS.length} hochgeladen`);
}

const commit = await api(`${BASE}/edits/${id}:commit`, { method: 'POST' });
console.log('COMMIT:', commit.ok ? 'OK' : 'FEHLER ' + commit.status + ' ' + JSON.stringify(commit.j).slice(0, 400));
if (!commit.ok) process.exitCode = 1;
