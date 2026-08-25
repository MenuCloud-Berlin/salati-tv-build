#!/usr/bin/env node
// Laedt die fertigen Android-Artefakte direkt vom CI-Runner dorthin, wo sie
// hingehoeren — ohne Umweg ueber GitHubs Artefakt-Speicher.
//
// WARUM ES DIESES SKRIPT GIBT (2026-08-07): Der Android-Build war erfolgreich,
// aber `actions/upload-artifact` scheiterte mit "Artifact storage quota has
// been hit". Das Kontingent gilt kontoweit und wird laut GitHub nur alle 6-12
// Stunden neu berechnet — selbst nachdem alle 58 Altartefakte (5,03 GB)
// geloescht waren und null gespeichert blieben. Die fertige APK lag also auf
// dem Runner und war trotzdem nicht zu gebrauchen. Der Zwischenspeicher war
// ohnehin nur ein Umweg: die APK muss nach R2, das AAB in den Play Store.
//
// Gegenstueck fuer iOS: der Schritt "IPA direkt zu App Store Connect laden" in
// .github/workflows/ios.yml.
//
// BEWUSST OHNE ABHAENGIGKEITEN: Die lokalen Schwestern (upload-apk-r2.mjs,
// play-release-production.mjs) lesen Zugangsdaten aus festen Windows-Pfaden und
// ziehen `jsonwebtoken` ueber einen absoluten `createRequire` — beides gibt es
// auf dem Runner nicht. Signatur (AWS SigV4, RS256-JWT) macht hier deshalb
// node:crypto selbst.
//
// Zugangsdaten AUSSCHLIESSLICH aus Umgebungsvariablen (Actions-Secrets). Es
// wird nie ein Wert ausgegeben, auch nicht gekuerzt.
//
// Usage:
//   node scripts/ci-release-upload.mjs --apk <pfad.apk>
//   node scripts/ci-release-upload.mjs --aab <pfad.aab> --notes store/play-notes-1.47.0.json
import { createHash, createHmac, createSign } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : null;
};
const APK = arg('--apk');
const AAB = arg('--aab');
const NOTES = arg('--notes');
// Paketname. Ueber --package bzw. PLAY_PACKAGE ueberschreibbar, damit
// derselbe Weg auch den Fernseher (de.salatibox.tv) veroeffentlichen kann -
// dasselbe Dienstkonto hat Zugriff auf alle Apps des Entwicklerkontos.
const PACKAGE = arg('--package') || process.env.PLAY_PACKAGE || 'de.salatibox.de';
/**
 * Der Schluessel, unter dem die Webseite die APK anbietet (APK_URL in
 * app/(tabs)/index.web.tsx). Ueber R2_KEY ueberschreibbar — damit die
 * Signatur gegen einen Wegwerf-Schluessel geprueft werden kann, ohne die
 * ausgelieferte Datei anzufassen.
 */
const R2_KEY = process.env.R2_KEY || 'app/salati.apk';

function pflicht(name) {
  // eslint-disable-next-line expo/no-dynamic-env-var -- Absicht: EIN Pruefpfad fuer alle Secrets statt sechs gleicher Bloecke; die Namen stehen als Konstanten im Aufrufer, nichts kommt von aussen.
  const wert = process.env[name];
  if (!wert) {
    console.error(`Umgebungsvariable ${name} fehlt — Secret im Build-Repo hinterlegen.`);
    process.exit(1);
  }
  return wert;
}

// ─────────────────────────────────────────────── R2 (S3-kompatibel, SigV4)

const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, d) => createHmac('sha256', key).update(d).digest();

/**
 * Zeile fuer Zeile wie `putObjekt()` in scripts/upload-apk-r2.mjs — der
 * Fassung, die die APK seit Monaten ausliefert.
 *
 * ACHTUNG bei den Namen, hier lag beim ersten Anlauf der Fehler:
 *   cloudflare_s3_api  ist die ENDPUNKT-URL (https://<konto>.r2.cloudflarestorage.com)
 *   cloudflare_id      ist der Zugriffsschluessel (Access Key ID)
 *   cloudflare_sec     ist das Geheimnis
 * Der Endpunkt ist von hier aus nicht erreichbar (Firewall), die Signatur laesst
 * sich lokal also nicht ausprobieren — umso wichtiger, dass sie mit der
 * erprobten Fassung uebereinstimmt statt neu geraten zu werden.
 */
async function nachR2(pfad) {
  const endpunkt = new URL(pflicht('CLOUDFLARE_S3_API'));
  const zugriff = pflicht('CLOUDFLARE_ID');
  const geheim = pflicht('CLOUDFLARE_SEC');
  const bucket = pflicht('CLOUDFLARE_BUCKET');

  const body = readFileSync(pfad);
  const stempel = new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260807T113000Z
  const tag = stempel.slice(0, 8);
  const nutzlastHash = sha256hex(body);
  const objektPfad = `/${bucket}/${R2_KEY}`;

  // Der Inhaltstyp folgt der Endung, nicht dem Schalter: dieselbe Funktion
  // laedt inzwischen auch Pruefbilder hoch (Uhren-Simulator, s.
  // .github/workflows/watch-check.yml). Ein PNG als APK auszuzeichnen wuerde
  // im Browser einen Download statt einer Anzeige ausloesen.
  const inhaltstyp = R2_KEY.endsWith('.png')
    ? 'image/png'
    : R2_KEY.endsWith('.jpg') || R2_KEY.endsWith('.jpeg')
      ? 'image/jpeg'
      : 'application/vnd.android.package-archive';

  const kopf = {
    host: endpunkt.host,
    'content-type': inhaltstyp,
    'x-amz-content-sha256': nutzlastHash,
    'x-amz-date': stempel,
  };
  const signierte = Object.keys(kopf).sort();
  const kanonischeKopfzeilen = signierte.map((k) => `${k}:${kopf[k]}\n`).join('');
  const signedHeaders = signierte.join(';');
  const kanonisch = ['PUT', objektPfad, '', kanonischeKopfzeilen, signedHeaders, nutzlastHash].join('\n');

  const bereich = `${tag}/auto/s3/aws4_request`;
  const zuSignieren = ['AWS4-HMAC-SHA256', stempel, bereich, sha256hex(kanonisch)].join('\n');
  let key = hmac(`AWS4${geheim}`, tag);
  key = hmac(key, 'auto');
  key = hmac(key, 's3');
  key = hmac(key, 'aws4_request');
  const signatur = createHmac('sha256', key).update(zuSignieren).digest('hex');

  const antwort = await fetch(`${endpunkt.origin}${objektPfad}`, {
    method: 'PUT',
    headers: {
      ...kopf,
      authorization: `AWS4-HMAC-SHA256 Credential=${zugriff}/${bereich}, SignedHeaders=${signedHeaders}, Signature=${signatur}`,
    },
    body,
  });
  if (!antwort.ok) {
    console.error(`R2-Upload fehlgeschlagen: HTTP ${antwort.status}`);
    console.error((await antwort.text()).slice(0, 400));
    process.exit(1);
  }
  console.log(`Nach R2 geladen: ${R2_KEY} (${(body.length / 1048576).toFixed(1)} MB, ${inhaltstyp})`);
}

// ─────────────────────────────────────────────── Play (Publishing-API)

/** RS256-JWT ohne Fremdpaket — der Service-Account-Schluessel ist ein PEM. */
function jwtRS256(nutzlast, privateKey) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const kopf = b64({ alg: 'RS256', typ: 'JWT' });
  const koerper = b64(nutzlast);
  const signatur = createSign('RSA-SHA256').update(`${kopf}.${koerper}`).sign(privateKey).toString('base64url');
  return `${kopf}.${koerper}.${signatur}`;
}

async function nachPlay(pfad) {
  const sa = JSON.parse(Buffer.from(pflicht('PLAY_SERVICE_ACCOUNT_BASE64'), 'base64').toString('utf8'));
  const jetzt = Math.floor(Date.now() / 1000);
  const assertion = jwtRS256(
    {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: jetzt,
      exp: jetzt + 3600,
    },
    sa.private_key,
  );
  const tok = await (
    await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    })
  ).json();
  const token = tok.access_token;
  if (!token) {
    console.error('Play-Token fehlgeschlagen:', tok.error ?? 'unbekannt');
    process.exit(1);
  }

  const BASIS = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PACKAGE}`;
  const api = async (weg, init = {}) => {
    const r = await fetch(`${BASIS}${weg}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const json = await r.json().catch(() => null);
    return { ok: r.ok, status: r.status, json };
  };

  const edit = await api('/edits', { method: 'POST', body: '{}' });
  if (!edit.ok) {
    console.error('Play-Edit fehlgeschlagen:', edit.status, JSON.stringify(edit.json?.error?.message ?? '').slice(0, 200));
    process.exit(1);
  }
  const editId = edit.json.id;

  const aab = readFileSync(pfad);
  const hoch = await fetch(
    `https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/${PACKAGE}/edits/${editId}/bundles?uploadType=media`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: aab,
    },
  );
  const hochJson = await hoch.json().catch(() => null);
  if (!hoch.ok) {
    console.error('AAB-Upload fehlgeschlagen:', hoch.status, JSON.stringify(hochJson?.error?.message ?? '').slice(0, 300));
    process.exit(1);
  }
  const versionCode = hochJson.versionCode;
  console.log(`AAB hochgeladen: versionCode ${versionCode} (${(aab.length / 1048576).toFixed(1)} MB)`);

  // Release-Notes je Sprache. Play kappt bei 500 Zeichen — hier lieber
  // abbrechen als still gekappt veroeffentlichen.
  let releaseNotes;
  if (NOTES) {
    const map = JSON.parse(readFileSync(NOTES, 'utf8'));
    const zuLang = Object.entries(map).filter(([, t]) => t.length > 500);
    if (zuLang.length) {
      console.error('Release-Notes zu lang:', zuLang.map(([l, t]) => `${l} ${t.length}`).join(', '));
      process.exit(1);
    }
    releaseNotes = Object.entries(map).map(([language, text]) => ({ language, text }));
  }

  const track = await api(`/edits/${editId}/tracks/production`, {
    method: 'PUT',
    body: JSON.stringify({
      track: 'production',
      releases: [{ versionCodes: [String(versionCode)], status: 'completed', ...(releaseNotes ? { releaseNotes } : {}) }],
    }),
  });
  if (!track.ok) {
    console.error('Track-Zuweisung fehlgeschlagen:', track.status, JSON.stringify(track.json?.error?.message ?? '').slice(0, 300));
    process.exit(1);
  }

  const commit = await api(`/edits/${editId}:commit`, { method: 'POST' });
  if (!commit.ok) {
    console.error('Commit fehlgeschlagen:', commit.status, JSON.stringify(commit.json?.error?.message ?? '').slice(0, 300));
    process.exit(1);
  }
  console.log(`Play: versionCode ${versionCode} auf den Produktions-Track gelegt (${releaseNotes?.length ?? 0} Sprachen).`);
}

// ─────────────────────────────────────────────── Ablauf

if (!APK && !AAB) {
  console.error('Nichts zu tun — --apk und/oder --aab angeben.');
  process.exit(1);
}
if (APK) {
  console.log(`APK: ${APK} (${(statSync(APK).size / 1048576).toFixed(1)} MB)`);
  await nachR2(APK);
}
if (AAB) {
  console.log(`AAB: ${AAB} (${(statSync(AAB).size / 1048576).toFixed(1)} MB)`);
  await nachPlay(AAB);
}
