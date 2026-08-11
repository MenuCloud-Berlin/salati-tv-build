#!/usr/bin/env node
// Traegt den Datenschutztext bei Apple ein.
//
// Warum als TEXT und nicht als Adresse: Apple verlangt fuer tvOS zusaetzlich
// `privacyPolicyText` und weist die Einreichung sonst ab
// (ENTITY_ERROR.ATTRIBUTE.REQUIRED). Der Grund liegt am Geraet: auf einem
// Fernseher gibt es keinen Browser, in dem sich eine verlinkte Erklaerung
// oeffnen liesse.
//
// Die Quelle ist dieselbe, aus der die Handy-App ihre Datenschutzseite baut
// (apps/mobile/src/locales/<sprache>.json, Abschnitt `datenschutz`) und die
// Reihenfolge dieselbe wie in `apps/mobile/src/app/datenschutz.tsx`. Damit gibt
// es weiterhin genau EINEN Text, der gepflegt wird.
//
// Usage: node scripts/asc-datenschutztext.mjs [--pruefen]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { asc, APP_ID } from './lib/asc.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(HIER, '..', '..', 'mobile', 'src', 'locales');
const NUR_PRUEFEN = process.argv.includes('--pruefen');

// ASC-Sprache -> Sprachdatei der Handy-App.
const SPRACHEN = { 'de-DE': 'de', 'en-US': 'en', tr: 'tr', 'ar-SA': 'ar' };

// Reihenfolge wie auf der Datenschutzseite der App.
const ABSCHNITTE = [
  'controller',
  'noCollection',
  'location',
  'notifications',
  'thirdParty',
  'ownInfra',
  'ai',
  'storage',
  'sync',
  'legalBasis',
  'retention',
  'transfer',
  'rights',
  'cookies',
  'changes',
];

function baueText(sprache) {
  const datei = path.join(LOCALES, `${sprache}.json`);
  const d = JSON.parse(fs.readFileSync(datei, 'utf8')).datenschutz;
  if (!d) throw new Error(`Kein Abschnitt „datenschutz" in ${datei}`);
  const teile = [d.title, d.subtitle, d.lastUpdated, '', d.intro];
  for (const a of ABSCHNITTE) {
    const kopf = d[`${a}Section`];
    const text = d[`${a}Text`];
    if (!kopf || !text) throw new Error(`${sprache}: Abschnitt ${a} fehlt`);
    teile.push('', kopf.toUpperCase(), text);
  }
  return teile.join('\n').trim();
}

// Der Text haengt am AUFTRITT, nicht an der Version: `privacyPolicyText` ist
// kein Feld von `appStoreVersionLocalizations` (Apple: „unknown attribute"),
// sondern von `appInfoLocalizations`.
const info = (await asc(`/apps/${APP_ID}/appInfos?limit=10`)).data.find(
  (a) => a.attributes.appStoreState !== 'READY_FOR_SALE',
);
const locs = await asc(`/appInfos/${info.id}/appInfoLocalizations?limit=50`);

for (const loc of locs.data) {
  const sprache = SPRACHEN[loc.attributes.locale];
  if (!sprache) {
    console.log(`${loc.attributes.locale}: keine Quelle hinterlegt`);
    continue;
  }
  const text = baueText(sprache);
  if (NUR_PRUEFEN) {
    console.log(`${loc.attributes.locale}: ${text.length} Zeichen (bei Apple: ${loc.attributes.privacyPolicyText?.length ?? 0})`);
    continue;
  }
  await asc(`/appInfoLocalizations/${loc.id}`, {
    method: 'PATCH',
    body: { data: { type: 'appInfoLocalizations', id: loc.id, attributes: { privacyPolicyText: text } } },
  });
  console.log(`${loc.attributes.locale}: ${text.length} Zeichen eingetragen`);
}

console.log('\nZurueckgelesen von Apple:');
const nach = await asc(`/appInfos/${info.id}/appInfoLocalizations?limit=50`);
for (const l of nach.data) {
  console.log(`  ${l.attributes.locale.padEnd(7)} ${String(l.attributes.privacyPolicyText?.length ?? 0).padStart(6)} Zeichen`);
}
