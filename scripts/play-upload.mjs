// Salati TV → Play Console via Google Play Developer API (Service-Account),
// umgeht den nativen Datei-Dialog-Blocker. Phase A: Listing + Grafiken (commit).
// Phase B: APK → Internal-Track (commit). Content-Rating/Datensicherheit gehen
// NICHT per API — die bleiben in der Console.
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';
const TV = 'C:/Users/domen/Documents/SalatiTech/apps/tv';
const APK = 'C:/Users/domen/AppData/Local/Temp/claude/C--Users-domen-Documents-SalatiTech/9081dad2-7d18-4f23-b8b0-9d0a2da03c6f/scratchpad/salati-tv-fixed.apk';

const TITLE = 'Salati TV';
const SHORT = 'Prayer times, Quran reciters, radio, videos & quiz on the big screen.';
const FULL = `Salati TV brings prayer times and the Quran to your Android TV or Google TV — calm, beautiful and ad-free.

PRAYER CLOCK
• A large, easy-to-read clock with the five daily prayer times and a countdown to the next prayer
• Calculated fully on-device (no internet needed for the times)
• Choose your city, calculation method and madhab

QURAN
• Choose from many reciters with complete surahs
• Quran radio: 24/7 stations right on your TV
• A calm, beautiful presentation for the living room

LEARN
• Learning videos on Quranic Arabic and grammar
• Podcast episodes to listen to
• Short reels
• A knowledge quiz — play with the remote or as a second-screen game on your phone

CONNECT YOUR PHONE
• Pair the Salati phone app with the TV via QR code (same Wi-Fi)
• Control the TV comfortably from your phone
• Answer the quiz on your phone while the question shows on the TV
• No cloud, no sign-in — the connection stays local in your Wi-Fi

Salati TV is the TV companion to the Salati app: free, no ads, no tracking.`;

const IMAGES = {
  icon: [`${TV}/assets/icon-512.png`],
  featureGraphic: [`${TV}/assets/feature-graphic-1024x500.png`],
  tvBanner: [`${TV}/assets/store-banner-1280x720.png`],
  tvScreenshots: [
    `${TV}/screenshots/01-clock.png`,
    `${TV}/screenshots/02-home.png`,
    `${TV}/screenshots/04-reciters.png`,
    `${TV}/screenshots/05-quiz.png`,
    `${TV}/screenshots/06-pairing.png`,
  ],
};

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
async function token() {
  const now = Math.floor(Date.now() / 1000);
  const assertion = jwt.sign(
    { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
    sa.private_key, { algorithm: 'RS256' });
  const r = await (await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })).json();
  if (!r.access_token) throw new Error('token failed: ' + JSON.stringify(r));
  return r.access_token;
}

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
const UP = `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}`;
let TOK;
async function api(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { Authorization: `Bearer ${TOK}`, ...(opts.headers || {}) } });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch { j = { raw: t }; }
  return { ok: r.ok, status: r.status, j };
}

async function run() {
  TOK = await token();
  console.log('auth ok');

  // ---- Phase A: Listing + Grafiken ----
  let e = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!e.ok) throw new Error('edit A: ' + e.status + ' ' + JSON.stringify(e.j));
  const editA = e.j.id;
  console.log('edit A', editA);

  const lst = await api(`${BASE}/edits/${editA}/listings/en-US`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language: 'en-US', title: TITLE, shortDescription: SHORT, fullDescription: FULL }),
  });
  console.log('listing:', lst.ok ? 'OK' : 'FEHLER ' + lst.status + ' ' + JSON.stringify(lst.j).slice(0, 300));

  for (const [type, files] of Object.entries(IMAGES)) {
    // vorhandene dieses Typs entfernen (sauberer Satz, keine Dubletten bei Screenshots)
    const del = await api(`${BASE}/edits/${editA}/listings/en-US/${type}`, { method: 'DELETE' });
    if (!del.ok && del.status !== 404) console.log(`  deleteall ${type}: ${del.status}`);
    for (const f of files) {
      const bytes = fs.readFileSync(f);
      const u = await api(`${UP}/edits/${editA}/listings/en-US/${type}?uploadType=media`, {
        method: 'POST', headers: { 'Content-Type': 'image/png' }, body: bytes,
      });
      console.log(`  img ${type} ${f.split('/').pop()}: ${u.ok ? 'OK' : 'FEHLER ' + u.status + ' ' + JSON.stringify(u.j).slice(0, 200)}`);
    }
  }

  const cA = await api(`${BASE}/edits/${editA}:commit`, { method: 'POST' });
  console.log('COMMIT A (Listing+Grafiken):', cA.ok ? 'OK ✓' : 'FEHLER ' + cA.status + ' ' + JSON.stringify(cA.j).slice(0, 400));

  // ---- Phase B: APK → Internal-Track ----
  e = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!e.ok) throw new Error('edit B: ' + e.status + ' ' + JSON.stringify(e.j));
  const editB = e.j.id;
  console.log('edit B', editB);

  const apkBytes = fs.readFileSync(APK);
  console.log('APK-Upload', (apkBytes.length / 1e6).toFixed(1), 'MB ...');
  const up = await api(`${UP}/edits/${editB}/apks?uploadType=media`, {
    method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: apkBytes,
  });
  if (!up.ok) {
    console.log('APK-Upload FEHLER:', up.status, JSON.stringify(up.j).slice(0, 500));
    console.log('(Falls „App Bundle erforderlich": AAB nötig statt APK.)');
    return;
  }
  const vc = up.j.versionCode;
  console.log('APK OK, versionCode', vc);

  const tr = await api(`${BASE}/edits/${editB}/tracks/internal`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ track: 'internal', releases: [{ status: 'draft', versionCodes: [String(vc)] }] }),
  });
  console.log('Track internal (draft):', tr.ok ? 'OK' : 'FEHLER ' + tr.status + ' ' + JSON.stringify(tr.j).slice(0, 300));

  const cB = await api(`${BASE}/edits/${editB}:commit`, { method: 'POST' });
  console.log('COMMIT B (APK+Track):', cB.ok ? 'OK ✓' : 'FEHLER ' + cB.status + ' ' + JSON.stringify(cB.j).slice(0, 500));
}
run().catch((e) => { console.error('ABBRUCH:', e.message); process.exit(1); });
