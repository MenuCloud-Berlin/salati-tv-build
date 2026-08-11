// Tauscht NUR die Marken-Grafiken des Play-Eintrags aus (Symbol, Feature-Grafik,
// TV-Banner) — in allen vier Listing-Sprachen.
//
// Anlass: Google hat vc12 abgelehnt, weil das Symbol die Kachel nicht ausfuellt.
// Die Grafiken kommen seit 1.8.1 aus scripts/marken-assets.py; sie muessen aber
// auch im Store getauscht werden, sonst zeigt die Eintragsseite weiter das alte
// Bild und der naechste Pruefer sieht denselben Mangel.
//
// Warum nicht `play-upload.mjs`: das schreibt zusaetzlich die Listing-TEXTE
// (nur en-US, aus einer Konstante im Skript statt aus store/listing/) und laedt
// eine Binaerdatei hoch. Beides hat hier nichts zu suchen.
//
//   node scripts/play-grafiken.mjs           (hochladen)
//   node scripts/play-grafiken.mjs --pruefen (nur nachsehen, was oben liegt)
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

/** Play prueft die Masse hart; ein falsch skaliertes Bild faellt sonst erst in
 *  der Console auf. */
const GRAFIKEN = [
  { typ: 'icon', datei: 'assets/icon-512.png', w: 512, h: 512 },
  { typ: 'featureGraphic', datei: 'assets/feature-graphic-1024x500.png', w: 1024, h: 500 },
  { typ: 'tvBanner', datei: 'assets/store-banner-1280x720.png', w: 1280, h: 720 },
];

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

/** Bildmasse aus dem PNG-Header. */
function masse(datei) {
  const b = fs.readFileSync(datei);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${datei} ist kein PNG`);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

TOK = await token();
console.log('auth ok');

for (const g of GRAFIKEN) {
  g.pfad = path.join(TV, g.datei);
  if (!fs.existsSync(g.pfad)) throw new Error(`Grafik fehlt: ${g.pfad} (erst scripts/marken-assets.py laufen lassen)`);
  const { w, h } = masse(g.pfad);
  if (w !== g.w || h !== g.h) throw new Error(`${g.datei} ist ${w}x${h}, erwartet ${g.w}x${g.h}`);
  console.log(`  ${g.typ.padEnd(15)} ${g.datei} ${w}x${h} ok`);
}

const edit = await api(`${BASE}/edits`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
if (!edit.ok) throw new Error('edit: ' + edit.status + ' ' + JSON.stringify(edit.j));
const id = edit.j.id;
console.log('edit', id);

if (process.argv.includes('--pruefen')) {
  for (const lang of SPRACHEN) {
    const teile = [];
    for (const g of GRAFIKEN) {
      const r = await api(`${BASE}/edits/${id}/listings/${lang}/${g.typ}`);
      const bilder = r.ok ? (r.j.images ?? []) : null;
      teile.push(`${g.typ}=${bilder ? bilder.map((b) => b.sha256?.slice(0, 8) ?? b.id).join(',') || 'keine' : 'HTTP ' + r.status}`);
    }
    console.log(`  ${lang}: ${teile.join('  ')}`);
  }
  await api(`${BASE}/edits/${id}`, { method: 'DELETE' });
  process.exit(0);
}

for (const lang of SPRACHEN) {
  const teile = [];
  for (const g of GRAFIKEN) {
    // Erst entfernen: sonst liegt das neue Bild neben dem alten und Play zeigt
    // weiter das erste.
    const del = await api(`${BASE}/edits/${id}/listings/${lang}/${g.typ}`, { method: 'DELETE' });
    if (!del.ok && del.status !== 404) console.log(`  ${lang} ${g.typ} loeschen: HTTP ${del.status}`);
    const u = await api(`${UP}/edits/${id}/listings/${lang}/${g.typ}?uploadType=media`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: fs.readFileSync(g.pfad),
    });
    teile.push(`${g.typ}: ${u.ok ? 'OK' : 'FEHLER ' + u.status + ' ' + JSON.stringify(u.j).slice(0, 160)}`);
  }
  console.log(`  ${lang}  ${teile.join('  ')}`);
}

// Solange eine Ablehnung offen ist, weist Play einen Commit ab, der die
// Aenderung gleich zur Pruefung schicken will ("Changes cannot be sent for
// review automatically"). Dann committen wir ohne Pruefungsanstoss — die
// Grafiken liegen danach im Entwurf und gehen mit der naechsten Einreichung
// aus der Console mit.
let commit = await api(`${BASE}/edits/${id}:commit`, { method: 'POST' });
let manuell = false;
if (!commit.ok && JSON.stringify(commit.j ?? '').includes('changesNotSentForReview')) {
  commit = await api(`${BASE}/edits/${id}:commit?changesNotSentForReview=true`, { method: 'POST' });
  manuell = commit.ok;
}
console.log('COMMIT:', commit.ok ? 'OK' : 'FEHLER ' + commit.status + ' ' + JSON.stringify(commit.j).slice(0, 400));
if (manuell) {
  console.log('HINWEIS: nicht zur Pruefung geschickt. In der Play Console unter');
  console.log('         „Veroeffentlichungsuebersicht" die Aenderungen einreichen.');
}
if (!commit.ok) process.exitCode = 1;
