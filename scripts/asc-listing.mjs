#!/usr/bin/env node
// Traegt die Store-Seite von Salati TV bei Apple ein: Auftritt (Name,
// Untertitel, Datenschutz, Kategorie) und Versionstexte (Beschreibung,
// Stichwoerter, Werbetext, Adressen) in allen Sprachen aus store/texte/.
//
// Wiederholbar: was existiert, wird geaendert statt neu angelegt. Am Ende wird
// alles von Apple ZURUECKGELESEN — nicht dem eigenen Protokoll geglaubt.
//
// Texte kommen aus store/texte/ (s. scripts/lib/store-texte.mjs).
//
// Usage: node scripts/asc-listing.mjs [--pruefen]
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { asc, APP_ID } from './lib/asc.mjs';
import { texteFuer } from './lib/store-texte.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const NUR_PRUEFEN = process.argv.includes('--pruefen');
const KATEGORIE = 'LIFESTYLE'; // wie die Handy-App
const COPYRIGHT = '© 2026 Domenic Moran';

const version = /version: '([^']+)'/.exec(
  fs.readFileSync(path.join(HIER, '..', 'app.config.js'), 'utf8'),
)?.[1];
if (!version) throw new Error('Versionsnummer nicht aus app.config.js lesbar');

// Dieselbe Quelle wie der Play-Eintrag; `{{GERAET}}` wird hier zu „Apple TV"
// aufgeloest. Apple duldet in der Beschreibung keinen Verweis auf fremde
// Plattformen (Richtlinie 2.3.10).
const sprachen = texteFuer('apple');

// ── Version (tvOS) ──────────────────────────────────────────────────────────
const versionen = await asc(`/apps/${APP_ID}/appStoreVersions?filter[platform]=TV_OS&limit=10`);
let v = versionen.data.find((x) => x.attributes.versionString === version) ?? versionen.data[0] ?? null;

if (!v && !NUR_PRUEFEN) {
  const r = await asc('/appStoreVersions', {
    method: 'POST',
    body: {
      data: {
        type: 'appStoreVersions',
        attributes: { platform: 'TV_OS', versionString: version, releaseType: 'AFTER_APPROVAL', copyright: COPYRIGHT },
        relationships: { app: { data: { type: 'apps', id: APP_ID } } },
      },
    },
  });
  v = r.data;
  console.log(`Version angelegt: ${version} (${v.id})`);
} else if (v) {
  console.log(`Version vorhanden: ${v.attributes.versionString} — ${v.attributes.appStoreState} (${v.id})`);
  // Apple legt zu einem neuen App-Datensatz von sich aus eine „1.0" an. Die
  // Nummer MUSS zur CFBundleShortVersionString des hochgeladenen Programms
  // passen, sonst laesst sich kein Build anhaengen.
  //
  // releaseType wird bewusst bei JEDEM Lauf gesetzt: eine Version auf MANUAL
  // bleibt nach Apples Freigabe stumm liegen, ohne dass irgendetwas warnt.
  const patch = {};
  if (v.attributes.versionString !== version) patch.versionString = version;
  // Ohne Urheberrechtszeile weist Apple die Einreichung ab
  // (ENTITY_ERROR.ATTRIBUTE.REQUIRED, 'copyright'). Gleiche Zeile wie bei der
  // Handy-App.
  if (v.attributes.copyright !== COPYRIGHT) patch.copyright = COPYRIGHT;
  if (v.attributes.releaseType !== 'AFTER_APPROVAL') patch.releaseType = 'AFTER_APPROVAL';
  if (!NUR_PRUEFEN && Object.keys(patch).length) {
    await asc(`/appStoreVersions/${v.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appStoreVersions', id: v.id, attributes: patch } },
    });
    console.log(`Version angepasst: ${JSON.stringify(patch)}`);
  }
}
if (!v) throw new Error('Keine tvOS-Version vorhanden');

// ── Auftritt (gilt fuer die ganze App, nicht je Version) ────────────────────
const appInfos = await asc(`/apps/${APP_ID}/appInfos?limit=10`);
// Der bearbeitbare Auftritt ist der, der NICHT im Verkauf steht.
const info =
  appInfos.data.find((a) => a.attributes.appStoreState !== 'READY_FOR_SALE') ?? appInfos.data[0];
console.log(`Auftritt: ${info.id} (${info.attributes.appStoreState})`);

if (!NUR_PRUEFEN) {
  await asc(`/appInfos/${info.id}`, {
    method: 'PATCH',
    body: {
      data: {
        type: 'appInfos',
        id: info.id,
        relationships: { primaryCategory: { data: { type: 'appCategories', id: KATEGORIE } } },
      },
    },
  });
  console.log(`Kategorie: ${KATEGORIE}`);
}

// ── Texte je Sprache ────────────────────────────────────────────────────────
// ZWEI Durchgaenge, nicht einer je Sprache: legt man eine Sprache im Auftritt
// an, erzeugt Apple die zugehoerige Versions-Sprache gleich mit. Eine vorher
// geholte Liste ist danach veraltet, und der Versuch, sie anzulegen, endet mit
// 409 „Entity with locale … already exists".
const infoLocs = await asc(`/appInfos/${info.id}/appInfoLocalizations?limit=50`);

for (const t of sprachen) {
  const auftritt = { name: t.name, subtitle: t.subtitle, privacyPolicyUrl: t.privacyPolicyUrl };
  const vorhandenInfo = infoLocs.data.find((l) => l.attributes.locale === t.locale);

  if (NUR_PRUEFEN) {
    console.log(`${t.locale}: Auftritt ${vorhandenInfo ? 'da' : 'FEHLT'}`);
    continue;
  }

  if (vorhandenInfo) {
    await asc(`/appInfoLocalizations/${vorhandenInfo.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appInfoLocalizations', id: vorhandenInfo.id, attributes: auftritt } },
    });
  } else {
    await asc('/appInfoLocalizations', {
      method: 'POST',
      body: {
        data: {
          type: 'appInfoLocalizations',
          attributes: { locale: t.locale, ...auftritt },
          relationships: { appInfo: { data: { type: 'appInfos', id: info.id } } },
        },
      },
    });
  }
  console.log(`${t.locale}: Auftritt eingetragen`);
}

const verLocs = await asc(`/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);

for (const t of sprachen) {
  const texte = {
    description: t.description,
    keywords: t.keywords,
    promotionalText: t.promotionalText,
    supportUrl: t.supportUrl,
    marketingUrl: t.marketingUrl,
  };
  const vorhanden = verLocs.data.find((l) => l.attributes.locale === t.locale);

  if (NUR_PRUEFEN) {
    console.log(`${t.locale}: Texte ${vorhanden ? 'da' : 'FEHLEN'}`);
    continue;
  }

  if (vorhanden) {
    await asc(`/appStoreVersionLocalizations/${vorhanden.id}`, {
      method: 'PATCH',
      body: { data: { type: 'appStoreVersionLocalizations', id: vorhanden.id, attributes: texte } },
    });
  } else {
    await asc('/appStoreVersionLocalizations', {
      method: 'POST',
      body: {
        data: {
          type: 'appStoreVersionLocalizations',
          attributes: { locale: t.locale, ...texte },
          relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: v.id } } },
        },
      },
    });
  }
  console.log(`${t.locale}: Texte eingetragen`);
}

// ── Zurueckgelesen ──────────────────────────────────────────────────────────
console.log('\nZurueckgelesen von Apple:');
const nachInfo = await asc(`/appInfos/${info.id}/appInfoLocalizations?limit=50`);
const nachVer = await asc(`/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
for (const l of nachInfo.data) {
  const w = nachVer.data.find((x) => x.attributes.locale === l.attributes.locale);
  console.log(
    `  ${l.attributes.locale.padEnd(7)} ${String(l.attributes.name).padEnd(12)} | ${String(l.attributes.subtitle ?? '').slice(0, 32).padEnd(32)} | Beschreibung ${w?.attributes.description?.length ?? 0} Z. | Stichworte ${w?.attributes.keywords?.length ?? 0} Z.`,
  );
}
const nachV = await asc(`/appStoreVersions/${v.id}`);
console.log(
  `  Version ${nachV.data.attributes.versionString} · ${nachV.data.attributes.appStoreState} · releaseType ${nachV.data.attributes.releaseType}`,
);
