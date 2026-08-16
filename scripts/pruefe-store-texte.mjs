#!/usr/bin/env node
// Prueft die Store-Unterlagen, bevor sie zu Apple oder Google gehen.
//
// Vier Fehler haben diese Datei erzwungen; alle vier fallen erst beim
// Pruefer auf, wenn sie hier niemand abfaengt:
//
//  1. Zwei Textquellen, die auseinanderlaufen (die Play-Beschreibung war vier
//     Versionen alt). Deshalb gibt es nur noch store/texte/ — und die Pruefung
//     stellt sicher, dass jede Sprache dort vollstaendig ist.
//  2. Apple lehnt Beschreibungen ab, die auf fremde Plattformen verweisen
//     (Richtlinie 2.3.10). Umgekehrt waere ein Play-Eintrag, der von Apple TV
//     spricht, schlicht falsch.
//  3. Gedankenstriche lassen einen Text nach Maschine klingen.
//  4. Eine fehlende Bildunterschrift laesst `store-bilder.py` das Bild still
//     ueberspringen — der Store zeigt dann sieben statt acht Bildern.
//
// Usage: node scripts/pruefe-store-texte.mjs
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { texteFuer } from './lib/store-texte.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const TV = path.join(HIER, '..');

const SPRACHEN = ['de', 'en', 'tr', 'ar'];
const BILDSCHIRME = ['clock', 'home', 'quran', 'reciters', 'radio', 'videos', 'quiz', 'settings'];

// Woerter, die im jeweils anderen Laden nichts zu suchen haben.
const VERBOTEN = {
  apple: ['Android', 'Google TV', 'Google Play', 'Play Store', 'Fire TV'],
  play: ['Apple TV', 'App Store', 'iPhone', 'iPad', 'tvOS'],
};

const fehler = [];
const pruefe = (bedingung, meldung) => {
  if (!bedingung) fehler.push(meldung);
};

// ── Texte ───────────────────────────────────────────────────────────────────
for (const laden of ['apple', 'play']) {
  // `texteFuer` bricht selbst ab bei zu langen Feldern, leeren Feldern,
  // Gedankenstrichen und unaufgeloesten Platzhaltern.
  const texte = texteFuer(laden);
  pruefe(texte.length === SPRACHEN.length, `${laden}: ${texte.length} Sprachen, erwartet ${SPRACHEN.length}`);

  for (const t of texte) {
    const alles = [t.description, t.subtitle, t.kurz, t.promotionalText, t.titelPlay, t.name].join('\n');
    for (const wort of VERBOTEN[laden]) {
      pruefe(!alles.includes(wort), `${laden}/${t.locale}: „${wort}" steht im Text`);
    }
  }
  console.log(`${laden.padEnd(6)} ${texte.length} Sprachen, Laengen und Wortwahl in Ordnung`);
}

// ── Bildunterschriften ──────────────────────────────────────────────────────
const unterschriften = JSON.parse(fs.readFileSync(path.join(TV, 'store', 'screenshot-texte.json'), 'utf8'));
for (const sprache of SPRACHEN) {
  const s = unterschriften[sprache];
  pruefe(!!s, `Bildunterschriften: Sprache ${sprache} fehlt`);
  if (!s) continue;
  for (const bildschirm of BILDSCHIRME) {
    const zeilen = s[bildschirm];
    pruefe(Array.isArray(zeilen) && zeilen.length === 2 && zeilen.every(Boolean),
      `Bildunterschrift ${sprache}/${bildschirm} fehlt oder ist unvollstaendig`);
    if (Array.isArray(zeilen)) {
      for (const z of zeilen) pruefe(!String(z).includes('—'), `Bildunterschrift ${sprache}/${bildschirm}: Gedankenstrich`);
    }
  }
}
console.log(`Unterschriften  ${SPRACHEN.length} Sprachen x ${BILDSCHIRME.length} Bildschirme`);

// ── Bilder ──────────────────────────────────────────────────────────────────
function masse(datei) {
  const kopf = Buffer.alloc(24);
  const fd = fs.openSync(datei, 'r');
  fs.readSync(fd, kopf, 0, 24, 0);
  fs.closeSync(fd);
  return [kopf.readUInt32BE(16), kopf.readUInt32BE(20)];
}

for (const [name, ordner] of [
  ['Apple TV', path.join(TV, 'screenshots', 'store', 'appletv')],
  ['Android TV', path.join(TV, 'screenshots', 'store', 'androidtv')],
]) {
  if (!fs.existsSync(ordner)) {
    fehler.push(`${name}: ${ordner} fehlt`);
    continue;
  }
  let gezaehlt = 0;
  for (const sprache of SPRACHEN) {
    const dir = path.join(ordner, sprache);
    const bilder = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png')) : [];
    pruefe(bilder.length === BILDSCHIRME.length, `${name}/${sprache}: ${bilder.length} Bilder, erwartet ${BILDSCHIRME.length}`);
    for (const b of bilder) {
      const [w, h] = masse(path.join(dir, b));
      pruefe(w === 1920 && h === 1080, `${name}/${sprache}/${b} ist ${w}x${h}, erwartet 1920x1080`);
      gezaehlt += 1;
    }
  }
  console.log(`${name.padEnd(11)} ${gezaehlt} Bilder in 1920x1080`);
}

if (fehler.length) {
  console.error(`\n${fehler.length} Befund(e):`);
  for (const f of fehler) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\nAlles in Ordnung.');
