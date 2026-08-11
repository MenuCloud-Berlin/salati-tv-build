// Gemeinsamer Zugang zur App-Store-Connect-API fuer die Salati-TV-Skripte.
//
// Schluessel und Aussteller stehen bewusst hier und nicht in einer .env: die
// .p8-Datei liegt ausserhalb des Repos, ohne sie nuetzt die ID niemandem.
// Dieselbe Konfiguration nutzt schon apps/mobile/scripts/asc-status.mjs.
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire('C:/Users/domen/Documents/MenuCloud/scripts/');
const jwt = require('jsonwebtoken');

export const KEY_ID = 'H73GL4Q2AQ';
export const ISSUER = 'de348707-2ec6-4079-b3a4-74c17c31ba0c';
export const KEY_PATH = 'C:/Users/domen/Documents/MenuCloud/AuthKey_H73GL4Q2AQ_Apple.p8';
export const TEAM_ID = 'ZKG548NGDR';
export const BUNDLE_ID = 'de.salatibox.tv';

export function token() {
  return jwt.sign({ iss: ISSUER, aud: 'appstoreconnect-v1' }, fs.readFileSync(KEY_PATH, 'utf8'), {
    algorithm: 'ES256',
    expiresIn: '15m',
    header: { alg: 'ES256', kid: KEY_ID, typ: 'JWT' },
  });
}

const BASE = 'https://api.appstoreconnect.apple.com';

export async function asc(pfad, { method = 'GET', body } = {}) {
  const url = pfad.startsWith('http') ? pfad : `${BASE}/v1${pfad}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${pfad}: ${r.status} ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : null;
}

// Laeuft ueber alle Seiten, weil Apple bei 200 Eintraegen abschneidet.
export async function ascAlle(pfad) {
  let naechste = pfad;
  const alle = [];
  while (naechste) {
    const seite = await asc(naechste);
    alle.push(...seite.data);
    naechste = seite.links?.next ?? null;
  }
  return alle;
}
