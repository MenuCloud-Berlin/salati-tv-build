#!/usr/bin/env node
// Haengt den neuesten fertig verarbeiteten Build an die tvOS-Version und liest
// zurueck, ob er wirklich dranhaengt.
//
// Usage: node scripts/asc-build-anhaengen.mjs [buildNummer]
import { asc, APP_ID } from './lib/asc.mjs';

const gewuenscht = process.argv[2];

const builds = await asc(`/builds?filter[app]=${APP_ID}&limit=20&sort=-uploadedDate`);
const brauchbar = builds.data.filter((b) => b.attributes.processingState === 'VALID');
const build = gewuenscht
  ? brauchbar.find((b) => b.attributes.version === gewuenscht)
  : brauchbar[0];
if (!build) {
  console.error(
    `Kein verarbeiteter Build gefunden. Vorhanden: ${builds.data
      .map((b) => `${b.attributes.version} (${b.attributes.processingState})`)
      .join(', ') || 'keiner'}`,
  );
  process.exit(1);
}

const version = (await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=TV_OS&limit=1`)).data[0];
console.log(`Version ${version.attributes.versionString} (${version.attributes.appStoreState}) <- Build ${build.attributes.version}`);

await asc(`/appStoreVersions/${version.id}/relationships/build`, {
  method: 'PATCH',
  body: { data: { type: 'builds', id: build.id } },
});

// Zurueckgelesen — die Meldung des eigenen Aufrufs ist kein Beleg.
const dran = await asc(`/appStoreVersions/${version.id}/build`);
console.log(
  dran.data
    ? `Angehaengt: Build ${dran.data.attributes.version}, ${dran.data.attributes.processingState}`
    : 'FEHLT — es haengt kein Build an der Version',
);
