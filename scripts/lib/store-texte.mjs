// EINE Quelle fuer die Store-Texte beider Laeden.
//
// Vorher gab es zwei: `store/listing/*.md` fuer Play und `store/appstore/*.json`
// fuer Apple. Sie sind auseinandergelaufen — die Play-Texte beschrieben am
// 2026-08-11 noch den Stand von 1.4.0 (kein Korantext im Paket, keine acht
// Schriften, kein Gebetsruf, keine gespeicherten Rezitationen), weil beim
// Pflegen der einen Datei die andere schlicht vergessen wurde. Zwei Quellen
// fuer denselben Text laufen immer auseinander; die Frage ist nur, wann es
// jemand merkt.
//
// Unterschiedlich ist zwischen den Laeden nur das Geraet: Apple duldet in einer
// App-Store-Beschreibung keinen Verweis auf fremde Plattformen (Richtlinie
// 2.3.10), und ein Play-Eintrag, der von Apple TV spricht, waere schlicht falsch.
// Dafuer steht `{{GERAET}}` im Text.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const QUELLE = path.join(HIER, '..', '..', 'store', 'texte');

const GERAET = {
  apple: {
    'de-DE': 'deinen Apple TV',
    'en-US': 'your Apple TV',
    tr: "Apple TV'nize",
    'ar-SA': 'Apple TV',
  },
  play: {
    'de-DE': 'dein Android-TV oder Google-TV',
    'en-US': 'your Android TV or Google TV',
    tr: "Android TV veya Google TV'nize",
    'ar-SA': 'تلفاز أندرويد أو Google TV',
  },
};

/** Obergrenzen der Laeden. Ueberschritten wird abgebrochen, nicht gekuerzt. */
const GRENZEN = {
  apple: { name: 30, subtitle: 30, keywords: 100, promotionalText: 170, description: 4000 },
  play: { titelPlay: 30, kurz: 80, description: 4000 },
};

export function alleTexte() {
  return fs
    .readdirSync(QUELLE)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(QUELLE, f), 'utf8')));
}

/**
 * Texte eines Ladens: `{{GERAET}}` aufgeloest, Laengen geprueft.
 * @param {'apple'|'play'} laden
 */
export function texteFuer(laden) {
  return alleTexte().map((t) => {
    const geraet = GERAET[laden][t.locale];
    if (!geraet) throw new Error(`Kein Geraetewort fuer ${laden}/${t.locale}`);
    const aufgeloest = { ...t, description: t.description.replaceAll('{{GERAET}}', geraet) };

    for (const [feld, max] of Object.entries(GRENZEN[laden])) {
      const laenge = [...(aufgeloest[feld] ?? '')].length;
      if (laenge === 0) throw new Error(`${t.locale}: ${feld} ist leer`);
      if (laenge > max) throw new Error(`${t.locale}: ${feld} ist ${laenge} Zeichen, erlaubt sind ${max}`);
    }
    if (aufgeloest.description.includes('{{')) throw new Error(`${t.locale}: unaufgeloeste Platzhalter`);
    // Gedankenstriche sind das deutlichste Merkmal maschinell geschriebener
    // Texte. Nichts Oeffentliches darf sie tragen.
    const strich = Object.values(aufgeloest).find((w) => typeof w === 'string' && w.includes('—'));
    if (strich) throw new Error(`${t.locale}: Gedankenstrich im Text (${String(strich).slice(0, 60)}…)`);
    return aufgeloest;
  });
}
