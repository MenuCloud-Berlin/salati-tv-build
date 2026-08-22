// Liest den Play-Zustand von Salati TV zurueck — Bundles und beide Tracks.
//
// Gegenstueck zu play-aab-upload.mjs: was dieses Skript meldet, kommt von
// Google, nicht aus dem Upload-Protokoll. Ein "OK" beim Hochladen sagt nichts
// darueber, was im Produktions-Track tatsaechlich steht — bis 1.2.0 hob das
// Upload-Skript nur `internal`, und das fiel erst beim Nachsehen auf.
//
//   node scripts/play-status.mjs
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
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
const tokenAntwort = await (
  await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
).json();
if (!tokenAntwort.access_token) throw new Error('Anmeldung fehlgeschlagen: ' + JSON.stringify(tokenAntwort));
const TOK = tokenAntwort.access_token;

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
async function api(url) {
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOK}` } });
  const t = await r.text();
  if (!r.ok) throw new Error(`${url} -> ${r.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}

// Ein Edit ist auch zum reinen Lesen noetig; er wird nicht committet und
// verfaellt von selbst.
const edit = await (
  await fetch(`${BASE}/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOK}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
).json();
if (!edit.id) throw new Error('Edit fehlgeschlagen: ' + JSON.stringify(edit));

const bundles = await api(`${BASE}/edits/${edit.id}/bundles`);
console.log('Bundles:', (bundles.bundles ?? []).map((b) => b.versionCode).join(', ') || '—');

const tracks = await api(`${BASE}/edits/${edit.id}/tracks`);
for (const t of tracks.tracks ?? []) {
  for (const r of t.releases ?? []) {
    const sprachen = (r.releaseNotes ?? []).map((n) => n.language).join('/') || 'keine Notizen';
    console.log(
      `  ${t.track.padEnd(12)} ${String(r.status).padEnd(10)} vc ${(r.versionCodes ?? ['—']).join(',')}  ${r.name ?? ''}  ${sprachen}`,
    );
  }
}
