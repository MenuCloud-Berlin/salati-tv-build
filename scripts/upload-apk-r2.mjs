// Laedt die Release-APK von Salati TV nach Cloudflare R2 (app/salati-tv.apk) —
// die Datei, die der Direkt-Download auf www.salati.pro anbietet.
//
// Gegenstueck zu apps/mobile/scripts/upload-apk-r2.mjs, mit den Pruefungen,
// die fuer den FERNSEHER zaehlen. Ein Download, den jemand auf einen Fire-TV-
// Stick seitlaedt, muss die Datei sein, die auch bei Play liegt:
//
//   1. Signatur = echter Upload-Keystore. Es gab bereits einen Release der
//      Handy-App, dessen APK mit dem Debug-Schluessel signiert war.
//   2. Alle vier ABIs. Wird zum Pruefen mit `-PreactNativeArchitectures=x86_64`
//      gebaut und diese APK versehentlich hochgeladen, startet sie auf KEINEM
//      echten Fernseher (die sind arm64 oder armeabi-v7a).
//   3. Die acht Koran-Schriften. Ohne sie faellt der Leser auf die Systemschrift
//      des Fernsehers zurueck — genau der Zustand, den 1.4.0 behebt, und man
//      sieht es der Datei nicht an.
//   4. Leanback-Merkmale. Fehlt `android.software.leanback`, taucht die App im
//      Android-TV-Launcher gar nicht auf.
//
// Zugangsdaten kommen aus der .env im Repo-Wurzelverzeichnis und werden NIE
// ausgegeben.
//
// Ausfuehren: cd apps/tv && node scripts/upload-apk-r2.mjs [pfad/zur.apk]
//             node scripts/upload-apk-r2.mjs --pruefen   (nur nachsehen)
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(HIER, '..');
const STANDARD_APK = path.join(TV, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const KEY = 'app/salati-tv.apk';
/** SHA-1 des Upload-Keystores von de.salatibox.tv (s. plugins/with-release-signing.js). */
const UPLOAD_KEY_SHA1 = 'e9dd82c114128be89334c92c957e5c07824e83d9';
const ABIS = ['armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'];

function ladeEnv() {
  const datei = path.join(TV, '..', '..', '.env');
  if (!existsSync(datei)) throw new Error(`.env nicht gefunden: ${datei}`);
  const env = {};
  for (const zeile of readFileSync(datei, 'utf8').split(/\r?\n/)) {
    const m = /^([A-Za-z_0-9]+)=(.*)$/.exec(zeile.trim());
    if (m) env[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  const noetig = ['cloudflare_id', 'cloudflare_sec', 'cloudflare_s3_api', 'cloudflare_bucket', 'cloudflare_public_url'];
  const fehlt = noetig.filter((k) => !env[k]);
  if (fehlt.length) throw new Error(`.env unvollstaendig, fehlende Schluessel: ${fehlt.join(', ')}`);
  return env;
}

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, d) => createHmac('sha256', key).update(d).digest();

/** Neuestes Android-Build-Tool finden (apksigner/aapt2 liegen versioniert). */
function werkzeug(name) {
  for (const wurzel of ['C:/Android/build-tools', `${process.env.ANDROID_HOME ?? ''}/build-tools`]) {
    if (!existsSync(wurzel)) continue;
    for (const v of readdirSync(wurzel).sort().reverse()) {
      for (const endung of ['.bat', '.exe', '']) {
        const p = path.join(wurzel, v, name + endung);
        if (existsSync(p)) return p;
      }
    }
  }
  return null;
}

/** Dateiliste der APK (ueber `unzip -l`, unter Git Bash vorhanden). */
function eintraege(datei) {
  try {
    const liste = execFileSync('unzip', ['-l', datei], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
    return [...liste.matchAll(/^\s*\d+\s+\S+\s+\S+\s+(\S+)$/gm)].map((m) => m[1]);
  } catch {
    return null;
  }
}

/**
 * Die acht Koran-Schriften muessen in der APK liegen.
 *
 * Verglichen wird ueber SHA-256, nicht ueber den Namen: Metro benennt Assets im
 * Bundle um (`assets/assets/fonts/kfgqpc-hafs.ttf` je nach Konfiguration).
 * Ohne diese Pruefung ginge eine APK online, in der der Leser still auf die
 * Systemschrift des Fernsehers zurueckfaellt — und genau das war der Zustand
 * VOR 1.4.0.
 */
function pruefeSchriften(datei, dateien) {
  const quelle = path.join(TV, 'assets', 'fonts');
  const erwartet = new Map(
    readdirSync(quelle)
      .filter((n) => n.endsWith('.ttf'))
      .map((n) => [sha256(readFileSync(path.join(quelle, n))), n]),
  );
  if (!dateien) {
    console.log('Hinweis: unzip nicht gefunden — Schriften in der APK ungeprueft.');
    return;
  }
  const ttf = dateien.filter((n) => n.toLowerCase().endsWith('.ttf'));
  const gefunden = new Set();
  for (const eintrag of ttf) {
    const inhalt = execFileSync('unzip', ['-p', datei, eintrag], { maxBuffer: 64 * 1024 * 1024 });
    const name = erwartet.get(sha256(inhalt));
    if (name) gefunden.add(name);
  }
  const fehlend = [...erwartet.values()].filter((n) => !gefunden.has(n));
  if (fehlend.length > 0) {
    throw new Error(
      `In der APK fehlen ${fehlend.length} Koran-Schrift(en): ${fehlend.join(', ')}. ` +
        'Der Leser fiele auf die Systemschrift des Fernsehers zurueck. ' +
        'Meist ein veralteter Metro-Cache — mit `--reset-cache` neu buendeln.',
    );
  }
  console.log(`Koran-Schriften geprueft: ${gefunden.size}/${erwartet.size} im Paket`);
}

/** Alle vier ABIs — sonst startet die APK auf echten Fernsehern nicht. */
function pruefeAbis(dateien) {
  if (!dateien) return;
  const vorhanden = new Set(
    dateien.map((n) => /^lib\/([^/]+)\//.exec(n)?.[1]).filter((x) => typeof x === 'string'),
  );
  const fehlend = ABIS.filter((a) => !vorhanden.has(a));
  if (fehlend.length > 0) {
    throw new Error(
      `APK enthaelt nur die ABIs ${[...vorhanden].join(', ') || '(keine)'} — es fehlen ${fehlend.join(', ')}. ` +
        'Vermutlich ein Pruefbau mit -PreactNativeArchitectures. Auf echten Fernsehern (arm64/armeabi-v7a) ' +
        'liesse sich diese Datei nicht installieren.',
    );
  }
  console.log(`ABIs geprueft: ${ABIS.join(', ')}`);
}

/** Prueft die APK, bevor sie oeffentlich wird. */
function pruefeApk(datei) {
  const groesse = statSync(datei).size;
  if (groesse < 20_000_000) {
    throw new Error(`APK ist nur ${(groesse / 1e6).toFixed(1)} MB — das kann keine vollstaendige Release-APK sein.`);
  }

  const dateien = eintraege(datei);
  pruefeAbis(dateien);
  pruefeSchriften(datei, dateien);

  const aapt2 = werkzeug('aapt2');
  let version = 'unbekannt';
  if (aapt2) {
    const badging = execFileSync(aapt2, ['dump', 'badging', datei], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const m = /versionCode='(\d+)' versionName='([^']+)'/.exec(badging);
    if (m) version = `${m[2]} (${m[1]})`;
    if (!/package: name='de\.salatibox\.tv'/.test(badging)) {
      throw new Error('Das ist nicht de.salatibox.tv — falsche APK.');
    }
    // Ohne dieses Merkmal erscheint die App im Android-TV-Launcher nicht.
    if (!/android\.software\.leanback/.test(badging)) {
      throw new Error('android.software.leanback fehlt — die App taeuchte im TV-Launcher gar nicht auf.');
    }
  } else {
    console.log('Hinweis: aapt2 nicht gefunden — Version und TV-Merkmale ungeprueft.');
  }

  const apksigner = werkzeug('apksigner');
  if (apksigner) {
    // apksigner liegt unter Windows als .bat vor; die laesst sich nur ueber die
    // Shell starten (execFileSync sonst: EINVAL).
    const ueberShell = apksigner.endsWith('.bat');
    const aus = ueberShell
      ? execFileSync(`"${apksigner}" verify --print-certs "${datei}"`, {
          encoding: 'utf8',
          shell: true,
          maxBuffer: 16 * 1024 * 1024,
        })
      : execFileSync(apksigner, ['verify', '--print-certs', datei], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    const sha1 = /SHA-1 digest:\s*([0-9a-f]+)/i.exec(aus)?.[1]?.toLowerCase();
    if (sha1 !== UPLOAD_KEY_SHA1) {
      throw new Error(`APK ist NICHT mit dem Upload-Keystore signiert (SHA-1 ${sha1 ?? 'unbekannt'}). Release abgebrochen.`);
    }
    console.log('Signatur geprueft: Upload-Keystore');
  } else {
    console.log('Hinweis: apksigner nicht gefunden — Signatur ungeprueft.');
  }

  return { groesse, version };
}

/** Minimales AWS-SigV4-PUT gegen einen S3-kompatiblen Endpunkt (path-style). */
async function putObjekt(env, key, body, contentType) {
  const endpoint = new URL(env.cloudflare_s3_api);
  const pfad = `/${env.cloudflare_bucket}/${key}`;
  const amzDatum = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const datum = amzDatum.slice(0, 8);
  const region = 'auto';
  const dienst = 's3';
  const nutzlastHash = sha256(body);

  const headers = {
    host: endpoint.host,
    'content-type': contentType,
    'x-amz-content-sha256': nutzlastHash,
    'x-amz-date': amzDatum,
  };
  const signierte = Object.keys(headers).sort();
  const kanonischeHeader = signierte.map((h) => `${h}:${headers[h]}\n`).join('');
  const signedHeaders = signierte.join(';');
  const kanonisch = ['PUT', pfad, '', kanonischeHeader, signedHeaders, nutzlastHash].join('\n');
  const bereich = `${datum}/${region}/${dienst}/aws4_request`;
  const zuSignieren = ['AWS4-HMAC-SHA256', amzDatum, bereich, sha256(kanonisch)].join('\n');
  let schluessel = hmac(`AWS4${env.cloudflare_sec}`, datum);
  schluessel = hmac(schluessel, region);
  schluessel = hmac(schluessel, dienst);
  schluessel = hmac(schluessel, 'aws4_request');
  const signatur = createHmac('sha256', schluessel).update(zuSignieren).digest('hex');

  const r = await fetch(`${endpoint.origin}${pfad}`, {
    method: 'PUT',
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${env.cloudflare_id}/${bereich}, SignedHeaders=${signedHeaders}, Signature=${signatur}`,
    },
    body,
  });
  if (!r.ok) throw new Error(`PUT ${key} fehlgeschlagen: HTTP ${r.status} ${(await r.text()).slice(0, 300)}`);
}

const env = ladeEnv();
const oeffentlich = `${env.cloudflare_public_url.replace(/\/+$/, '')}/${KEY}`;

if (process.argv.includes('--pruefen')) {
  const r = await fetch(oeffentlich, { method: 'HEAD' });
  console.log(
    `online: HTTP ${r.status} · ${(Number(r.headers.get('content-length') ?? 0) / 1e6).toFixed(1)} MB · ${r.headers.get('content-type')}`,
  );
  process.exit(0);
}

const apk = process.argv.find((a) => a.endsWith('.apk')) ?? STANDARD_APK;
if (!existsSync(apk)) throw new Error(`APK nicht gefunden: ${apk}`);

const { groesse, version } = pruefeApk(apk);
console.log(`APK geprueft: Version ${version} · ${(groesse / 1e6).toFixed(1)} MB`);

await putObjekt(env, KEY, readFileSync(apk), 'application/vnd.android.package-archive');

const kontrolle = await fetch(oeffentlich, { method: 'HEAD' });
const online = Number(kontrolle.headers.get('content-length') ?? 0);
console.log(
  `hochgeladen: HTTP ${kontrolle.status} · online ${(online / 1e6).toFixed(1)} MB · ${kontrolle.headers.get('content-type')}` +
    (online === groesse ? ' · Groesse stimmt' : ` · ABWEICHUNG (lokal ${(groesse / 1e6).toFixed(1)} MB)`),
);
console.log(oeffentlich);
