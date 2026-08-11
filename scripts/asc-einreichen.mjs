#!/usr/bin/env node
// Reicht die tvOS-Version bei Apple zur Pruefung ein.
//
// Der Ablauf und die Vorsicht darin stammen aus apps/mobile/scripts/asc-release.mjs:
// Apples `reviewSubmissions` kann WAITING_FOR_REVIEW melden, waehrend die
// Version auf PREPARE_FOR_SUBMISSION stehen bleibt. In App Store Connect ist
// das ein leerer Uebermittlungsentwurf, und er SPERRT zusaetzlich den Knopf
// „Zur Pruefung hinzufuegen". Deshalb wird nur eine wirklich leere, noch nicht
// abgeschickte Einreichung wiederverwendet, und nach dem Absenden wird
// nachgesehen, ob die Version den Zustand verlassen hat.
//
// Usage: node scripts/asc-einreichen.mjs
import { asc, APP_ID } from './lib/asc.mjs';

const version = (await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=TV_OS&limit=1`)).data[0];
const stand = version.attributes.appStoreState;
console.log(`Version ${version.attributes.versionString}: ${stand}, releaseType ${version.attributes.releaseType}`);

if (stand !== 'PREPARE_FOR_SUBMISSION') {
  console.log('Nichts zu tun: die Version ist nicht (mehr) im bearbeitbaren Zustand.');
  process.exit(0);
}

const build = (await asc(`/appStoreVersions/${version.id}/build`)).data;
if (!build) throw new Error('An der Version haengt kein Build.');
console.log(`Build ${build.attributes.version} (${build.attributes.processingState})`);

// Nur eine LEERE, noch nicht abgeschickte Einreichung wiederverwenden.
const offen = await asc(
  `/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW&limit=10`,
).catch(() => ({ data: [] }));
let einreichung = null;
for (const kandidat of offen.data ?? []) {
  if (kandidat.attributes.submittedDate) continue;
  const inhalt = await asc(`/reviewSubmissions/${kandidat.id}/items?limit=10`).catch(() => ({ data: [] }));
  if ((inhalt.data ?? []).length === 0) {
    einreichung = kandidat;
    break;
  }
}
if (einreichung) {
  console.log(`Bestehende leere Einreichung wiederverwendet (${einreichung.id})`);
} else {
  einreichung = (
    await asc('/reviewSubmissions', {
      method: 'POST',
      body: {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'TV_OS' },
          relationships: { app: { data: { type: 'apps', id: APP_ID } } },
        },
      },
    })
  ).data;
  console.log(`Einreichung angelegt (${einreichung.id})`);
}

const items = await asc(`/reviewSubmissions/${einreichung.id}/items?limit=10`).catch(() => ({ data: [] }));
if (!(items.data ?? []).some((i) => i.relationships?.appStoreVersion?.data?.id === version.id)) {
  await asc('/reviewSubmissionItems', {
    method: 'POST',
    body: {
      data: {
        type: 'reviewSubmissionItems',
        relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: einreichung.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
        },
      },
    },
  });
  console.log('Version an die Einreichung gehaengt');
}

await asc(`/reviewSubmissions/${einreichung.id}`, {
  method: 'PATCH',
  body: { data: { type: 'reviewSubmissions', id: einreichung.id, attributes: { submitted: true } } },
});

let danach = null;
for (let versuch = 0; versuch < 8; versuch++) {
  await new Promise((r) => setTimeout(r, 5000));
  danach = (await asc(`/appStoreVersions/${version.id}`)).data.attributes.appStoreState;
  if (danach !== 'PREPARE_FOR_SUBMISSION') break;
}

if (danach === 'PREPARE_FOR_SUBMISSION') {
  console.error('\nFEHLGESCHLAGEN: abgeschickt, aber die Version steht weiter auf PREPARE_FOR_SUBMISSION.');
  console.error('Das ist der bekannte leere Uebermittlungsentwurf. Weg heraus:');
  console.error(`  1. PATCH /reviewSubmissions/${einreichung.id} mit attributes.canceled = true`);
  console.error('  2. In App Store Connect auf der Version „Zur Pruefung hinzufuegen" -> Entwurf waehlen');
  console.error('  3. Im Entwurfs-Fenster uebermitteln');
  process.exit(1);
}

const fertig = (await asc(`/appStoreVersions/${version.id}`)).data.attributes;
console.log(`\nEingereicht. Version ${fertig.versionString}: ${fertig.appStoreState}, releaseType ${fertig.releaseType}`);
