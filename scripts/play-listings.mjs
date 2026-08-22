#!/usr/bin/env node
// Schreibt die Salati-TV-Store-Texte in die Play Console. Nur Texte, die
// Grafiken bleiben unangetastet (die pflegt scripts/play-screenshots.mjs).
//
// Die Texte kommen aus store/texte/ — derselben Quelle wie die App-Store-Seite
// (scripts/lib/store-texte.mjs). Bis zum 2026-08-11 lagen sie getrennt in
// store/listing/*.md, und genau das ging schief: die Play-Beschreibung war vier
// Versionen alt, waehrend die Handy- und App-Store-Texte gepflegt wurden.
//
// Usage:
//   node scripts/play-listings.mjs --dry
//   node scripts/play-listings.mjs
import fs from 'fs';
import { createRequire } from 'module';
import { texteFuer } from './lib/store-texte.mjs';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/90_Werkstatt/menucloud-mobile-build/play-service-account.json';
const DRY = process.argv.includes('--dry');

const parsed = {};
for (const t of texteFuer('play')) {
  // Laengen prueft `texteFuer` bereits und bricht sonst ab; hier nur der Beleg.
  console.log(
    `${t.playLocale.padEnd(6)} Titel ${t.titelPlay.length}/30  Kurz ${t.kurz.length}/80  Voll ${t.description.length}/4000`,
  );
  parsed[t.playLocale] = { title: t.titelPlay, short: t.kurz, full: t.description };
}
if (DRY) process.exit(0);

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'));
const now = Math.floor(Date.now() / 1000);
const assertion = jwt.sign(
  { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 },
  sa.private_key,
  { algorithm: 'RS256' },
);
const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
})).json();
const ACCESS = tok.access_token;
if (!ACCESS) { console.error('Token fehlgeschlagen', tok); process.exit(1); }

const BASE = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
async function api(p, opts = {}) {
  const r = await fetch(BASE + p, { ...opts, headers: { Authorization: `Bearer ${ACCESS}`, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) };
}

const edit = await api('/edits', { method: 'POST', body: '{}' });
if (!edit.ok) { console.error('Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json).slice(0, 300)); process.exit(1); }
const editId = edit.json.id;

for (const [locale, { title, short, full }] of Object.entries(parsed)) {
  const r = await api(`/edits/${editId}/listings/${locale}`, {
    method: 'PUT',
    body: JSON.stringify({ language: locale, title, shortDescription: short, fullDescription: full }),
  });
  console.log(`Listing ${locale}:`, r.ok ? 'OK' : `${r.status} ${JSON.stringify(r.json?.error?.message ?? '').slice(0, 160)}`);
  if (!r.ok) process.exit(1);
}

const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
console.log('Commit:', commit.ok ? 'OK' : `${commit.status} ${JSON.stringify(commit.json).slice(0, 300)}`);
if (!commit.ok) process.exit(1);
