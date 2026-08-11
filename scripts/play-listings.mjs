#!/usr/bin/env node
// Schreibt die Salati-TV-Store-Texte aus store/listing/*.md in die Play Console.
// Nur Texte — Grafiken bleiben unangetastet (die liegen bereits im Eintrag und
// werden von scripts/play-upload.mjs gepflegt).
//
// Usage:
//   node scripts/play-listings.mjs --dry
//   node scripts/play-listings.mjs
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

const PACKAGE = 'de.salatibox.tv';
const SA_PATH = 'C:/Users/domen/Documents/menucloud-mobile-build/play-service-account.json';
const DIR = path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..', 'store', 'listing');
const DRY = process.argv.includes('--dry');
// de-DE fehlte im Eintrag komplett, obwohl die App deutschsprachig startet —
// ein Store-Eintrag nur auf Englisch kostet Sichtbarkeit im Hauptmarkt.
const LOCALES = { de: 'de-DE', en: 'en-US', tr: 'tr-TR', ar: 'ar' };

/** Parst title/short/full aus einer store/listing/*.md (Muster: apps/mobile). */
function parseListing(rohMd) {
  const md = rohMd.replace(/\r\n/g, '\n');
  const title = /^#\s+(.+)$/m.exec(md)?.[1]?.trim();
  const sections = md.split(/^##\s+/m);
  let short = null;
  let full = null;
  for (const sec of sections) {
    const [head, ...rest] = sec.split('\n');
    const body = rest.join('\n').replace(/\(\d+\/\d+ Zeichen\)/g, '').replace(/^\([^)]*\)$/gm, '').trim();
    const h = head.trim().toLowerCase();
    if (/kurz|short|kısa|القصير|corta|courte/.test(h)) short = body.split('\n\n')[0].trim();
    if (/vollständige|full description|tam açıklama|الوصف الكامل|completa|complète/.test(h)) full = body.trim();
  }
  return { title, short, full };
}

const parsed = {};
let fehler = false;
for (const [lang, locale] of Object.entries(LOCALES)) {
  const { title, short, full } = parseListing(fs.readFileSync(path.join(DIR, `${lang}.md`), 'utf8'));
  if (!title || !short || !full) { console.error(`${lang}: parse-Fehler`); fehler = true; continue; }
  if (title.length > 30 || short.length > 80 || full.length > 4000) {
    console.error(`${lang}: zu lang — Titel ${title.length}/30, Kurz ${short.length}/80, Voll ${full.length}/4000`);
    fehler = true;
  }
  console.log(`${locale.padEnd(6)} Titel ${title.length}/30  Kurz ${short.length}/80  Voll ${full.length}/4000`);
  parsed[locale] = { title, short, full };
}
if (fehler) process.exit(1);
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
