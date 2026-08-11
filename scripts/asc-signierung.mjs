#!/usr/bin/env node
// Legt alles an, was Apple zum Signieren einer tvOS-App verlangt:
// Bundle-ID, Verteilungszertifikat und tvOS-App-Store-Profil.
//
// Der private Schluessel entsteht LOKAL und verlaesst dieses Verzeichnis nicht;
// er liegt ausserhalb des Repos (Ordner ueber --geheim, Vorgabe: Scratchpad).
// Das Skript ist wiederholbar: was schon existiert, wird gefunden statt neu
// angelegt.
//
// Usage: node scripts/asc-signierung.mjs [--geheim <ordner>]
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { asc, ascAlle, BUNDLE_ID, TEAM_ID } from './lib/asc.mjs';

const argIdx = process.argv.indexOf('--geheim');
const GEHEIM =
  argIdx > -1
    ? process.argv[argIdx + 1]
    : 'C:/Users/domen/AppData/Local/Temp/claude/C--Users-domen-Documents-SalatiTech/e2b9d9d2-3505-4b2d-8992-1b6aa32292bd/scratchpad/tv-signing';

fs.mkdirSync(GEHEIM, { recursive: true });
const P = (n) => path.join(GEHEIM, n);
const openssl = (args, opts = {}) => execFileSync('openssl', args, { encoding: 'utf8', ...opts });

// ── 1. Bundle-ID ────────────────────────────────────────────────────────────
let bundle = (await ascAlle('/bundleIds?limit=200')).find((b) => b.attributes.identifier === BUNDLE_ID);
if (bundle) {
  console.log(`Bundle-ID vorhanden: ${BUNDLE_ID} (${bundle.id}, ${bundle.attributes.platform})`);
} else {
  const r = await asc('/bundleIds', {
    method: 'POST',
    body: {
      data: {
        type: 'bundleIds',
        attributes: { identifier: BUNDLE_ID, name: 'Salati TV', platform: 'UNIVERSAL', seedId: TEAM_ID },
      },
    },
  });
  bundle = r.data;
  console.log(`Bundle-ID angelegt: ${BUNDLE_ID} (${bundle.id})`);
}

// ── 2. Verteilungszertifikat ────────────────────────────────────────────────
// Ein bestehendes Zertifikat nuetzt nichts ohne seinen privaten Schluessel —
// und den hat nur, wer es erzeugt hat. Deshalb ein eigenes fuer diesen Zweck,
// erkennbar am Namen.
const KEY = P('tv-dist.key');
const CSR = P('tv-dist.csr');
const CER = P('tv-dist.cer');
const PEM = P('tv-dist.pem');
const P12 = P('tv-dist.p12');
const MERK = P('zertifikat.json');

let zert = null;
if (fs.existsSync(MERK)) {
  const gemerkt = JSON.parse(fs.readFileSync(MERK, 'utf8'));
  zert = (await ascAlle('/certificates?limit=200')).find((c) => c.id === gemerkt.id) ?? null;
  if (zert) console.log(`Zertifikat vorhanden: ${zert.id} (${zert.attributes.displayName})`);
}

if (!zert) {
  if (!fs.existsSync(KEY)) {
    openssl(['req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', KEY, '-out', CSR, '-subj',
      '/emailAddress=menucloudberlin@gmail.com/CN=Salati TV Distribution/O=Domenic Moran/C=DE'],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    console.log('Schluessel + Zertifikatsanfrage erzeugt (lokal, ausserhalb des Repos)');
  }
  const r = await asc('/certificates', {
    method: 'POST',
    body: {
      data: {
        type: 'certificates',
        attributes: { certificateType: 'DISTRIBUTION', csrContent: fs.readFileSync(CSR, 'utf8') },
      },
    },
  });
  zert = r.data;
  fs.writeFileSync(MERK, JSON.stringify({ id: zert.id, name: zert.attributes.displayName }, null, 2));
  console.log(`Zertifikat angelegt: ${zert.id} (${zert.attributes.displayName}, laeuft ab ${zert.attributes.expirationDate?.slice(0, 10)})`);
}

// DER → PEM → p12 (der macOS-Runner importiert das p12 in eine Keychain)
if (!fs.existsSync(P12)) {
  fs.writeFileSync(CER, Buffer.from(zert.attributes.certificateContent, 'base64'));
  openssl(['x509', '-inform', 'DER', '-in', CER, '-out', PEM]);
  const pass = process.env.TV_P12_PASSWORT ?? 'salati-tv';
  openssl(['pkcs12', '-export', '-legacy', '-inkey', KEY, '-in', PEM, '-out', P12, '-name',
    'Salati TV Distribution', '-passout', `pass:${pass}`]);
  console.log(`p12 geschrieben: ${P12}`);
}

// ── 3. tvOS-App-Store-Profil ────────────────────────────────────────────────
const PROFIL_NAME = 'Salati TV AppStore';
let profil = (await ascAlle('/profiles?limit=200')).find(
  (p) => p.attributes.name === PROFIL_NAME && p.attributes.profileState === 'ACTIVE',
);
if (profil) {
  console.log(`Profil vorhanden: ${profil.id} (${profil.attributes.profileType})`);
} else {
  const r = await asc('/profiles', {
    method: 'POST',
    body: {
      data: {
        type: 'profiles',
        attributes: { name: PROFIL_NAME, profileType: 'TVOS_APP_STORE' },
        relationships: {
          bundleId: { data: { type: 'bundleIds', id: bundle.id } },
          certificates: { data: [{ type: 'certificates', id: zert.id }] },
        },
      },
    },
  });
  profil = r.data;
  console.log(`Profil angelegt: ${profil.id} (${profil.attributes.profileType})`);
}

const PROFIL_DATEI = P('salati-tv.mobileprovision');
const inhalt = profil.attributes.profileContent ?? (await asc(`/profiles/${profil.id}`)).data.attributes.profileContent;
fs.writeFileSync(PROFIL_DATEI, Buffer.from(inhalt, 'base64'));
console.log(`Profil geschrieben: ${PROFIL_DATEI}`);

console.log('\nFertig. Fuer die GitHub-Secrets:');
console.log(`  IOS_DIST_P12_BASE64      <- base64 von ${P12}`);
console.log(`  IOS_DIST_P12_PASSWORD    <- Passwort (Umgebungsvariable TV_P12_PASSWORT, Vorgabe salati-tv)`);
console.log(`  IOS_PROFILE_TV           <- base64 von ${PROFIL_DATEI}`);
console.log(`  Profilname fuer exportOptions: ${profil.attributes.name}`);
