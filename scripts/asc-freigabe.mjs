#!/usr/bin/env node
// Setzt alles, was Apple ausser den Texten noch verlangt, bevor eine App zur
// Pruefung darf: Altersfreigabe, Angaben fuer die Pruefer, Preis (kostenlos)
// und Verfuegbarkeit (alle Laender).
//
// Wiederholbar; liest am Ende zurueck, was bei Apple wirklich steht.
//
// Usage: node scripts/asc-freigabe.mjs [--pruefen]
import { asc, ascAlle, APP_ID } from './lib/asc.mjs';

const NUR_PRUEFEN = process.argv.includes('--pruefen');

const version = (await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=TV_OS&limit=1`)).data[0];
const info = (await asc(`/apps/${APP_ID}/appInfos?limit=10`)).data.find(
  (a) => a.attributes.appStoreState !== 'READY_FOR_SALE',
);
console.log(`Version ${version.attributes.versionString} (${version.id}), Auftritt ${info.id}`);

// ── Altersfreigabe ──────────────────────────────────────────────────────────
// Wortgleich mit der Handy-App (Salati, 6791867298): dieselben Inhalte, also
// dieselbe Einstufung — 4+. Nichts davon ist eine Vermutung: die App zeigt
// Gebetszeiten, Korantext, Rezitationen und Lernvideos aus eigener Redaktion.
const ALTER = {
  advertising: false,
  alcoholTobaccoOrDrugUseOrReferences: 'NONE',
  contests: 'NONE',
  gambling: false,
  gamblingSimulated: 'NONE',
  gunsOrOtherWeapons: 'NONE',
  healthOrWellnessTopics: false,
  lootBox: false,
  medicalOrTreatmentInformation: 'NONE',
  messagingAndChat: false,
  parentalControls: false,
  profanityOrCrudeHumor: 'NONE',
  ageAssurance: false,
  sexualContentGraphicAndNudity: 'NONE',
  sexualContentOrNudity: 'NONE',
  socialMedia: false,
  socialMediaAgeRestricted: false,
  horrorOrFearThemes: 'NONE',
  matureOrSuggestiveThemes: 'NONE',
  unrestrictedWebAccess: false,
  userGeneratedContent: false,
  violenceCartoonOrFantasy: 'NONE',
  violenceRealisticProlongedGraphicOrSadistic: 'NONE',
  violenceRealistic: 'NONE',
  ageRatingOverride: 'NONE',
  koreaAgeRatingOverride: 'NONE',
};

if (!NUR_PRUEFEN) {
  await asc(`/ageRatingDeclarations/${info.id}`, {
    method: 'PATCH',
    body: { data: { type: 'ageRatingDeclarations', id: info.id, attributes: ALTER } },
  });
  console.log('Altersfreigabe gesetzt');
}

// ── Angaben fuer die Pruefer ────────────────────────────────────────────────
const PRUEFER = {
  contactFirstName: 'Domenic',
  contactLastName: 'Moran',
  contactPhone: '+493076764546',
  contactEmail: 'menucloudberlin@gmail.com',
  demoAccountRequired: false,
  notes: [
    'Alle Funktionen sind ohne Konto und ohne Anmeldung nutzbar.',
    'Die App laeuft eigenstaendig auf dem Apple TV; ein Telefon wird nicht gebraucht.',
    'Der Bildschirm „Kopplung" oeffnet einen TCP-Server im lokalen Netz (Port 8787),',
    'damit die Salati-App auf einem Telefon im selben WLAN den Fernseher steuern kann.',
    'Deshalb fragt die App beim ersten Oeffnen dieses Bildschirms nach dem Zugriff auf',
    'das lokale Netz. Es werden dabei keine Daten ins Internet gesendet.',
    'Gebetszeiten werden auf dem Geraet gerechnet; Medien (Rezitationen, Radio, Videos)',
    'kommen von der eigenen Infrastruktur ueber HTTPS.',
  ].join(' '),
};

if (!NUR_PRUEFEN) {
  const vorhanden = (await asc(`/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  if (vorhanden) {
    await asc(`/appStoreReviewDetails/${vorhanden.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appStoreReviewDetails', id: vorhanden.id, attributes: PRUEFER } },
    });
  } else {
    await asc('/appStoreReviewDetails', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreReviewDetails',
          attributes: PRUEFER,
          relationships: {
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      },
    });
  }
  console.log('Angaben fuer die Pruefer gesetzt');
}

// ── Preis: kostenlos ────────────────────────────────────────────────────────
let preisGesetzt = (await asc(`/appPriceSchedules/${APP_ID}/manualPrices?limit=1`).catch(() => null))?.data?.length;
if (!preisGesetzt && !NUR_PRUEFEN) {
  const punkte = await asc(`/apps/${APP_ID}/appPricePoints?filter[territory]=USA&limit=200`);
  const kostenlos = punkte.data.find((p) => Number(p.attributes.customerPrice) === 0);
  if (!kostenlos) throw new Error('Kein Preispunkt 0,00 gefunden');
  await asc('/appPriceSchedules', {
    method: 'POST',
    body: {
      data: {
        type: 'appPriceSchedules',
        relationships: {
          app: { data: { type: 'apps', id: APP_ID } },
          baseTerritory: { data: { type: 'territories', id: 'USA' } },
          manualPrices: { data: [{ type: 'appPrices', id: '${preis}' }] },
        },
      },
      included: [
        {
          type: 'appPrices',
          id: '${preis}',
          relationships: { appPricePoint: { data: { type: 'appPricePoints', id: kostenlos.id } } },
        },
      ],
    },
  });
  console.log('Preis gesetzt: kostenlos');
  preisGesetzt = 1;
}

// ── Verfuegbarkeit: alle Laender ────────────────────────────────────────────
let verfuegbar = await asc(`/apps/${APP_ID}/appAvailabilityV2`).catch(() => null);
if (!verfuegbar?.data && !NUR_PRUEFEN) {
  const laender = await ascAlle('/territories?limit=200');
  await asc('https://api.appstoreconnect.apple.com/v2/appAvailabilities', {
    method: 'POST',
    body: {
      data: {
        type: 'appAvailabilities',
        attributes: { availableInNewTerritories: true },
        relationships: {
          app: { data: { type: 'apps', id: APP_ID } },
          territoryAvailabilities: {
            data: laender.map((l) => ({ type: 'territoryAvailabilities', id: `\${${l.id}}` })),
          },
        },
      },
      included: laender.map((l) => ({
        type: 'territoryAvailabilities',
        id: `\${${l.id}}`,
        attributes: { available: true },
        relationships: { territory: { data: { type: 'territories', id: l.id } } },
      })),
    },
  });
  console.log(`Verfuegbarkeit gesetzt: ${laender.length} Laender`);
  verfuegbar = await asc(`/apps/${APP_ID}/appAvailabilityV2`).catch(() => null);
}

// ── Zurueckgelesen ──────────────────────────────────────────────────────────
console.log('\nZurueckgelesen von Apple:');
const a = (await asc(`/appInfos/${info.id}/ageRatingDeclaration`)).data.attributes;
console.log(`  Altersangaben gesetzt: ${Object.values(a).filter((x) => x !== null).length} von ${Object.keys(a).length}`);
const p = (await asc(`/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
console.log(`  Pruefer-Kontakt: ${p ? `${p.attributes.contactEmail}, Demo-Konto noetig: ${p.attributes.demoAccountRequired}` : 'FEHLT'}`);
const preise = await asc(`/appPriceSchedules/${APP_ID}/manualPrices?include=appPricePoint&limit=5`).catch(() => null);
const punkt = preise?.included?.[0]?.attributes?.customerPrice;
console.log(`  Preis: ${preise?.data?.length ? `${punkt} (Basis USA)` : 'FEHLT'}`);
const vv = await asc(`/apps/${APP_ID}/appAvailabilityV2`).catch(() => null);
if (vv?.data) {
  const t = await asc(
    `https://api.appstoreconnect.apple.com/v2/appAvailabilities/${APP_ID}/territoryAvailabilities?limit=200`,
  );
  console.log(
    `  Verfuegbarkeit: ${t.data.filter((x) => x.attributes.available).length} Laender, neue Laender automatisch: ${vv.data.attributes.availableInNewTerritories}`,
  );
} else {
  console.log('  Verfuegbarkeit: FEHLT');
}
