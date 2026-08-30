#!/usr/bin/env node
// Baut den Katalog der Foto- und Video-Hintergruende und laedt ihn nach R2.
//
// WARUM ES DIESES SKRIPT GIBT: Die Motive liegen NICHT im APK (Begruendung in
// src/lib/hintergrundMedien.ts), sondern in R2 unter `tv/hintergrund/`. Damit
// nachvollziehbar bleibt, WOHER jedes Bild kommt und unter welcher Lizenz, ist
// die Quelle hier fest aufgeschrieben — nicht irgendwo von Hand
// zusammengesucht und hochgeladen.
//
// AUSWAHLREGEL: nur Wikimedia Commons, und dort nur CC0, Public Domain,
// CC BY oder CC BY-SA. CC BY verlangt die Nennung von Urheber und Lizenz; sie
// steht im Index und wird in den Einstellungen angezeigt
// (Bereich „Hintergrund" → „Bildnachweis"). Bei CC BY-SA steht die hier
// erzeugte, zugeschnittene Fassung unter derselben Lizenz — auch das steht im
// Nachweis.
//
// WAS ERZEUGT WIRD, je Motiv:
//   • Foto: 1920x1080 JPEG (formatfuellend zugeschnitten)
//   • Video: 1280x720 H.264/MP4 OHNE Tonspur, nahtlos geloopt
//   • dazu ein Standbild 960x540 als Vorschau und als Grund vor dem Download
//
// NAHTLOSE SCHLEIFE: die letzten 1,5 s werden ueber den Anfang geblendet
// (`overlay` mit Alpha-Blende). Ein harter Schnitt waere auf einem
// Hintergrund, der stundenlang laeuft, alle 20 Sekunden ein sichtbarer Sprung.
// Umkehren (vorwaerts + rueckwaerts) waere die einfachere Schleife, scheidet
// aber aus: der Tawaf laeuft gegen den Uhrzeigersinn, rueckwaerts abgespielt
// waere er schlicht falsch herum.
//
// Aufruf:
//   node scripts/hintergruende-bauen.mjs --quellen <ordner>   # nur bauen
//   node scripts/hintergruende-bauen.mjs --quellen <ordner> --hochladen
//
// `--quellen` zeigt auf den Ordner mit den Rohdateien (Namen s. QUELLEN).
// Zugangsdaten fuer R2 kommen aus der .env im Repo-Wurzelverzeichnis und
// werden NIE ausgegeben.
import { createHash, createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(HIER, '..');
const PRAEFIX = 'tv/hintergrund';

/**
 * Der Katalog. Jede Zeile ist eine Entscheidung, die jemand nachvollziehen
 * koennen muss: welches Motiv, aus welcher Datei, welcher Ausschnitt, wessen
 * Werk, welche Lizenz.
 *
 * `schnitt` gilt nur fuer Videos: [Start in Sekunden, Laenge in Sekunden].
 * Die Ausschnitte sind am Standbild gewaehlt worden (ruhige Kamera, kein
 * eingebrannter Text, kein Logo) — nicht geraten.
 */
const QUELLEN = [
  {
    id: 'kaaba',
    art: 'foto',
    datei: 'kaaba.jpg',
    nameKey: 'hintergrund.kaaba',
    name: 'Kaaba',
    autor: 'Adli Wahid',
    lizenz: 'CC BY-SA 4.0',
    quelle: 'commons.wikimedia.org — The Kaaba during Hajj.jpg',
  },
  {
    id: 'kiswa',
    art: 'foto',
    datei: 'kiswa.jpg',
    nameKey: 'hintergrund.kiswa',
    name: 'Kiswa',
    autor: 'Abdullah Shakoor',
    lizenz: 'CC0',
    quelle: 'commons.wikimedia.org — Kiswah, Kaaba - 7 May 2016.jpg',
  },
  {
    id: 'haram',
    art: 'foto',
    datei: 'haram.jpg',
    nameKey: 'hintergrund.haram',
    name: 'Masjid al-Haram',
    autor: 'مريم محمد الغلبان',
    lizenz: 'CC0',
    quelle: 'commons.wikimedia.org — Masjid al-Haram 2022.jpg',
  },
  {
    id: 'medina',
    art: 'foto',
    datei: 'medina.jpg',
    nameKey: 'hintergrund.medina',
    name: 'Grüne Kuppel, Medina',
    autor: 'TheHadiRahim',
    lizenz: 'CC0',
    quelle: "commons.wikimedia.org — Wide shot of the Green Dome at The Prophet's Mosque.jpg",
  },
  {
    id: 'medina-luft',
    art: 'foto',
    datei: 'medina-luft.jpg',
    nameKey: 'hintergrund.medinaLuft',
    name: 'Prophetenmoschee',
    autor: 'Konevi',
    lizenz: 'CC0',
    quelle: "commons.wikimedia.org — Al-Masjid An-Nabawi (Bird's Eye View).jpg",
  },
  {
    id: 'ornament',
    art: 'foto',
    datei: 'ornament.jpg',
    nameKey: 'hintergrund.ornament',
    name: 'Kuppelornament',
    autor: 'Shahrsakhtafzar.com',
    lizenz: 'CC BY-SA 4.0',
    quelle: 'commons.wikimedia.org — Sheikh-Lotfollah-Ceiling.jpg',
  },
  {
    id: 'tawaf',
    art: 'video',
    datei: 'makkah-al-mukarramah-kaaba-ramadan-2016-webm.webm',
    schnitt: [62, 22],
    nameKey: 'hintergrund.tawaf',
    name: 'Tawaf',
    autor: 'Makkah Al-Mukarramah (YouTube)',
    lizenz: 'CC BY 3.0',
    quelle: 'commons.wikimedia.org — Makkah Al-Mukarramah -Kaaba- Ramadan 2016.webm',
  },
  {
    id: 'kaaba-nacht',
    art: 'video',
    datei: 'kaaba-at-night-video-sep-28-2016-webm.webm',
    // Erst ab Sekunde 37 fuellt die Kiswa das Bild; davor laeuft die Kamera
    // ueber die Menge (am Standbild der ersten Fassung gesehen: die Kachel
    // zeigte Ruecken statt Kaaba).
    schnitt: [37, 15],
    nameKey: 'hintergrund.kaabaNacht',
    name: 'Kaaba bei Nacht',
    autor: 'Makkah Al-Mukarramah (YouTube)',
    lizenz: 'CC BY 3.0',
    quelle: 'commons.wikimedia.org — Kaaba at Night (video) - Sep 28, 2016.webm',
  },
  {
    id: 'abendhimmel',
    art: 'video',
    datei: 'sunset-timelapse-in-funchal-2014-webm.webm',
    schnitt: [6, 34],
    nameKey: 'hintergrund.abendhimmel',
    name: 'Abendhimmel',
    autor: 'Marco Verch',
    lizenz: 'CC BY 3.0',
    quelle: 'commons.wikimedia.org — Sunset timelapse in Funchal - 2014.webm',
  },
];

const args = process.argv.slice(2);
function argWert(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const QUELLORDNER = argWert('--quellen');
const HOCHLADEN = args.includes('--hochladen');
const AUSGABE = argWert('--ausgabe') ?? path.join(TV, 'build-hintergruende');

if (!QUELLORDNER) {
  console.error('Aufruf: node scripts/hintergruende-bauen.mjs --quellen <ordner> [--hochladen]');
  process.exit(1);
}

function ffmpeg(argumente) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...argumente], { stdio: ['ignore', 'ignore', 'inherit'] });
}

/** Formatfuellender Zuschnitt auf genau `b`x`h` — nie verzerrt, nie mit Rand. */
function fuellend(b, h) {
  return `scale=${b}:${h}:force_original_aspect_ratio=increase,crop=${b}:${h}`;
}

/**
 * Nahtlose Schleife: die letzten `blende` Sekunden ueber den Anfang legen.
 * Ergebnis ist um `blende` kuerzer als der Ausschnitt.
 */
// 720p und nicht 1080p — zwei Gruende, beide gemessen:
//   1. GROESSE. Der Tawaf ist eine Menschenmenge, also lauter Detail: in 1080p
//      wurden aus 20 Sekunden 24 MB. Ein Hintergrund, den man ueber die
//      Fernbedienung auswaehlt, darf keine 24-MB-Wartezeit sein.
//   2. RECHENLAST. Die App laeuft auf Fernseh-Sticks, und dieses Video laeuft
//      STUNDENLANG in einer Schleife, waehrend vorne die Uhr tickt.
// Sichtbar ist der Unterschied kaum: das Bild liegt hinter einer Abdunkelung
// von 55 % und traegt kein Detail, auf das jemand schaut.
const BREITE = 1280;
const HOEHE = 720;

function schleifenFilter(laenge, blende = 1.5) {
  const start = blende.toFixed(2);
  const versatz = (laenge - blende).toFixed(2);
  return (
    `[0:v]${fuellend(BREITE, HOEHE)},fps=25,split[koerper][kopf];` +
    `[kopf]trim=duration=${start},format=yuva420p,fade=t=out:st=0:d=${start}:alpha=1,` +
    `setpts=PTS+${versatz}/TB[ueberblende];` +
    `[koerper]trim=start=${start},setpts=PTS-STARTPTS[rest];` +
    `[rest][ueberblende]overlay=format=auto,format=yuv420p[v]`
  );
}

mkdirSync(AUSGABE, { recursive: true });
const index = [];

for (const q of QUELLEN) {
  const quelle = path.join(QUELLORDNER, q.datei);
  if (!existsSync(quelle)) {
    console.error(`FEHLT: ${q.id} → ${quelle}`);
    process.exit(1);
  }
  const poster = path.join(AUSGABE, `${q.id}-poster.jpg`);

  if (q.art === 'foto') {
    const ziel = path.join(AUSGABE, `${q.id}.jpg`);
    ffmpeg(['-i', quelle, '-vf', fuellend(1920, 1080), '-q:v', '4', ziel]);
    // Das Standbild ist zugleich die Kachel in den Einstellungen UND der
    // Grund, bevor die grosse Datei da ist — deshalb 960 px und nicht 320.
    ffmpeg(['-i', quelle, '-vf', fuellend(960, 540), '-q:v', '5', poster]);
    index.push({
      id: q.id,
      art: 'foto',
      nameKey: q.nameKey,
      name: q.name,
      url: `URL/${q.id}.jpg`,
      posterUrl: `URL/${q.id}-poster.jpg`,
      bytes: statSync(ziel).size,
      autor: q.autor,
      lizenz: q.lizenz,
      quelle: q.quelle,
    });
    console.log(`${q.id}: Foto ${(statSync(ziel).size / 1e6).toFixed(2)} MB`);
    continue;
  }

  const [start, laenge] = q.schnitt;
  const ziel = path.join(AUSGABE, `${q.id}.mp4`);
  ffmpeg([
    '-ss', String(start),
    '-t', String(laenge),
    '-i', quelle,
    '-filter_complex', schleifenFilter(laenge),
    '-map', '[v]',
    // KEINE Tonspur. Der Hintergrund laeuft, waehrend vorne rezitiert wird.
    '-an',
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '27',
    '-pix_fmt', 'yuv420p',
    // Fernseher-Decoder sind waehlerisch; High/4.0 kann jedes Android-TV-Geraet.
    '-profile:v', 'high',
    '-level', '4.0',
    '-movflags', '+faststart',
    // Harte Laengenangabe: `overlay` haengt sonst die verbleibenden 1,5 s der
    // zweiten Spur an, und die letzte Sekunde staende still (gemessen: die
    // Datei war 22,04 s statt 20,5 s lang).
    '-t', String(laenge - 1.5),
    ziel,
  ]);
  // Das Standbild ist der ERSTE Bildinhalt des fertigen Videos (der Schnitt
  // beginnt nach der Ueberblendung). Nur so ist der Uebergang vom Standbild
  // zum laufenden Video nicht zu sehen.
  ffmpeg(['-ss', String(start + 1.5), '-i', quelle, '-frames:v', '1', '-vf', fuellend(960, 540), '-q:v', '5', poster]);
  index.push({
    id: q.id,
    art: 'video',
    nameKey: q.nameKey,
    name: q.name,
    url: `URL/${q.id}.mp4`,
    posterUrl: `URL/${q.id}-poster.jpg`,
    bytes: statSync(ziel).size,
    autor: q.autor,
    lizenz: q.lizenz,
    quelle: q.quelle,
  });
  console.log(`${q.id}: Video ${(statSync(ziel).size / 1e6).toFixed(2)} MB`);
}

// --------------------------------------------------------------- Hochladen

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
  if (fehlt.length) throw new Error(`.env unvollstaendig: ${fehlt.join(', ')}`);
  return env;
}

const sha256 = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, d) => createHmac('sha256', key).update(d).digest();

/** S3-Signatur v4 (dieselbe Mechanik wie scripts/upload-apk-r2.mjs). */
async function hochladen(env, schluessel, koerper, typ) {
  const basis = new URL(env.cloudflare_s3_api);
  const host = basis.host;
  const pfad = `${basis.pathname.replace(/\/$/, '')}/${env.cloudflare_bucket}/${schluessel}`;
  const jetzt = new Date();
  const stempel = jetzt.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const tag = stempel.slice(0, 8);
  const inhaltsHash = sha256(koerper);
  const kopf = {
    host,
    'content-type': typ,
    'x-amz-content-sha256': inhaltsHash,
    'x-amz-date': stempel,
  };
  const sortiert = Object.keys(kopf).sort();
  const kanon =
    `PUT\n${pfad}\n\n` +
    sortiert.map((k) => `${k}:${kopf[k]}\n`).join('') +
    `\n${sortiert.join(';')}\n${inhaltsHash}`;
  const bereich = `${tag}/auto/s3/aws4_request`;
  const zuSignieren = `AWS4-HMAC-SHA256\n${stempel}\n${bereich}\n${sha256(kanon)}`;
  let key = hmac(`AWS4${env.cloudflare_sec}`, tag);
  key = hmac(key, 'auto');
  key = hmac(key, 's3');
  key = hmac(key, 'aws4_request');
  const signatur = createHmac('sha256', key).update(zuSignieren).digest('hex');
  const antwort = await fetch(`https://${host}${pfad}`, {
    method: 'PUT',
    headers: {
      ...kopf,
      Authorization:
        `AWS4-HMAC-SHA256 Credential=${env.cloudflare_id}/${bereich}, ` +
        `SignedHeaders=${sortiert.join(';')}, Signature=${signatur}`,
    },
    body: koerper,
  });
  if (!antwort.ok) throw new Error(`Upload ${schluessel}: HTTP ${antwort.status}`);
}

if (!HOCHLADEN) {
  const vorschau = index.map((e) => ({ ...e, url: e.url.replace('URL', '<r2>'), posterUrl: e.posterUrl.replace('URL', '<r2>') }));
  writeFileSync(path.join(AUSGABE, 'index.json'), JSON.stringify(vorschau, null, 2));
  console.log(`\nGebaut nach ${AUSGABE}. Zum Veroeffentlichen: --hochladen`);
  process.exit(0);
}

const env = ladeEnv();
const basisUrl = `${env.cloudflare_public_url.replace(/\/$/, '')}/${PRAEFIX}`;
const fertig = index.map((e) => ({
  ...e,
  url: e.url.replace('URL', basisUrl),
  posterUrl: e.posterUrl.replace('URL', basisUrl),
}));

for (const e of fertig) {
  const dateiname = e.art === 'foto' ? `${e.id}.jpg` : `${e.id}.mp4`;
  const typ = e.art === 'foto' ? 'image/jpeg' : 'video/mp4';
  await hochladen(env, `${PRAEFIX}/${dateiname}`, readFileSync(path.join(AUSGABE, dateiname)), typ);
  await hochladen(env, `${PRAEFIX}/${e.id}-poster.jpg`, readFileSync(path.join(AUSGABE, `${e.id}-poster.jpg`)), 'image/jpeg');
  console.log(`hochgeladen: ${e.id}`);
}
// Der Index ZULETZT: erst wenn alle Dateien liegen, darf er sie ankuendigen —
// sonst zeigt ein Fernseher eine Kachel, hinter der noch nichts steht.
await hochladen(env, `${PRAEFIX}/index.json`, Buffer.from(JSON.stringify(fertig, null, 2)), 'application/json');
writeFileSync(path.join(AUSGABE, 'index.json'), JSON.stringify(fertig, null, 2));
console.log(`\nIndex veroeffentlicht: ${basisUrl}/index.json`);
