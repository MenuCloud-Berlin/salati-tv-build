#!/usr/bin/env node
// Laedt die Apple-TV-Bildschirmfotos aus screenshots/appletv/<sprache>/ zu
// App Store Connect. Ein Satz je Sprache, Geraeteklasse APP_APPLE_TV.
//
// Der Ablauf (reservieren -> Datei in Stuecken senden -> mit Pruefsumme
// abschliessen -> auf COMPLETE warten) und die beiden Fallstricke darin sind
// aus apps/mobile/scripts/asc-screenshots.mjs uebernommen: Apple antwortet auf
// LESENDE Abfragen frisch hochgeladener Objekte zeitweise mit 500, und der
// Abschluss-PATCH kann stumm verpuffen (Antwort 200, Pruefsumme bleibt leer,
// das Bild haengt fuer immer auf UPLOAD_COMPLETE).
//
// Usage:
//   node scripts/asc-screenshots.mjs --pruefen     nur auflisten
//   node scripts/asc-screenshots.mjs               hochladen (ersetzt vorhandene)
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { asc, token, APP_ID } from './lib/asc.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
// Die FERTIGEN Bilder mit Bildunterschrift (scripts/store-bilder.py), nicht die
// rohen Aufnahmen: in der Store-Vorschau sind sie daumennagelgross, und ohne
// Zeile darueber sagt ein dunkler Bildschirm dort nichts.
const BILDER_BASIS = path.join(HIER, '..', 'screenshots', 'store', 'appletv');
const NUR_PRUEFEN = process.argv.includes('--pruefen');

const KLASSE = 'APP_APPLE_TV';
const MASSE = [
  [1920, 1080],
  [3840, 2160],
];
// ASC-Sprache -> Ordner unter screenshots/appletv/
const SPRACHEN = { 'de-DE': 'de', 'en-US': 'en', tr: 'tr', 'ar-SA': 'ar' };

// Wiederholung nur bei LESENDEN Aufrufen: ein zweites POST /appScreenshots
// legte ein zweites Bild im Satz an.
async function lies(pfad, versuche = 6) {
  for (let i = 0; ; i++) {
    try {
      return await asc(pfad);
    } catch (e) {
      const code = /: (\d{3}) /.exec(e.message)?.[1];
      if (i < versuche && code && Number(code) >= 500) {
        await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
}

function pngMasse(datei) {
  const fd = fs.openSync(datei, 'r');
  const kopf = Buffer.alloc(24);
  fs.readSync(fd, kopf, 0, 24, 0);
  fs.closeSync(fd);
  if (kopf.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error(`${datei}: kein PNG`);
  return [kopf.readUInt32BE(16), kopf.readUInt32BE(20)];
}

function lokaleBilder(ordner) {
  const dir = path.join(BILDER_BASIS, ordner);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith('.png'))
    .sort()
    .map((f) => {
      const voll = path.join(dir, f);
      return { name: f, pfad: voll, masse: pngMasse(voll), groesse: fs.statSync(voll).size };
    });
}

const version = (await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=TV_OS&limit=1`)).data[0];
console.log(`Version ${version.attributes.versionString} (${version.attributes.appStoreState})`);
const locs = await asc(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=50`);

if (NUR_PRUEFEN) {
  for (const loc of locs.data) {
    const saetze = (await asc(`/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
    if (!saetze.length) {
      console.log(`${loc.attributes.locale}: keine Saetze`);
      continue;
    }
    for (const s of saetze) {
      const shots = (await asc(`/appScreenshotSets/${s.id}/appScreenshots?limit=50`)).data;
      console.log(
        `${loc.attributes.locale.padEnd(7)} ${s.attributes.screenshotDisplayType.padEnd(14)} ${String(shots.length).padStart(2)} Bilder [${[
          ...new Set(shots.map((x) => x.attributes.assetDeliveryState?.state ?? '?')),
        ].join(', ')}]`,
      );
      for (const x of shots) {
        const a = x.attributes;
        console.log(`    ${String(a.fileName).padEnd(20)} ${a.imageAsset?.width ?? '?'}x${a.imageAsset?.height ?? '?'}  ${a.assetDeliveryState?.state ?? '?'}`);
      }
    }
  }
  process.exit(0);
}

async function hochladen(satzId, bild) {
  const reserviert = (
    await asc('/appScreenshots', {
      method: 'POST',
      body: {
        data: {
          type: 'appScreenshots',
          attributes: { fileName: bild.name, fileSize: bild.groesse },
          relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: satzId } } },
        },
      },
    })
  ).data;
  const ops = reserviert.attributes.uploadOperations ?? [];
  if (!ops.length) throw new Error(`Keine uploadOperations fuer ${bild.name}`);

  const daten = fs.readFileSync(bild.pfad);
  for (const op of ops) {
    const teil = daten.subarray(op.offset, op.offset + op.length);
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const r = await fetch(op.url, { method: op.method, headers, body: teil });
    if (!r.ok) throw new Error(`Upload ${bild.name} -> HTTP ${r.status}`);
  }

  const md5 = crypto.createHash('md5').update(daten).digest('hex');
  const abschluss = () =>
    asc(`/appScreenshots/${reserviert.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appScreenshots', id: reserviert.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } },
    });
  await abschluss();

  const bis = Date.now() + 10 * 60 * 1000;
  let nachgereicht = 0;
  for (let versuch = 0; Date.now() < bis; versuch++) {
    await new Promise((r) => setTimeout(r, 5000));
    let attr;
    try {
      attr = (await lies(`/appScreenshots/${reserviert.id}`)).data.attributes;
    } catch {
      continue;
    }
    const s = attr.assetDeliveryState;
    if (s?.state === 'COMPLETE') return;
    if (s?.state === 'FAILED') {
      throw new Error(`${bild.name} von Apple abgelehnt: ${(s.errors ?? []).map((e) => e.code).join(', ')}`);
    }
    if (!attr.sourceFileChecksum && versuch >= 3 && nachgereicht < 3) {
      nachgereicht += 1;
      await abschluss();
    }
  }
  throw new Error(`${bild.name}: nicht COMPLETE nach 10 Minuten`);
}

const uebersprungen = [];
for (const loc of locs.data) {
  const locale = loc.attributes.locale;
  const ordner = SPRACHEN[locale];
  const bilder = ordner ? lokaleBilder(ordner) : [];
  if (!bilder.length) {
    uebersprungen.push(`${locale}: keine lokalen Bilder`);
    continue;
  }
  const falsch = bilder.filter((b) => !MASSE.some(([w, h]) => b.masse[0] === w && b.masse[1] === h));
  if (falsch.length) {
    uebersprungen.push(`${locale}: ${falsch.length} Bilder in falscher Groesse (${falsch[0].masse.join('x')})`);
    continue;
  }

  console.log(`\n== ${locale} (${bilder.length} Bilder)`);
  const saetze = (await asc(`/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
  let satz = saetze.find((s) => s.attributes.screenshotDisplayType === KLASSE);
  if (satz) {
    // Alte Bilder weg, sonst haengt der neue Satz hinter den alten.
    for (const alt of (await asc(`/appScreenshotSets/${satz.id}/appScreenshots?limit=50`)).data) {
      await asc(`/appScreenshots/${alt.id}`, { method: 'DELETE' });
    }
  } else {
    satz = (
      await asc('/appScreenshotSets', {
        method: 'POST',
        body: {
          data: {
            type: 'appScreenshotSets',
            attributes: { screenshotDisplayType: KLASSE },
            relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc.id } } },
          },
        },
      })
    ).data;
  }

  for (const bild of bilder) {
    process.stdout.write(`  ${bild.name} … `);
    await hochladen(satz.id, bild);
    console.log('ok');
  }
}

console.log('\nZurueckgelesen von Apple:');
for (const loc of locs.data) {
  const saetze = (await lies(`/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`)).data;
  const satz = saetze.find((s) => s.attributes.screenshotDisplayType === KLASSE);
  if (!satz) {
    console.log(`  ${loc.attributes.locale.padEnd(7)} kein Satz`);
    continue;
  }
  const shots = (await lies(`/appScreenshotSets/${satz.id}/appScreenshots?limit=50`)).data;
  const zustaende = [...new Set(shots.map((x) => x.attributes.assetDeliveryState?.state ?? '?'))];
  console.log(
    `  ${loc.attributes.locale.padEnd(7)} ${String(shots.length).padStart(2)} Bilder, ${shots[0]?.attributes.imageAsset?.width ?? '?'}x${shots[0]?.attributes.imageAsset?.height ?? '?'} [${zustaende.join(', ')}]`,
  );
}
for (const z of uebersprungen) console.log(`  uebersprungen — ${z}`);
void token;
